/// <reference types="../worker-configuration.d.ts" />

import { verifyPassword } from './passwords'

import { createSessionToken, hashSessionToken } from './sessions'

export interface Env { DB: D1Database }

type Role = 'admin' | 'registration' | 'checkin' | 'viewer'

type Staff = { id: string; staff_id: string; role: Role }

type AttendeeStatus = 'Registered' | 'Pending' | 'Cancelled'

type Attendee = { eid: string; name: string; email: string; department: string; status: AttendeeStatus; created_at: string }

const SESSION_SECONDS = 8 * 60 * 60

const LOGIN_WINDOW_MS = 60_000

const MAX_LOGIN_ATTEMPTS = 5

const loginAttempts = new Map<string, { count: number; resetAt: number }>()

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {

  const h = new Headers(headers); h.set('Content-Type', 'application/json; charset=utf-8'); h.set('Cache-Control', 'no-store'); h.set('X-Content-Type-Options', 'nosniff')

  return new Response(JSON.stringify(body), { status, headers: h })

}

function isObject(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }

function rateLimited(key: string) { const now = Date.now(); const r = loginAttempts.get(key); if (!r || now >= r.resetAt) { loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS }); return false } r.count++; return r.count > MAX_LOGIN_ATTEMPTS }

function cookieHeader(token: string, maxAge: number) { return `__Host-cc_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}` }

function getSessionToken(request: Request): string | null {

  const value = request.headers.get('Cookie'); if (!value) return null

  const item = value.split(';').map(x => x.trim()).find(x => x.startsWith('__Host-cc_session=')); if (!item) return null

  const token = item.slice('__Host-cc_session='.length); return token.length > 0 && token.length <= 200 ? token : null

}

async function authenticate(request: Request, env: Env): Promise<Staff | null> {

  const token = getSessionToken(request); if (!token) return null

  const tokenHash = await hashSessionToken(token); const now = Math.floor(Date.now() / 1000)

  return await env.DB.prepare(`SELECT u.id, u.staff_id, u.role FROM staff_sessions s JOIN staff_users u ON u.id = s.staff_user_id WHERE s.id_hash = ? AND s.expires_at > ? AND u.is_active = 1`).bind(tokenHash, now).first<Staff>()

}

async function readJson(request: Request): Promise<unknown> { try { return await request.json() } catch { return null } }

function randomToken() { const bytes = new Uint8Array(32); crypto.getRandomValues(bytes); return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('') }

function canRegister(role: Role) { return role === 'admin' || role === 'registration' }

function canCheckin(role: Role) { return role === 'admin' || role === 'registration' || role === 'checkin' }

export default {

  async fetch(request: Request, env: Env): Promise<Response> {

    const url = new URL(request.url)

    if (request.method === 'GET' && url.pathname === '/api/health') return json({ status: 'ok', service: 'champion-celebration-api' })

    if (request.method === 'GET' && url.pathname === '/api/me') {

      try { const staff = await authenticate(request, env); if (!staff) return json({ error: 'Not signed in' }, 401); return json({ ok: true, staff: { id: staff.id, staffId: staff.staff_id, role: staff.role } }) }

      catch { return json({ error: 'Unable to validate session' }, 500) }

    }

    if (request.method === 'POST' && url.pathname === '/api/logout') {

      const token = getSessionToken(request)

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

            'Set-Cookie': '__Host-cc_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0',

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

      return json({ ok: true, staff: { id: user.id, staffId: user.staff_id, role: user.role } }, 200, { 'Set-Cookie': cookieHeader(token, SESSION_SECONDS) })

    }

    const apiPath = url.pathname

    if (!['/api/attendees', '/api/wristbands', '/api/checkin', '/api/checkins'].includes(apiPath)) return json({ error: 'Not found' }, 404)

    let staff: Staff | null

    try { staff = await authenticate(request, env) } catch { return json({ error: 'Unable to validate session' }, 500) }

    if (!staff) return json({ error: 'Please log in again' }, 401)

    if (apiPath === '/api/attendees' && request.method === 'GET') {

      try { const result = await env.DB.prepare('SELECT eid, name, email, department, status, created_at FROM attendees ORDER BY created_at DESC, name ASC').all<Attendee>(); return json({ ok: true, attendees: result.results }) }

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

      const department = typeof body.department === 'string' ? body.department.trim() : ''

      const status = body.status

      if (!eid || eid.length > 100 || !name || name.length > 200 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !department || department.length > 150 || !['Registered', 'Pending', 'Cancelled'].includes(typeof status === 'string' ? status : '')) return json({ error: 'Please provide valid attendee details' }, 400)

      try {

        if (request.method === 'POST') await env.DB.prepare('INSERT INTO attendees (eid, name, email, department, status) VALUES (?, ?, ?, ?, ?)').bind(eid, name, email, department, status as AttendeeStatus).run()

        else {

          const existing = await env.DB.prepare('SELECT eid FROM attendees WHERE eid = ?').bind(eid).first<{ eid: string }>()

          if (!existing) return json({ error: 'Attendee not found' }, 404)

          await env.DB.prepare('UPDATE attendees SET name = ?, email = ?, department = ?, status = ? WHERE eid = ?').bind(name, email, department, status as AttendeeStatus, eid).run()

        }

        const attendee = await env.DB.prepare('SELECT eid, name, email, department, status, created_at FROM attendees WHERE eid = ?').bind(eid).first<Attendee>()

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

          `SELECT a.eid, a.name, a.email, a.department, a.status,

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

      const eid = body.eid.trim(); const attendee = await env.DB.prepare("SELECT eid, name, email, department, status FROM attendees WHERE eid = ?").bind(eid).first<{ eid: string; name: string; email: string; department: string; status: AttendeeStatus }>()

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

      if (!token && !eidInput) return json({ error: 'Provide a QR token or employee ID' }, 400)

      const attendee = token

        ? await env.DB.prepare("SELECT a.eid, a.name, a.email, a.department, a.status FROM wristbands w JOIN attendees a ON a.eid = w.attendee_eid WHERE w.qr_token = ? AND w.status = 'Assigned'").bind(token).first<{ eid: string; name: string; email: string; department: string; status: AttendeeStatus }>()

        : await env.DB.prepare('SELECT eid, name, email, department, status FROM attendees WHERE eid = ?').bind(eidInput).first<{ eid: string; name: string; email: string; department: string; status: AttendeeStatus }>()

      if (!attendee) return json({ error: token ? 'QR wristband not found or no longer valid' : 'Attendee not found' }, 404)

      if (attendee.status !== 'Registered') return json({ error: `Cannot check in an attendee with status ${attendee.status}` }, 400)

      const already = await env.DB.prepare('SELECT checked_in_at FROM attendee_checkins WHERE attendee_eid = ?').bind(attendee.eid).first<{ checked_in_at: string }>()

      if (already) return json({ error: `Already checked in at ${already.checked_in_at}` }, 409)

      const checkinId = crypto.randomUUID()

      try { await env.DB.prepare('INSERT INTO attendee_checkins (id, attendee_eid, checked_in_by, method) VALUES (?, ?, ?, ?)').bind(checkinId, attendee.eid, staff.id, token ? 'QR' : 'EID').run() }

      catch { return json({ error: 'This attendee has already been checked in' }, 409) }

      const checked = await env.DB.prepare('SELECT checked_in_at FROM attendee_checkins WHERE attendee_eid = ?').bind(attendee.eid).first<{ checked_in_at: string }>()

      return json({ ok: true, attendee: { ...attendee, checked_in_at: checked?.checked_in_at ?? new Date().toISOString() } }, 201)

    }

    if (apiPath === '/api/checkins' && request.method === 'GET') {

      if (!canCheckin(staff.role) && staff.role !== 'viewer') return json({ error: 'You do not have permission to view check-ins' }, 403)

      try { const result = await env.DB.prepare('SELECT c.attendee_eid AS eid, a.name, a.department, c.checked_in_at, c.checked_in_by, c.method FROM attendee_checkins c JOIN attendees a ON a.eid = c.attendee_eid ORDER BY c.checked_in_at DESC').all(); return json({ ok: true, checkins: result.results }) }

      catch { return json({ error: 'Could not load check-ins' }, 500) }

    }

    return json({ error: 'Not found' }, 404)

  },

} satisfies ExportedHandler<Env>
