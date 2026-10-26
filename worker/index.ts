/// <reference types="../worker-configuration.d.ts" />

import { verifyPassword } from './passwords'

import * as XLSX from 'xlsx'

import { createSessionToken, hashSessionToken } from './sessions'

export interface Env { DB: D1Database; LOCAL_DEVELOPMENT?: string }

type Role = 'admin' | 'registration' | 'checkin' | 'viewer'

type Staff = { id: string; staff_id: string; role: Role }

type AttendeeStatus = 'Registered' | 'Pending' | 'Cancelled'

type Attendee = { eid: string; name: string; email: string; contact_number?: string | null; family_emergency_contact_number?: string | null; colleague_emergency_contact_number?: string | null; project?: string | null; project_lead?: string | null; status: AttendeeStatus; created_at: string }

const SESSION_SECONDS = 8 * 60 * 60

const LOGIN_WINDOW_MS = 60_000

const MAX_LOGIN_ATTEMPTS = 5

const loginAttempts = new Map<string, { count: number; resetAt: number }>()

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {

  const h = new Headers(headers); h.set('Content-Type', 'application/json; charset=utf-8'); h.set('Cache-Control', 'no-store'); h.set('X-Content-Type-Options', 'nosniff')

  return new Response(JSON.stringify(body), { status, headers: h })

}

function csvCell(value: unknown): string {
  const text = String(value ?? '')
  const safe = /^[\t\r ]*[=+\-@]/.test(text) ? "'" + text : text
  return '"' + safe.replace(/"/g, '""') + '"'
}

async function recordAudit(
  env: Env,
  staffUserId: string,
  action: string,
  attendeeEid: string | null = null,
  wristbandSerial: string | null = null,
  details: string | null = null
): Promise<void> {
  try {
    await env.DB.prepare(
      'INSERT INTO audit_logs (id, staff_user_id, action, attendee_eid, wristband_serial, outcome, details) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), staffUserId, action, attendeeEid, wristbandSerial, 'SUCCESS', details).run()
  } catch (error) {
    // Audit failures must be visible to operators without turning a completed event operation into a misleading retryable failure.
    console.error('AUDIT_LOG_WRITE_ERROR', error instanceof Error ? error.message : 'Unknown error')
  }
}

function isObject(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }

function rateLimited(key: string) { const now = Date.now(); const r = loginAttempts.get(key); if (!r || now >= r.resetAt) { loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS }); return false } r.count++; return r.count > MAX_LOGIN_ATTEMPTS }

function cookieHeader(token: string, maxAge: number, local = false) {
  if (local) return `cc_session_local=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`
  return `__Host-cc_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`
}
// LOCAL_DEVELOPMENT_COOKIE_MODE
function getSessionToken(request: Request, local = false): string | null {
  const value = request.headers.get('Cookie')
  if (!value) return null
  const cookieName = local ? 'cc_session_local=' : '__Host-cc_session='
  const item = value.split(';').map(x => x.trim()).find(x => x.startsWith(cookieName))
  if (!item) return null
  const token = item.slice(cookieName.length)
  return token.length > 0 && token.length <= 200 ? token : null
}



async function authenticate(request: Request, env: Env): Promise<Staff | null> {

  const local = env.LOCAL_DEVELOPMENT === 'true'
  const token = getSessionToken(request, local); if (!token) return null

  const tokenHash = await hashSessionToken(token); const now = Math.floor(Date.now() / 1000)

  return await env.DB.prepare(`SELECT u.id, u.staff_id, u.role FROM staff_sessions s JOIN staff_users u ON u.id = s.staff_user_id WHERE s.id_hash = ? AND s.expires_at > ? AND u.is_active = 1`).bind(tokenHash, now).first<Staff>()

}

async function readJson(request: Request): Promise<unknown> { try { return await request.json() } catch { return null } }

function randomToken() { const bytes = new Uint8Array(32); crypto.getRandomValues(bytes); return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('') }

function canRegister(role: Role) { return role === 'admin' || role === 'registration' }

function canCheckin(role: Role) { return role === 'admin' || role === 'registration' || role === 'checkin' }

function canAssignBand(role: Role) { return role === 'admin' || role === 'registration' }

export default {

  async fetch(request: Request, env: Env): Promise<Response> {

    const url = new URL(request.url)

    if (request.method === 'GET' && url.pathname === '/api/health') return json({ status: 'ok', service: 'champion-celebration-api' })

    if (request.method === 'GET' && url.pathname === '/api/me') {

      try { const staff = await authenticate(request, env); if (!staff) return json({ error: 'Not signed in' }, 401); return json({ ok: true, staff: { id: staff.id, staffId: staff.staff_id, role: staff.role } }) }

      catch { return json({ error: 'Unable to validate session' }, 500) }

    }

    if (request.method === 'POST' && url.pathname === '/api/logout') {

      const token = getSessionToken(request, env.LOCAL_DEVELOPMENT === 'true')

      try {

        if (token) {

          const tokenHash = await hashSessionToken(token)

          await env.DB.prepare(

            'DELETE FROM staff_sessions WHERE id_hash = ?',

          ).bind(tokenHash).run()

        }

        return json(

          { ok: true },

          200,

          {

            'Set-Cookie': env.LOCAL_DEVELOPMENT === 'true' ? 'cc_session_local=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0' : '__Host-cc_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0',

          },

        )

      } catch {

        return json({ error: 'Unable to sign out. Please try again.' }, 500)

      }

    }

    if (request.method === 'POST' && url.pathname === '/api/login') {

      if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') return json({ error: 'HTTPS is required' }, 400)

      if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) return json({ error: 'Unsupported content type' }, 415)

      const body = await readJson(request)

      if (!isObject(body) || typeof body.staffId !== 'string' || typeof body.password !== 'string' || !body.staffId.trim() || !body.password || body.staffId.length > 100 || body.password.length > 256) return json({ error: 'Invalid staff ID or password' }, 400)

      const clientKey = request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ?? 'local-client'

      if (rateLimited(clientKey)) return json({ error: 'Too many login attempts. Try again in one minute.' }, 429, { 'Retry-After': '60' })

      const user = await env.DB.prepare('SELECT id, staff_id, password_hash, role FROM staff_users WHERE staff_id = ? AND is_active = 1').bind(body.staffId.trim()).first<{ id: string; staff_id: string; password_hash: string; role: Role }>()

      const passwordValid = user

        ? await verifyPassword(body.password, user.password_hash)

        : false

      if (!user || !passwordValid) {

        return json({ error: 'Invalid staff ID or password' }, 401)

      }

      loginAttempts.delete(clientKey)

      const token = createSessionToken(); const tokenHash = await hashSessionToken(token); const now = Math.floor(Date.now() / 1000)

      await env.DB.prepare('INSERT INTO staff_sessions (id_hash, staff_user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').bind(tokenHash, user.id, now + SESSION_SECONDS, now).run()

      return json({ ok: true, staff: { id: user.id, staffId: user.staff_id, role: user.role } }, 200, { 'Set-Cookie': cookieHeader(token, SESSION_SECONDS, env.LOCAL_DEVELOPMENT === 'true') })

    }

    const apiPath = url.pathname

    if (!['/api/attendees', '/api/wristbands', '/api/checkin', '/api/checkins', '/api/inventory', '/api/inventory/generate', '/api/inventory/assign', '/api/inventory/checkin', '/api/admin/operations-dashboard', '/api/admin/audit-logs', '/api/admin/employee-prereg/import', '/api/mypmo/upload', '/api/mypmo/lookup', '/api/emergency/lookup'].includes(apiPath)) return json({ error: 'Not found' }, 404)

    let staff: Staff | null

    try { staff = await authenticate(request, env) } catch { return json({ error: 'Unable to validate session' }, 500) }

    if (!staff) return json({ error: 'Please log in again' }, 401)

    if (apiPath === '/api/admin/audit-logs' && request.method === 'GET') {
      if (staff.role !== 'admin') return json({ error: 'Administrator access required' }, 403)
      try {
        const result = await env.DB.prepare(`
          SELECT l.occurred_at,
                 COALESCE(u.staff_id, '') AS staff_id,
                 l.action,
                 COALESCE(l.attendee_eid, '') AS attendee_eid,
                 COALESCE(a.name, '') AS attendee_name,
                 COALESCE(l.wristband_serial, '') AS wristband_serial,
                 l.outcome,
                 COALESCE(l.details, '') AS details
          FROM audit_logs l
          LEFT JOIN staff_users u ON u.id = l.staff_user_id
          LEFT JOIN attendees a ON LOWER(a.eid) = LOWER(l.attendee_eid)
          WHERE l.action IN (
            'ATTENDEE_CREATED',
            'ATTENDEE_CHECKED_IN',
            'WRISTBAND_ASSIGNED',
            'PRE_EVENT_IMPORT_COMPLETED'
          )
          ORDER BY l.occurred_at DESC
          LIMIT 10000
        `).all<Record<string, string | null>>()
        const header = ['date_time', 'activity', 'employee_id', 'employee_name', 'band_serial', 'performed_by', 'outcome', 'details']
        const activityLabels: Record<string, string> = {
          ATTENDEE_CREATED: 'Employee registered',
          ATTENDEE_CHECKED_IN: 'Employee checked in',
          WRISTBAND_ASSIGNED: 'Wristband assigned',
          PRE_EVENT_IMPORT_COMPLETED: 'Employee pre-registration import batch'
        }
        const lines = [
          header.map(csvCell).join(','),
          ...(result.results ?? []).map(row => [
            row.occurred_at,
            activityLabels[row.action ?? ''] ?? row.action,
            row.attendee_eid,
            row.attendee_name,
            row.wristband_serial,
            row.staff_id,
            row.outcome,
            row.details
          ].map(csvCell).join(','))
        ]
        return new Response('\uFEFF' + lines.join('\r\n'), {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="champion-celebration-audit-logs.csv"',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff'
          }
        })
      } catch (error) {
        console.error('AUDIT_LOG_EXPORT_ERROR', error instanceof Error ? error.message : 'Unknown error')
        return json({ error: 'Could not export audit logs. Apply migration_audit_logs.sql first.' }, 500)
      }
    }

    if (apiPath === '/api/wristbands') return json({error:'Legacy QR wristbands are disabled. Use preprinted inventory bands.'},410)

    // OPTION 2 Ã¢â‚¬â€ separate inventory-first wristbands. Legacy /api/wristbands remains unchanged.

    if (apiPath === '/api/admin/operations-dashboard' && request.method === 'GET') {
      if (staff.role !== 'admin') {
        return json({ error: 'Administrator access required' }, 403)
      }

      try {
        const counts = await env.DB.prepare(`
          SELECT
            (SELECT COUNT(*) FROM attendees) AS totalAttendees,
            (SELECT COUNT(*) FROM attendees WHERE status = 'Registered') AS registeredAttendees,
            (SELECT COUNT(*) FROM attendees
              WHERE status = 'Registered'
              AND registration_source = 'PRE_EVENT_IMPORT'
            ) AS preEventRegistrations,
            (SELECT COUNT(*) FROM attendees
              WHERE status = 'Registered'
              AND registration_source = 'MANUAL'
            ) AS liveRegistrations,
            (SELECT COUNT(*) FROM attendees WHERE status = 'Pending') AS pendingAttendees,
            (SELECT COUNT(*) FROM attendees WHERE status = 'Cancelled') AS cancelledAttendees,
            (SELECT COUNT(*) FROM attendees a
              WHERE a.status = 'Registered'
              AND NOT EXISTS (
                SELECT 1 FROM wristband_inventory w
                WHERE w.attendee_eid = a.eid
              )
            ) AS attendeesWithoutBands,
            (SELECT COUNT(*) FROM wristband_inventory WHERE status = 'Available') AS availableBands,
            (SELECT COUNT(*) FROM wristband_inventory WHERE status = 'Assigned') AS assignedBands,
            (SELECT COUNT(*) FROM wristband_inventory WHERE status = 'Checked In') AS checkedInBands,
            (SELECT COUNT(*) FROM wristband_inventory WHERE status = 'Revoked') AS revokedBands,
            (SELECT COUNT(*) FROM attendee_checkins) AS totalCheckins
        `).first<Record<string, number>>()

        const assignments = await env.DB.prepare(`
          SELECT h.serial, h.attendee_eid AS eid, a.name AS attendee_name,
                 h.action, h.performed_at, h.details,
                 u.staff_id AS staff_id
          FROM wristband_inventory_audit h
          LEFT JOIN attendees a ON a.eid = h.attendee_eid
          LEFT JOIN staff_users u ON u.id = h.performed_by
          WHERE h.action IN ('ASSIGNED', 'GENERATED', 'REVOKED')
          ORDER BY h.performed_at DESC
          LIMIT 200
        `).all()

        const checkins = await env.DB.prepare(`
          SELECT c.attendee_eid AS eid, a.name AS attendee_name,
                 w.serial, c.checked_in_at, c.method,
                 u.staff_id AS staff_id
          FROM attendee_checkins c
          JOIN attendees a ON a.eid = c.attendee_eid
          LEFT JOIN staff_users u ON u.id = c.checked_in_by
          LEFT JOIN wristband_inventory w ON w.attendee_eid = c.attendee_eid
          ORDER BY c.checked_in_at DESC
          LIMIT 200
        `).all()

        const awaitingCheckin = await env.DB.prepare(`
          SELECT w.serial, w.attendee_eid AS eid, a.name AS attendee_name,
                 w.assigned_at
          FROM wristband_inventory w
          LEFT JOIN attendees a ON a.eid = w.attendee_eid
          WHERE w.status = 'Assigned'
          ORDER BY w.assigned_at ASC
          LIMIT 200
        `).all()

        return json({
          ok: true,
          generatedAt: new Date().toISOString(),
          counts: counts ?? {},
          assignments: assignments.results,
          checkins: checkins.results,
          awaitingCheckin: awaitingCheckin.results
        })
      } catch (error) {
        console.error('OPERATIONS_DASHBOARD_ERROR',
          error instanceof Error ? error.message : 'Unknown error')
        return json({ error: 'Could not load operations dashboard. Check the local database migrations.' }, 500)
      }
    }
    if (apiPath === '/api/inventory' && request.method === 'GET') {

      if (staff.role !== 'admin') return json({ ok:true, counts:{available:0,assigned:0,checkedIn:0,revoked:0,total:0}, bands:[] })

      try {

        const counts = await env.DB.prepare(`SELECT

          SUM(CASE WHEN status='Available' THEN 1 ELSE 0 END) AS available,

          SUM(CASE WHEN status='Assigned' THEN 1 ELSE 0 END) AS assigned,

          SUM(CASE WHEN status='Checked In' THEN 1 ELSE 0 END) AS checkedIn,

          SUM(CASE WHEN status='Revoked' THEN 1 ELSE 0 END) AS revoked,

          COUNT(*) AS total FROM wristband_inventory`).first<Record<string, number>>()

        const bands = url.searchParams.get('forPrint') === '1'
          ? await env.DB.prepare(`SELECT w.serial,w.qr_token,w.status,w.attendee_eid,w.created_at,w.assigned_at,w.checked_in_at,a.name,a.project FROM wristband_inventory w LEFT JOIN attendees a ON a.eid=w.attendee_eid ORDER BY w.serial`).all()
          : await env.DB.prepare(`SELECT w.serial,w.qr_token,w.status,w.attendee_eid,w.created_at,w.assigned_at,w.checked_in_at,a.name,a.project FROM wristband_inventory w LEFT JOIN attendees a ON a.eid=w.attendee_eid ORDER BY w.created_at DESC LIMIT 10`).all()

        return json({ ok:true, counts: counts ?? {available:0,assigned:0,checkedIn:0,revoked:0,total:0}, bands:bands.results })

      } catch (e) { console.error('INVENTORY_GET_ERROR', e instanceof Error ? e.message : 'Unknown error'); return json({error:'Inventory tables are not installed. Apply migration_inventory_option2.sql to the test database first.'},500) }

    }

    if (apiPath === '/api/inventory/generate' && request.method === 'POST') {

      if (staff.role !== 'admin') return json({error:'Only an administrator can generate wristbands'},403)

      const body = await readJson(request)

      if (!isObject(body) || !Number.isInteger(body.count) || (body.count as number)<1 || (body.count as number)>1700) return json({error:'Count must be a whole number from 1 to 1700'},400)

      const count = body.count as number

      const prefix = typeof body.prefix === 'string' ? body.prefix.trim().toUpperCase() : 'ACC'

      const start = Number.isInteger(body.start) ? body.start as number : 1

      if (!/^[A-Z]{2,8}$/.test(prefix) || !Number.isInteger(start) || start<1 || start+count-1>999999) return json({error:'Invalid prefix, start or range'},400)

      const existing = await env.DB.prepare('SELECT serial FROM wristband_inventory WHERE serial LIKE ?').bind(`${prefix}%`).all<{serial:string}>()
      const wanted = new Set(Array.from({length:count},(_,i)=>`${prefix}${String(start+i).padStart(3,'0')}`))
      const collisions = existing.results.filter(row=>wanted.has(row.serial))
      if (collisions.length) return json({error:`Serial range already contains ${collisions.length} band(s). Choose a new start number.`},409)

      const stmts = []

      for(let n=start;n<start+count;n++) {

        const id=crypto.randomUUID(), serial=`${prefix}${String(n).padStart(3,'0')}`, token=randomToken()

        stmts.push(env.DB.prepare("INSERT INTO wristband_inventory (id,serial,qr_token,status) VALUES (?,?,?,'Available')").bind(id,serial,token))

        stmts.push(env.DB.prepare("INSERT INTO wristband_inventory_audit (id,wristband_id,serial,action,performed_by,details) VALUES (?,?,?,'GENERATED',?,?)").bind(crypto.randomUUID(),id,serial,staff.id,'Option 2 inventory generation'))
        stmts.push(env.DB.prepare("INSERT INTO audit_logs (id,staff_user_id,action,attendee_eid,wristband_serial,outcome,details) VALUES (?,?,?,NULL,?,'SUCCESS',?)").bind(crypto.randomUUID(),staff.id,'WRISTBAND_GENERATED',serial,'Inventory band generated'))

      }

      try { for(let i=0;i<stmts.length;i+=80) await env.DB.batch(stmts.slice(i,i+80)); return json({ok:true,generated:count,prefix,start,end:start+count-1},201) }

      catch(e) { console.error('INVENTORY_GENERATE_ERROR',e instanceof Error?e.message:'Unknown error'); return json({error:'Generation failed. Check whether any serials in this range already exist.'},409) }

    }

    if (apiPath === '/api/inventory/assign' && request.method === 'POST') {

      if (!canAssignBand(staff.role)) return json({error:'You do not have permission to assign wristbands'},403)

      const body=await readJson(request)

      if (!isObject(body) || typeof body.serial!=='string' || typeof body.eid!=='string') return json({error:'Wristband serial and employee ID are required'},400)

      const serial=body.serial.trim().toUpperCase(), eid=body.eid.trim()

      const attendee=await env.DB.prepare("SELECT eid,name,email,project,status FROM attendees WHERE eid=?").bind(eid).first<{eid:string;name:string;email:string;project:string;status:string}>()

      if(!attendee) return json({error:'Attendee not found. Register walk-ins in Attendees first.'},404)

      if(attendee.status!=='Registered') return json({error:'Only registered attendees can be assigned a wristband'},400)

      const band=await env.DB.prepare("SELECT id,serial,status,attendee_eid FROM wristband_inventory WHERE serial=?").bind(serial).first<{id:string;serial:string;status:string;attendee_eid:string|null}>()

      if(!band) return json({error:'Wristband serial not found'},404)

      if(band.status!=='Available'||band.attendee_eid) return json({error:`${serial} is not available (${band.status})`},409)

      const already=await env.DB.prepare("SELECT serial FROM wristband_inventory WHERE attendee_eid=?").bind(eid).first<{serial:string}>()

      if(already) return json({error:`This attendee already has wristband ${already.serial}`},409)

      try {

        const upd=await env.DB.prepare("UPDATE wristband_inventory SET status='Assigned',attendee_eid=?,assigned_at=CURRENT_TIMESTAMP WHERE id=? AND status='Available' AND attendee_eid IS NULL").bind(eid,band.id).run()

        if(upd.meta.changes!==1) return json({error:'Wristband was just assigned by another staff member. Refresh inventory.'},409)

        await env.DB.prepare("INSERT INTO wristband_inventory_audit (id,wristband_id,serial,attendee_eid,action,performed_by) VALUES (?,?,?,?,'ASSIGNED',?)").bind(crypto.randomUUID(),band.id,serial,eid,staff.id).run()
        await recordAudit(env, staff.id, 'WRISTBAND_ASSIGNED', eid, serial, 'Inventory band assigned')

        return json({ok:true,serial,attendee:{eid:attendee.eid,name:attendee.name,project:attendee.project},status:'Assigned'},201)

      } catch(e) { console.error('INVENTORY_ASSIGN_ERROR',e instanceof Error?e.message:'Unknown error'); return json({error:'Assignment failed; refresh and verify the attendee and band status.'},409) }

    }

    if (apiPath === '/api/inventory/checkin' && request.method === 'POST') {

      if (!canCheckin(staff.role)) return json({error:'You do not have permission to check in attendees'},403)

      const body=await readJson(request)

      if(!isObject(body)||typeof body.serial!=='string') return json({error:'Wristband serial is required'},400)

      const serial=body.serial.trim().toUpperCase()

      const band=await env.DB.prepare("SELECT w.id,w.serial,w.status,w.attendee_eid,a.name,a.email,a.project,a.status AS attendee_status FROM wristband_inventory w LEFT JOIN attendees a ON a.eid=w.attendee_eid WHERE w.serial=?").bind(serial).first<{id:string;serial:string;status:string;attendee_eid:string|null;name:string|null;email:string|null;project:string|null;attendee_status:string|null}>()

      if(!band) return json({error:'Wristband not found'},404)

      if(band.status==='Available') return json({error:'This wristband is not assigned yet'},409)

      if(band.status==='Revoked') return json({error:'This wristband has been revoked'},409)

      if(band.status==='Checked In') return json({error:'This wristband has already been checked in'},409)

      if(!band.attendee_eid||band.attendee_status!=='Registered') return json({error:'Assigned attendee is not eligible for check-in'},400)

      const prior=await env.DB.prepare('SELECT checked_in_at FROM attendee_checkins WHERE attendee_eid=?').bind(band.attendee_eid).first<{checked_in_at:string}>()

      if(prior) return json({error:`Attendee already checked in at ${prior.checked_in_at}`},409)

      try {

        await env.DB.prepare("INSERT INTO attendee_checkins (id,attendee_eid,checked_in_by,method) VALUES (?,?,?,'QR')").bind(crypto.randomUUID(),band.attendee_eid,staff.id).run()

        const upd=await env.DB.prepare("UPDATE wristband_inventory SET status='Checked In',checked_in_at=CURRENT_TIMESTAMP,checked_in_by=? WHERE id=? AND status='Assigned'").bind(staff.id,band.id).run()

        if(upd.meta.changes!==1) return json({error:'Check-in state changed; contact the event administrator to reconcile.'},409)

        await env.DB.prepare("INSERT INTO wristband_inventory_audit (id,wristband_id,serial,attendee_eid,action,performed_by) VALUES (?,?,?,?,'CHECKED_IN',?)").bind(crypto.randomUUID(),band.id,serial,band.attendee_eid,staff.id).run()
        await recordAudit(env, staff.id, 'ATTENDEE_CHECKED_IN', band.attendee_eid, serial, 'QR wristband check-in')

        const checked=await env.DB.prepare('SELECT checked_in_at FROM attendee_checkins WHERE attendee_eid=?').bind(band.attendee_eid).first<{checked_in_at:string}>()

        return json({ok:true,serial,attendee:{eid:band.attendee_eid,name:band.name,project:band.project},checked_in_at:checked?.checked_in_at},201)

      } catch(e) { console.error('INVENTORY_CHECKIN_ERROR',e instanceof Error?e.message:'Unknown error'); return json({error:'Check-in failed or attendee was already checked in'},409) }

    }

    // Emergency lookup is read-only and available to any authenticated event staff role.
    if (apiPath === '/api/emergency/lookup' && request.method === 'GET') {
      const query = (url.searchParams.get('q') || '').trim()
      if (!query || query.length > 200) return json({ error: 'Enter or scan a wristband number or Enterprise ID.' }, 400)
      try {
        const band = await env.DB.prepare(`
          SELECT w.serial, w.status AS band_status, w.attendee_eid,
                 w.assigned_at, w.checked_in_at AS band_checked_in_at,
                 a.eid, a.name, a.email, a.contact_number,
                 a.family_emergency_contact_number, a.colleague_emergency_contact_number,
                 a.project, a.project_lead, a.status AS attendee_status,
                 a.registration_source, c.checked_in_at
          FROM wristband_inventory w
          LEFT JOIN attendees a ON a.eid = w.attendee_eid
          LEFT JOIN attendee_checkins c ON c.attendee_eid = a.eid
          WHERE UPPER(w.serial) = UPPER(?)
          LIMIT 1
        `).bind(query).first<Record<string, unknown>>()

        let attendee = band
        let bandInfo: Record<string, unknown> | null = band ? {
          serial: band.serial, status: band.band_status,
          assigned_at: band.assigned_at, checked_in_at: band.band_checked_in_at
        } : null

        if (!attendee) {
          attendee = await env.DB.prepare(`
            SELECT a.eid, a.name, a.email, a.contact_number,
                   a.family_emergency_contact_number, a.colleague_emergency_contact_number,
                   a.project, a.project_lead, a.status AS attendee_status,
                   a.registration_source, c.checked_in_at,
                   w.serial, w.status AS band_status, w.assigned_at,
                   w.checked_in_at AS band_checked_in_at
            FROM attendees a
            LEFT JOIN attendee_checkins c ON c.attendee_eid = a.eid
            LEFT JOIN wristband_inventory w ON w.attendee_eid = a.eid
            WHERE LOWER(a.eid) = LOWER(?)
            LIMIT 1
          `).bind(query).first<Record<string, unknown>>()
          if (attendee && attendee.serial) bandInfo = {
            serial: attendee.serial, status: attendee.band_status,
            assigned_at: attendee.assigned_at, checked_in_at: attendee.band_checked_in_at
          }
        }

        const eid = typeof attendee?.eid === 'string' ? attendee.eid : (typeof attendee?.attendee_eid === 'string' ? attendee.attendee_eid : '')
        const mypmo = eid ? await env.DB.prepare(`
          SELECT roster_type, enterprise_id, full_name, email, project, project_lead, resource_status
          FROM mypmo_resources_v2 WHERE LOWER(enterprise_id) = LOWER(?) ORDER BY roster_type
        `).bind(eid).all<Record<string, unknown>>() : { results: [] }

        if (!attendee && !band) {
          const rosterOnly = await env.DB.prepare(`
            SELECT roster_type, enterprise_id, full_name, email, project, project_lead, resource_status
            FROM mypmo_resources_v2 WHERE LOWER(enterprise_id) = LOWER(?) ORDER BY roster_type
          `).bind(query).all<Record<string, unknown>>()
          if (!rosterOnly.results?.length) return json({ found: false, error: 'No attendee, wristband, or MyPMO record matched this value.' }, 404)
          return json({ found: true, registered: false, attendee: null, band: null, mypmo: rosterOnly.results,
            message: 'MyPMO record found, but this person has no matching event registration or assigned wristband.' })
        }

        return json({
          found: true,
          registered: Boolean(attendee?.eid),
          attendee: attendee && typeof attendee.eid === 'string' ? {
            eid: attendee.eid,
            name: attendee.name || null, email: attendee.email || null,
            contact_number: attendee.contact_number || null,
            family_emergency_contact_number: attendee.family_emergency_contact_number || null,
            colleague_emergency_contact_number: attendee.colleague_emergency_contact_number || null,
            project: attendee.project || null, project_lead: attendee.project_lead || null,
            status: attendee.attendee_status || null, registration_source: attendee.registration_source || null,
            checked_in_at: attendee.checked_in_at || attendee.band_checked_in_at || null
          } : null,
          band: bandInfo,
          mypmo: mypmo.results || [],
          message: attendee?.eid ? 'Attendee details found. This lookup did not change check-in status.' : 'Wristband found, but it is not assigned to an event attendee.'
        })
      } catch (error) {
        console.error('EMERGENCY_LOOKUP_ERROR', error instanceof Error ? error.message : 'Unknown error')
        return json({ error: 'Could not retrieve emergency details. Please contact the event administrator.' }, 500)
      }
    }

    // MYPMO_ROUTES_START
    // Aspire and IX rosters are stored independently in mypmo_resources_v2.

    if (apiPath === '/api/mypmo/upload' && request.method === 'POST') {
      if (staff.role !== 'admin') return json({ error: 'You do not have permission to import MyPMO data' }, 403)
      const maxFileBytes = 10 * 1024 * 1024
      const contentLength = Number(request.headers.get('content-length') || '0')
      if (contentLength > maxFileBytes + 100_000) return json({ error: 'Upload is too large. Maximum Excel file size is 10 MB.' }, 413)
      if (!request.headers.get('content-type')?.toLowerCase().includes('multipart/form-data')) return json({ error: 'Upload an Excel file using multipart/form-data' }, 415)
      try {
        const form = await request.formData()
        const file = form.get('file')
        const roster = String(form.get('roster') || 'ASPIRE').toUpperCase()
        if (roster !== 'ASPIRE' && roster !== 'IX') return json({ error: 'Choose Roche Aspire MyPMO or Roche IX MyPMO.' }, 400)
        if (!(file instanceof File)) return json({ error: 'Select an Excel file in the file field' }, 400)
        if (file.size === 0 || file.size > maxFileBytes) return json({ error: 'Excel file must be between 1 byte and 10 MB' }, 413)
        if (!/\.(xlsx|xls)$/i.test(file.name)) return json({ error: 'Only .xlsx and .xls files are accepted' }, 400)
        const workbook = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array', cellDates: false })
        if (!workbook.SheetNames.length) return json({ error: 'The workbook has no worksheets' }, 400)
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        if (!sheet) return json({ error: 'Could not read the first worksheet' }, 400)
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false })
        if (!rows.length) return json({ error: 'The first worksheet contains no employee rows' }, 400)
        if (rows.length > 20000) return json({ error: 'The workbook contains too many rows. Maximum is 20,000.' }, 400)
        const headerRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', blankrows: false })
        const actualHeaders = new Set((headerRows[0] ?? []).map(value => String(value).trim()))
        const requiredHeaders = roster === 'ASPIRE'
          ? ['EnterpriseId', 'ResourceName', 'InternetMail', 'Project', 'Reporting Line Manager']
          : ['EnterpriseId', 'ResourceStatus', 'ResourceName', 'InternetMail', 'SOWName', 'PeopleLead(Workday)']
        const missingHeaders = requiredHeaders.filter(header => !actualHeaders.has(header))
        if (missingHeaders.length) return json({ error: 'The workbook is missing required column headers for the selected roster', missingHeaders }, 400)
        const seenIds = new Set<string>()
        const employees: Array<{ enterpriseId:string; fullName:string; email:string; contactNumber:string; project:string; projectLead:string; status:string }> = []
        let skippedStatus = 0
        for (let index = 0; index < rows.length; index++) {
          const row = rows[index]
          const status = String(row.ResourceStatus ?? '').trim()
          if (roster === 'IX' && !['active', 'onboarding'].includes(status.toLowerCase())) { skippedStatus++; continue }
          const enterpriseId = String(row.EnterpriseId ?? '').trim()
          const fullName = String(row.ResourceName ?? '').trim()
          const email = String(row.InternetMail ?? '').trim().toLowerCase()
          // Neither MyPMO roster is a source for attendee contact numbers.
          const contactNumber = ''
          const project = String(roster === 'IX' ? (row.SOWName ?? '') : (row.Project ?? '')).trim()
          const projectLead = String(roster === 'IX' ? (row['PeopleLead(Workday)'] ?? '') : (row['Reporting Line Manager'] ?? '')).trim()
          if (!enterpriseId || enterpriseId.length > 100) return json({ error: `Invalid EnterpriseId at worksheet data row ${index + 2}` }, 400)
          if (!fullName || fullName.length > 200) return json({ error: `Invalid ResourceName at worksheet data row ${index + 2}` }, 400)
          if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: `Invalid InternetMail at worksheet data row ${index + 2}` }, 400)
          if (contactNumber.length > 50 || project.length > 200 || projectLead.length > 200) return json({ error: `A field is too long at worksheet data row ${index + 2}` }, 400)
          const normalizedId = enterpriseId.toLowerCase()
          if (seenIds.has(normalizedId)) return json({ error: `Duplicate EnterpriseId found at worksheet data row ${index + 2}` }, 400)
          seenIds.add(normalizedId)
          employees.push({ enterpriseId, fullName, email, contactNumber, project, projectLead, status: roster === 'IX' ? status : 'ACTIVE' })
        }
        if (!employees.length) return json({ error: 'No eligible rows were found. IX imports include only Active and Onboarding resources.' }, 400)
        const statements = employees.map(employee => env.DB.prepare(`
          INSERT INTO mypmo_resources_v2
            (roster_type, enterprise_id, full_name, email, contact_number, project, project_lead, resource_status, imported_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(roster_type, enterprise_id) DO UPDATE SET
            full_name=excluded.full_name, email=excluded.email, contact_number=excluded.contact_number,
            project=excluded.project, project_lead=excluded.project_lead,
            resource_status=excluded.resource_status, imported_at=CURRENT_TIMESTAMP
        `).bind(roster, employee.enterpriseId, employee.fullName, employee.email, employee.contactNumber || null,
          employee.project || null, employee.projectLead || null, employee.status))
        for (let offset = 0; offset < statements.length; offset += 100) await env.DB.batch(statements.slice(offset, offset + 100))
        return json({ ok: true, imported: employees.length, skippedStatus, roster, message: `${roster === 'IX' ? 'Roche IX' : 'Roche Aspire'} MyPMO import complete: ${employees.length} eligible resources imported${roster === 'IX' ? `; ${skippedStatus} other-status rows skipped` : ''}. The other roster and attendee/check-in records were not changed.` })
      } catch (error) {
        console.error('MYPMO_IMPORT_ERROR', error instanceof Error ? error.message : 'Unknown error')
        return json({ error: 'Could not import the workbook. Apply the MyPMO roster migration, check the workbook format, and try again.' }, 400)
      }
    }

    if (apiPath === '/api/mypmo/lookup' && request.method === 'GET') {
      if (!canRegister(staff.role)) return json({ error: 'You do not have permission to look up MyPMO records' }, 403)
      const enterpriseId = (url.searchParams.get('eid') || '').trim()
      const roster = (url.searchParams.get('roster') || '').toUpperCase()
      if (!enterpriseId || enterpriseId.length > 100) return json({ error: 'Provide a valid Enterprise ID using the eid query parameter' }, 400)
      if (roster && roster !== 'ASPIRE' && roster !== 'IX') return json({ error: 'Invalid roster selection' }, 400)
      try {
        const result = roster
          ? await env.DB.prepare(`SELECT roster_type, enterprise_id, full_name, email, NULL AS contact_number, project, project_lead, resource_status FROM mypmo_resources_v2 WHERE roster_type=? AND LOWER(enterprise_id)=LOWER(?)`).bind(roster, enterpriseId).all()
          : await env.DB.prepare(`SELECT roster_type, enterprise_id, full_name, email, NULL AS contact_number, project, project_lead, resource_status FROM mypmo_resources_v2 WHERE LOWER(enterprise_id)=LOWER(?) ORDER BY roster_type`).bind(enterpriseId).all()
        const matches = (result.results ?? []) as Array<{ roster_type:string; enterprise_id:string; full_name:string; email:string; contact_number:string|null; project:string|null; project_lead:string|null; resource_status:string|null }>
        if (!matches.length) return json({ found: false, matches: [], message: 'Enterprise ID not found in either MyPMO roster' }, 404)
        if (matches.length > 1) return json({ found: false, ambiguous: true, matches, message: 'This Enterprise ID exists in both Aspire and IX. Select the correct roster.' }, 200)
        const employee = matches[0]
        return json({ found: true, employee, matches })
      } catch {
        return json({ error: 'Could not look up the MyPMO record. Apply the MyPMO roster migration first.' }, 500)
      }
    }
        if (apiPath === '/api/admin/employee-prereg/import' && request.method === 'POST') {
      if (staff.role !== 'admin') {
        return json({ error: 'Administrator access required' }, 403)
      }
      if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
        return json({ error: 'Unsupported content type' }, 415)
      }

      const body = await readJson(request)
      if (!isObject(body) || !Array.isArray(body.attendees)) {
        return json({ error: 'Expected an attendees array' }, 400)
      }
      const rows = body.attendees
      if (rows.length < 1 || rows.length > 500) {
        return json({ error: 'Import between 1 and 500 valid employee rows at a time' }, 400)
      }
      const approvedMissingEids = new Set(
        Array.isArray(body.approvedMissingEids)
          ? body.approvedMissingEids.filter((value): value is string => typeof value === 'string').map((value) => value.trim().toLowerCase())
          : []
      )

      const prepared: Array<{
        eid: string
        name: string
        email: string
        project: string
        contact: string
        family: string
        colleague: string
        lead: string
      }> = []
      const seenEids = new Set<string>()
      const seenEmails = new Set<string>()
      const missingEmployees: Array<{ eid: string; name: string; email: string; project: string; roster_type?: string }> = []

      try {
        // Validate and resolve every row before inserting any attendees.
        for (const item of rows) {
          if (!isObject(item)) return json({ error: 'Invalid employee row; nothing was imported' }, 400)
          const eid = typeof item.eid === 'string' ? item.eid.trim() : ''
          const rosterValue = typeof item.roster_type === 'string' ? item.roster_type.trim().toUpperCase() : ''
          const rosterType = rosterValue === 'ASPIRE' || rosterValue === 'IX' ? rosterValue : ''
          if (rosterValue && !rosterType) return json({ error: `Invalid roster for Enterprise ID "${eid}". Use ASPIRE or IX; nothing was imported.` }, 400)
          const contact = typeof item.contact_number === 'string' ? item.contact_number.trim() : ''
          const family = typeof item.family_emergency_contact_number === 'string' ? item.family_emergency_contact_number.trim() : ''
          const colleague = typeof item.colleague_emergency_contact_number === 'string' ? item.colleague_emergency_contact_number.trim() : ''

          if (!eid || eid.length > 100 || contact.length > 30 || family.length > 30 || colleague.length > 30) {
            return json({ error: 'One or more rows have invalid employee IDs or contact fields; nothing was imported' }, 400)
          }
          const normalizedEid = eid.toLowerCase()
          if (seenEids.has(normalizedEid)) {
            return json({ error: 'Duplicate employee ID in submitted rows; nothing was imported' }, 400)
          }
          seenEids.add(normalizedEid)

          const employeeMatches = rosterType
            ? await env.DB.prepare(`
                SELECT roster_type, enterprise_id, full_name, email, NULL AS contact_number, project, project_lead
                FROM mypmo_resources_v2
                WHERE roster_type = ? AND LOWER(enterprise_id) = LOWER(?)
                LIMIT 2
              `).bind(rosterType, eid).all<{
                  roster_type: string
                  enterprise_id: string
                  full_name: string
                  email: string
                  contact_number: string | null
                  project: string | null
                  project_lead: string | null
                }>()
            : await env.DB.prepare(`
                SELECT roster_type, enterprise_id, full_name, email, NULL AS contact_number, project, project_lead
                FROM mypmo_resources_v2
                WHERE LOWER(enterprise_id) = LOWER(?)
                ORDER BY roster_type
                LIMIT 2
              `).bind(eid).all<{
            roster_type: string
            enterprise_id: string
            full_name: string
            email: string
            contact_number: string | null
            project: string | null
            project_lead: string | null
          }>()
          if ((employeeMatches.results ?? []).length > 1) {
            return json({ error: `Enterprise ID "${eid}" exists in both Aspire and IX. Add a Roster column to the pre-registration file and enter ASPIRE or IX for this row; nothing was imported.` }, 400)
          }
          const employee = employeeMatches.results?.[0]

          if (!employee) {
            if (!approvedMissingEids.has(normalizedEid)) {
              missingEmployees.push({
                eid,
                name: typeof item.name === 'string' ? item.name.trim() : '',
                email: typeof item.email === 'string' ? item.email.trim() : '',
                project: typeof item.project === 'string' ? item.project.trim() : '',
                roster_type: rosterType || undefined
              })
              continue
            }
            const fallbackName = typeof item.name === 'string' ? item.name.trim() : ''
            const fallbackEmail = typeof item.email === 'string' ? item.email.trim().toLowerCase() : ''
            const fallbackProject = typeof item.project === 'string' ? item.project.trim() : ''
            if (!fallbackName || !fallbackEmail || !fallbackProject) {
              return json({ error: `Approved MyPMO-missing employee "${eid}" must have a name, valid email, and project in the spreadsheet.` }, 400)
            }
            if (fallbackEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fallbackEmail)) {
              return json({ error: `Approved MyPMO-missing employee "${eid}" has an invalid email in the spreadsheet.` }, 400)
            }
            if (seenEmails.has(fallbackEmail)) {
              return json({ error: 'Duplicate email in submitted employees; nothing was imported' }, 400)
            }
            seenEmails.add(fallbackEmail)
            prepared.push({
              eid,
              name: fallbackName,
              email: fallbackEmail,
              project: fallbackProject,
              contact,
              family,
              colleague,
              lead: typeof item.project_lead === 'string' ? item.project_lead.trim() : ''
            })
            continue
          }
          if (!employee.full_name?.trim() || !employee.email?.trim() || !employee.project?.trim()) {
            return json({ error: `MyPMO record for "${eid}" is missing a required name, email, or project; nothing was imported.` }, 400)
          }
          const email = employee.email.trim().toLowerCase()
          if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return json({ error: `MyPMO record for "${eid}" has an invalid email; nothing was imported.` }, 400)
          }
          if (seenEmails.has(email)) {
            return json({ error: 'Duplicate email in MyPMO records for submitted employees; nothing was imported' }, 400)
          }
          seenEmails.add(email)

          prepared.push({
            eid: employee.enterprise_id,
            name: employee.full_name.trim(),
            email,
            project: employee.project.trim(),
            contact,
            family,
            colleague,
            lead: (employee.project_lead || '').trim()
          })
        }

        if (missingEmployees.length > 0) {
          return json({
            ok: false,
            error: 'Review employees missing from MyPMO. No records were imported yet.',
            missingEmployees
          }, 409)
        }

        let inserted = 0
        let skipped = 0
        for (const row of prepared) {
          const existing = await env.DB.prepare(
            'SELECT eid FROM attendees WHERE LOWER(eid) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1'
          ).bind(row.eid, row.email).first<{ eid: string }>()
          if (existing) {
            skipped++
            continue
          }

          const result = await env.DB.prepare(`
            INSERT OR IGNORE INTO attendees
              (eid, name, email, department, contact_number,
               family_emergency_contact_number, colleague_emergency_contact_number,
               project, project_lead, status, registration_source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Registered', 'PRE_EVENT_IMPORT')
          `).bind(
            row.eid,
            row.name,
            row.email,
            '', // Legacy NOT NULL database column; not exposed in the app.
            row.contact || null,
            row.family || null,
            row.colleague || null,
            row.project,
            row.lead || null
          ).run()
          if (result.meta.changes > 0) inserted++
          else skipped++
        }

        await recordAudit(env, staff.id, 'PRE_EVENT_IMPORT_COMPLETED', null, null, `Inserted: ${inserted}; skipped: ${skipped}`)
        return json({
          ok: true,
          inserted,
          skipped,
          message: 'Import processed using MyPMO as the source of truth for name, email, project, and project lead. No wristbands or check-ins were created.'
        })
      } catch (error) {
        console.error('Employee pre-registration import failed:', error instanceof Error ? error.message : 'Unknown error')
        return json({ error: 'Import failed while saving employee records. Check the attendee list and MyPMO import before retrying.' }, 500)
      }
    }
    // MYPMO_ROUTES_END
    if (apiPath === '/api/attendees' && request.method === 'GET') {

      if (!canRegister(staff.role)) return json({ error: 'You do not have permission to view attendee records' }, 403)

      try { const result = await env.DB.prepare('SELECT eid, name, email, contact_number, family_emergency_contact_number, colleague_emergency_contact_number, project, project_lead, status, created_at FROM attendees ORDER BY created_at DESC, name ASC').all<Attendee>(); return json({ ok: true, attendees: result.results }) }

      catch { return json({ error: 'Could not retrieve attendees' }, 500) }

    }

    if (apiPath === '/api/attendees' && (request.method === 'POST' || request.method === 'PATCH')) {

      if (!canRegister(staff.role)) return json({ error: 'You do not have permission to manage attendees' }, 403)

      if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) return json({ error: 'Unsupported content type' }, 415)

      const body = await readJson(request)

      if (!isObject(body)) return json({ error: 'Invalid attendee details' }, 400)

      const eid = typeof body.eid === 'string' ? body.eid.trim() : ''

      const name = typeof body.name === 'string' ? body.name.trim() : ''

      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

      const project = typeof body.project === 'string' ? body.project.trim() : ''
      let contactNumber = typeof body.contact_number === 'string' ? body.contact_number.trim() : ''
      let emergencyContact = typeof body.family_emergency_contact_number === 'string' ? body.family_emergency_contact_number.trim() : ''
      let colleagueContact = typeof body.colleague_emergency_contact_number === 'string' ? body.colleague_emergency_contact_number.trim() : ''
      let projectLead = typeof body.project_lead === 'string' ? body.project_lead.trim() : ''
      const status = body.status === undefined ? 'Registered' : body.status

      if (!eid || eid.length > 100 || !name || name.length > 200 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !project || project.length > 150 || contactNumber.length > 30 || emergencyContact.length > 30 || colleagueContact.length > 30 || projectLead.length > 150 || !['Registered', 'Pending', 'Cancelled'].includes(typeof status === 'string' ? status : '')) return json({ error: 'Please provide valid attendee details' }, 400)

      try {

        if (request.method === 'POST') await env.DB.prepare("INSERT INTO attendees (eid, name, email, department, contact_number, family_emergency_contact_number, colleague_emergency_contact_number, project, project_lead, status, registration_source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MANUAL')").bind(eid, name, email, '', contactNumber, emergencyContact, colleagueContact, project, projectLead, status as AttendeeStatus).run()

        else {

          const existing = await env.DB.prepare('SELECT eid, contact_number, family_emergency_contact_number, colleague_emergency_contact_number, project, project_lead FROM attendees WHERE eid = ?').bind(eid).first<{ eid: string; contact_number: string | null; family_emergency_contact_number: string | null; colleague_emergency_contact_number: string | null; project: string | null; project_lead: string | null }>()

          if (!existing) return json({ error: 'Attendee not found' }, 404)
          // Legacy edit screens do not submit the new fields; preserve them unless explicitly supplied.
          if (typeof body.contact_number !== 'string') contactNumber = existing.contact_number || ''
          if (typeof body.family_emergency_contact_number !== 'string') emergencyContact = existing.family_emergency_contact_number || ''
          if (typeof body.colleague_emergency_contact_number !== 'string') colleagueContact = existing.colleague_emergency_contact_number || ''
          if (typeof body.project !== 'string') {
            // Keep the prior project when older clients send only the legacy edit fields.
          }
          if (typeof body.project_lead !== 'string') projectLead = existing.project_lead || ''

          await env.DB.prepare('UPDATE attendees SET name = ?, email = ?, contact_number = ?, family_emergency_contact_number = ?, colleague_emergency_contact_number = ?, project = ?, project_lead = ?, status = ? WHERE eid = ?').bind(name, email, contactNumber, emergencyContact, colleagueContact, project || existing.project || '', projectLead, status as AttendeeStatus, eid).run()

        }

        await recordAudit(
          env,
          staff.id,
          request.method === 'POST' ? 'ATTENDEE_CREATED' : 'ATTENDEE_UPDATED',
          eid,
          null,
          request.method === 'POST' ? 'Manual attendee registration' : 'Attendee fields updated'
        )

        const attendee = await env.DB.prepare('SELECT eid, name, email, contact_number, family_emergency_contact_number, colleague_emergency_contact_number, project, project_lead, status, created_at FROM attendees WHERE eid = ?').bind(eid).first<Attendee>()

        return json({ ok: true, attendee }, request.method === 'POST' ? 201 : 200)

      } catch (error) { const msg = error instanceof Error ? error.message.toLowerCase() : ''; if (msg.includes('unique constraint') || msg.includes('primary key')) return json({ error: 'An attendee with this employee ID or email already exists' }, 409); return json({ error: 'Could not save attendee' }, 500) }

    }

    if (apiPath === '/api/wristbands' && request.method === 'GET') {

      try {

        // Registration staff can safely repair missing wristband assignments on refresh.

        // Existing assigned tokens are preserved; only Registered attendees are eligible.

        if (canRegister(staff.role)) {

          const eligible = await env.DB.prepare(

            "SELECT eid FROM attendees WHERE status = 'Registered' ORDER BY name",

          ).all<{ eid: string }>()

          for (const attendee of eligible.results) {

            const existing = await env.DB.prepare(

              'SELECT id, qr_token, status FROM wristbands WHERE attendee_eid = ?',

            ).bind(attendee.eid).first<{ id: string; qr_token: string | null; status: string }>()

            if (existing?.status === 'Assigned' && existing.qr_token) continue

            const token = randomToken()

            if (existing) {

              await env.DB.prepare(

                "UPDATE wristbands SET qr_token = ?, status = 'Assigned', updated_at = CURRENT_TIMESTAMP WHERE attendee_eid = ?",

              ).bind(token, attendee.eid).run()

            } else {

              await env.DB.prepare(

                "INSERT INTO wristbands (id, attendee_eid, qr_token, status) VALUES (?, ?, ?, 'Assigned')",

              ).bind(crypto.randomUUID(), attendee.eid, token).run()

            }

          }

        }

        const rows = await env.DB.prepare(

          `SELECT a.eid, a.name, a.email, a.project, a.status,

                  w.qr_token, w.status AS band_status, c.checked_in_at

           FROM attendees a

           LEFT JOIN wristbands w ON w.attendee_eid = a.eid AND w.status = 'Assigned'

           LEFT JOIN attendee_checkins c ON c.attendee_eid = a.eid

           ORDER BY a.name`,

        ).all()

        return json({ ok: true, wristbands: rows.results })

      } catch (error) {

        console.error(

          'WRISTBANDS_LOAD_ERROR',

          error instanceof Error ? error.message : 'Unknown error'

        )

        return json({ error: 'Could not load wristbands' }, 500)

      }

    }

    if (apiPath === '/api/wristbands' && request.method === 'POST') {

      if (!canRegister(staff.role)) return json({ error: 'You do not have permission to assign wristbands' }, 403)

      const body = await readJson(request); if (!isObject(body) || typeof body.eid !== 'string' || !body.eid.trim()) return json({ error: 'Employee ID is required' }, 400)

      const eid = body.eid.trim(); const attendee = await env.DB.prepare("SELECT eid, name, email, project, status FROM attendees WHERE eid = ?").bind(eid).first<{ eid: string; name: string; email: string; project: string; status: AttendeeStatus }>()

      if (!attendee) return json({ error: 'Attendee not found' }, 404)

      if (attendee.status !== 'Registered') return json({ error: 'Only registered attendees can receive a wristband' }, 400)

      try {

        let band = await env.DB.prepare("SELECT qr_token, status AS band_status FROM wristbands WHERE attendee_eid = ?").bind(eid).first<{ qr_token: string; band_status: string }>()

        if (!band) { const token = randomToken(); const id = crypto.randomUUID(); await env.DB.prepare("INSERT INTO wristbands (id, attendee_eid, qr_token, status) VALUES (?, ?, ?, 'Assigned')").bind(id, eid, token).run(); band = { qr_token: token, band_status: 'Assigned' } }

        else if (band.band_status !== 'Assigned') { const token = randomToken(); await env.DB.prepare("UPDATE wristbands SET qr_token = ?, status = 'Assigned', updated_at = CURRENT_TIMESTAMP WHERE attendee_eid = ?").bind(token, eid).run(); band = { qr_token: token, band_status: 'Assigned' } }

        return json({ ok: true, wristband: { ...attendee, ...band } }, 201)

      } catch { return json({ error: 'Could not assign QR wristband' }, 500) }

    }

    if (apiPath === '/api/checkin' && request.method === 'POST') {

      if (!canCheckin(staff.role)) return json({ error: 'You do not have permission to check in attendees' }, 403)

      const body = await readJson(request); if (!isObject(body)) return json({ error: 'Provide a QR token or employee ID' }, 400)

      const token = typeof body.token === 'string' ? body.token.trim() : ''

      const eidInput = typeof body.eid === 'string' ? body.eid.trim() : ''

      if (staff.role === 'checkin' && eidInput) return json({ error: 'Manual employee ID check-in is not permitted for this account. Scan the QR wristband.' }, 403)

      if (!token && !eidInput) return json({ error: 'Provide a QR token or employee ID' }, 400)

      const attendee = token

        ? await env.DB.prepare("SELECT a.eid, a.name, a.email, a.project, a.status FROM wristbands w JOIN attendees a ON a.eid = w.attendee_eid WHERE w.qr_token = ? AND w.status = 'Assigned'").bind(token).first<{ eid: string; name: string; email: string; project: string; status: AttendeeStatus }>()

        : await env.DB.prepare('SELECT eid, name, email, project, status FROM attendees WHERE eid = ?').bind(eidInput).first<{ eid: string; name: string; email: string; project: string; status: AttendeeStatus }>()

      if (!attendee) return json({ error: token ? 'QR wristband not found or no longer valid' : 'Attendee not found' }, 404)

      if (attendee.status !== 'Registered') return json({ error: `Cannot check in an attendee with status ${attendee.status}` }, 400)

      const already = await env.DB.prepare('SELECT checked_in_at FROM attendee_checkins WHERE attendee_eid = ?').bind(attendee.eid).first<{ checked_in_at: string }>()

      if (already) return json({ error: `Already checked in at ${already.checked_in_at}` }, 409)

      const checkinId = crypto.randomUUID()

      try { await env.DB.prepare('INSERT INTO attendee_checkins (id, attendee_eid, checked_in_by, method) VALUES (?, ?, ?, ?)').bind(checkinId, attendee.eid, staff.id, token ? 'QR' : 'EID').run() }

      catch { return json({ error: 'This attendee has already been checked in' }, 409) }

      const checked = await env.DB.prepare('SELECT checked_in_at FROM attendee_checkins WHERE attendee_eid = ?').bind(attendee.eid).first<{ checked_in_at: string }>()
      await recordAudit(env, staff.id, 'ATTENDEE_CHECKED_IN', attendee.eid, null, token ? 'QR check-in' : 'Enterprise ID check-in')

      return json({ ok: true, attendee: { ...attendee, checked_in_at: checked?.checked_in_at ?? new Date().toISOString() } }, 201)

    }

    if (apiPath === '/api/checkins' && request.method === 'GET') {

      if (!canCheckin(staff.role) && staff.role !== 'viewer') return json({ error: 'You do not have permission to view check-ins' }, 403)

      try { const result = await env.DB.prepare('SELECT c.attendee_eid AS eid, a.name, a.project, c.checked_in_at, c.checked_in_by, c.method FROM attendee_checkins c JOIN attendees a ON a.eid = c.attendee_eid ORDER BY c.checked_in_at DESC').all(); return json({ ok: true, checkins: result.results }) }

      catch { return json({ error: 'Could not load check-ins' }, 500) }

    }

    return json({ error: 'Not found' }, 404)

  },

} satisfies ExportedHandler<Env>