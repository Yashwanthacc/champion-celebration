import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import QRCode from 'qrcode'
import * as XLSX from 'xlsx'

import { Html5Qrcode } from 'html5-qrcode'

import './App.css'

type Staff = {

  id: string

  staffId: string

  role: string

}

type LoginResponse = {

  ok?: boolean

  staff?: Staff

  error?: string

}

type Attendee = {

  eid: string

  name: string

  email: string

  project?: string | null
  contact_number?: string | null
  family_emergency_contact_number?: string | null
  colleague_emergency_contact_number?: string | null
  project_lead?: string | null
  status: 'Registered' | 'Pending' | 'Cancelled'

}

type RegistrationFilter = 'All' | Attendee['status']
type MyPmoEmployee = {
  roster_type?: 'ASPIRE' | 'IX'
  resource_status?: string | null
  enterprise_id: string
  full_name: string
  email: string
  contact_number: string | null
  project: string | null
  project_lead: string | null
}

type EmergencyLookupResult = {
  found?: boolean
  registered?: boolean
  error?: string
  message?: string
  attendee?: {
    eid?: string | null; name?: string | null; email?: string | null
    contact_number?: string | null; family_emergency_contact_number?: string | null
    colleague_emergency_contact_number?: string | null; project?: string | null
    project_lead?: string | null; status?: string | null; registration_source?: string | null
    checked_in_at?: string | null
  } | null
  band?: { serial?: string | null; status?: string | null; assigned_at?: string | null; checked_in_at?: string | null } | null
  mypmo?: Array<{ roster_type?: string; enterprise_id?: string; full_name?: string; email?: string; project?: string | null; project_lead?: string | null; resource_status?: string | null }>
}
type Wristband = { eid: string; name: string; email: string; project: string; status: Attendee['status']; qr_token: string; band_status: string; checked_in_at?: string | null }

type CheckinResult = { ok?: boolean; error?: string; attendee?: { eid: string; name: string; email: string; project: string; status: Attendee['status']; checked_in_at: string } }

type OperationsAssignment = {
  action?: string | null
  attendee_name?: string | null
  eid?: string | null
  serial?: string | null
  staff_id?: string | null
  performed_at?: string | null
}

type OperationsCheckin = {
  attendee_name?: string | null
  eid?: string | null
  serial?: string | null
  method?: string | null
  staff_id?: string | null
  checked_in_at?: string | null
}

type OperationsAwaitingCheckin = {
  attendee_name?: string | null
  eid?: string | null
  serial?: string | null
  assigned_at?: string | null
}

type OperationsDashboard = {
  generatedAt?: string | null
  counts: {
    preEventRegistrations?: number
    liveRegistrations?: number
    registeredAttendees?: number
    totalCheckins?: number
    availableBands?: number
    assignedBands?: number
    checkedInBands?: number
    revokedBands?: number
    attendeesWithoutBands?: number
    pendingAttendees?: number
  }
  assignments?: OperationsAssignment[]
  checkins?: OperationsCheckin[]
  awaitingCheckin?: OperationsAwaitingCheckin[]
  error?: string
}

const initialDemoAttendees: Attendee[] = []

function formatIndiaDateTime(value?: string | null): string {
  if (!value) return '—'

  // SQLite CURRENT_TIMESTAMP is UTC but may not include a timezone suffix.
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(' ', 'T')}Z`
    : value
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(date)
}

function App() {

  const [staffId, setStaffId] = useState('')

  const [password, setPassword] = useState('')

  const [showPassword, setShowPassword] = useState(false)

  const [message, setMessage] = useState('')

  const [isLoading, setIsLoading] = useState(false)

  const [signedInStaff, setSignedInStaff] = useState<Staff | null>(null)

  const [activePage, setActivePage] = useState('home')
  const [operationsDashboard, setOperationsDashboard] = useState<OperationsDashboard | null>(null)
  const [operationsDashboardError, setOperationsDashboardError] = useState('')
  const [operationsDashboardBusy, setOperationsDashboardBusy] = useState(false)
  const [operationsDashboardSearch, setOperationsDashboardSearch] = useState('')

  const loadOperationsDashboard = useCallback(async () => {
    if (signedInStaff?.role !== 'admin') return
    setOperationsDashboardBusy(true)
    try {
      const response = await fetch('/api/admin/operations-dashboard', { credentials: 'same-origin' })
      const data = await response.json() as OperationsDashboard & { error?: string }
      if (!response.ok) throw new Error(data.error || 'Could not load operations dashboard')
      setOperationsDashboard(data)
      setOperationsDashboardError('')
    } catch (error) {
      setOperationsDashboardError(error instanceof Error ? error.message : 'Could not load operations dashboard')
    } finally {
      setOperationsDashboardBusy(false)
    }
  }, [signedInStaff?.role])

  const downloadAuditLogs = useCallback(async () => {
    if (signedInStaff?.role !== 'admin') return
    try {
      const response = await fetch('/api/admin/audit-logs', { credentials: 'same-origin' })
      if (!response.ok) {
        let errorMessage = 'Could not download audit logs'
        try {
          const data = await response.json() as { error?: string }
          if (data.error) errorMessage = data.error
        } catch {
          // Keep the generic error if the server did not return JSON.
        }
        throw new Error(errorMessage)
      }
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = 'champion-celebration-audit-logs.csv'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    } catch (error) {
      setOperationsDashboardError(error instanceof Error ? error.message : 'Could not download audit logs')
    }
  }, [signedInStaff?.role])

  // Refresh the admin operations dashboard while it is visible.
  useEffect(() => {
    if (signedInStaff?.role !== 'admin' || activePage !== 'operations') return
    // Defer the initial refresh until after the effect completes.
    const initialRefresh = window.setTimeout(() => {
      void loadOperationsDashboard()
    }, 0)
    const timer = window.setInterval(() => {
      void loadOperationsDashboard()
    }, 5000)
    return () => {
      window.clearTimeout(initialRefresh)
      window.clearInterval(timer)
    }
  }, [signedInStaff?.role, activePage, loadOperationsDashboard])
  const [mypmoFile, setMypmoFile] = useState<File | null>(null)
  const [mypmoRoster, setMypmoRoster] = useState<'ASPIRE' | 'IX'>('ASPIRE')
  const [mypmoUploadBusy, setMypmoUploadBusy] = useState(false)
  const [mypmoUploadMessage, setMypmoUploadMessage] = useState('')
  const [mypmoUploadError, setMypmoUploadError] = useState('')
  const [mypmoEid, setMypmoEid] = useState('')
  const [mypmoLookupBusy, setMypmoLookupBusy] = useState(false)
  const [mypmoLookupMessage, setMypmoLookupMessage] = useState('')
  const [mypmoLookupError, setMypmoLookupError] = useState('')
  const [mypmoEmployee, setMypmoEmployee] = useState<MyPmoEmployee | null>(null)
  type EmployeeImportRow = {
    eid: string
    roster_type: '' | 'ASPIRE' | 'IX'
    name: string
    email: string
    contact_number: string
    family_emergency_contact_number: string
    colleague_emergency_contact_number: string
    project: string
    project_lead: string
    valid: boolean
    issue: string
  }
  const [employeeImportRows, setEmployeeImportRows] = useState<EmployeeImportRow[]>([])
  const [employeeImportError, setEmployeeImportError] = useState('')
  const [employeeImportMessage, setEmployeeImportMessage] = useState('')
  const [employeeImportConfirmed, setEmployeeImportConfirmed] = useState(false)
  const [employeeImportBusy, setEmployeeImportBusy] = useState(false)

  async function handleEmployeeImportSubmit() {
    const validRows = employeeImportRows.filter((row) => row.valid)
    if (!employeeImportConfirmed || validRows.length === 0 || employeeImportBusy) return

    setEmployeeImportBusy(true)
    setEmployeeImportError('')
    setEmployeeImportMessage('Importing employee records...')

    try {
      const attendees = validRows.map((row) => ({
        eid: row.eid,
        roster_type: row.roster_type || undefined,
        name: row.name,
        email: row.email,
        project: row.project,
        contact_number: row.contact_number,
        family_emergency_contact_number: row.family_emergency_contact_number,
        colleague_emergency_contact_number: row.colleague_emergency_contact_number,
        project_lead: row.project_lead,
      }))
      const approvedMissingEids: string[] = []
      let response: Response
      let result: {
        ok?: boolean
        error?: string
        inserted?: number
        skipped?: number
        missingEmployees?: Array<{ eid: string; name?: string; email?: string; project?: string; roster_type?: string }>
      }

      // First request validates the whole batch and reports MyPMO misses without inserting anything.
      response = await fetch('/api/admin/employee-prereg/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ attendees, approvedMissingEids }),
      })
      result = await response.json() as typeof result

      if (response.status === 409 && Array.isArray(result.missingEmployees)) {
        const missing = result.missingEmployees
        const rejected = new Set<string>()
        for (const employee of missing) {
          const displayName = employee.name?.trim() || employee.eid
          const displayEmail = employee.email?.trim() || '(no email provided)'
          const displayProject = employee.project?.trim() || '(no project provided)'
          const allow = window.confirm(
            `${displayName} (${displayEmail}) was not found in MyPMO${employee.roster_type ? ` in the ${employee.roster_type} roster` : ''}.\n\nProject: ${displayProject}\n\nDo you want to import this employee using the Microsoft Forms spreadsheet details?`
          )
          if (allow) approvedMissingEids.push(employee.eid.toLowerCase())
          else rejected.add(employee.eid.toLowerCase())
        }

        const approvedAttendees = attendees.filter((row) => !rejected.has(row.eid.toLowerCase()))
        if (approvedAttendees.length === 0) {
          setEmployeeImportMessage('Import cancelled: all employees missing from MyPMO were skipped. No records were imported.')
          setEmployeeImportConfirmed(false)
          return
        }

        response = await fetch('/api/admin/employee-prereg/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            attendees: approvedAttendees,
            approvedMissingEids: approvedMissingEids.filter((eid) => !rejected.has(eid)),
          }),
        })
        result = await response.json() as typeof result
      }

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Employee import failed.')
      }

      setEmployeeImportMessage(
        `Import completed: ${result.inserted ?? 0} inserted, ${result.skipped ?? 0} skipped.`
      )
      setEmployeeImportConfirmed(false)
      await loadAttendees()
    } catch (error) {
      setEmployeeImportError(
        error instanceof Error ? error.message : 'Import failed. Please try again.'
      )
      setEmployeeImportMessage('')
    } finally {
      setEmployeeImportBusy(false)
    }
  }
  function normalizeImportHeader(value: unknown): string {
    return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
  }

  function handleEmployeeImportFile(file: File) {
    setEmployeeImportRows([])
    setEmployeeImportError('')
    setEmployeeImportMessage('')
    setEmployeeImportConfirmed(false)

    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!extension || !['xlsx', 'xls', 'csv'].includes(extension)) {
      setEmployeeImportError('Choose an Excel (.xlsx or .xls) or CSV (.csv) file.')
      return
    }

    void (async () => {
      try {
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]

        if (!firstSheet) {
          setEmployeeImportError('The selected file does not contain a worksheet.')
          return
        }

        const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
          defval: '',
          raw: false,
        })

        if (records.length === 0) {
          setEmployeeImportError('No employee records were found in the first worksheet.')
          return
        }

        const usedEids = new Set<string>()
        const usedEmails = new Set<string>()

        const mappedRows: EmployeeImportRow[] = records.map((record) => {
          const headers = new Map<string, unknown>()
          Object.entries(record).forEach(([key, value]) => {
            headers.set(normalizeImportHeader(key), value)
          })

          const pick = (names: string[]): string => {
            for (const name of names) {
              const value = headers.get(name)
              if (value !== undefined && String(value).trim() !== '') {
                return String(value).trim()
              }
            }
            return ''
          }

          const eid = pick(['eid', 'employeeid', 'enterpriseid', 'employeeidnumber'])
          const rosterRaw = pick(['rostertype', 'roster', 'mypmoroster']).toUpperCase()
          const roster_type: '' | 'ASPIRE' | 'IX' = rosterRaw === 'ASPIRE' || rosterRaw === 'IX' ? rosterRaw : ''
          const name = pick(['name', 'fullname', 'employeename', 'respondentname'])
          const email = pick(['email', 'emailaddress', 'workemail', 'officialemail'])
          const project = pick(['project', 'projectname'])
          const contact = pick(['contactnumber', 'phonenumber', 'mobile', 'mobilenumber', 'phone'])
          const familyEmergency = pick([
            'familyemergencycontactnumber',
            'familyemergencycontact',
            'emergencycontactnumber',
            'emergencycontact',
          ])
          const colleagueEmergency = pick([
            'colleagueemergencycontactnumber',
            'colleagueemergencycontact',
          ])
          const projectLead = pick(['projectlead', 'projectmanager', 'leadname'])

          const issues: string[] = []
          if (rosterRaw && rosterRaw !== 'ASPIRE' && rosterRaw !== 'IX') issues.push('Roster must be ASPIRE or IX')
          const normalizedEid = eid.toLowerCase()
          const normalizedEmail = email.toLowerCase()

          if (!eid) issues.push('Missing Employee ID')
          if (!name) issues.push('Missing name')
          if (!email) {
            issues.push('Missing email')
          } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            issues.push('Invalid email')
          }
          if (!project) issues.push('Missing project')

          if (eid && usedEids.has(normalizedEid)) issues.push('Duplicate Employee ID in file')
          if (email && usedEmails.has(normalizedEmail)) issues.push('Duplicate email in file')

          if (eid) usedEids.add(normalizedEid)
          if (email) usedEmails.add(normalizedEmail)

          return {
            eid,
            roster_type,
            name,
            email,
            contact_number: contact,
            family_emergency_contact_number: familyEmergency,
            colleague_emergency_contact_number: colleagueEmergency,
            project,
            project_lead: projectLead,
            valid: issues.length === 0,
            issue: issues.join('; '),
          }
        })

        setEmployeeImportRows(mappedRows)
        setEmployeeImportMessage(
          'Preview ready: ' + mappedRows.length + ' row(s), ' +
          mappedRows.filter((row) => row.valid).length + ' valid and ' +
          mappedRows.filter((row) => !row.valid).length + ' needing correction.'
        )
      } catch (error) {
        console.error('Employee import preview failed:', error)
        setEmployeeImportError('Unable to read this file. Check that it is a valid Excel or CSV file.')
      }
    })()
  }
  const [inventoryCount, setInventoryCount] = useState('1500')
  const [inventoryStart, setInventoryStart] = useState('1')
  const [inventoryPrefix, setInventoryPrefix] = useState('ACC')
  const [inventorySerial, setInventorySerial] = useState('')
  const [inventoryEid, setInventoryEid] = useState('')
  const [inventoryPrintStart, setInventoryPrintStart] = useState('1')
  const [inventoryPrintCount, setInventoryPrintCount] = useState('50')
  const [inventoryMessage, setInventoryMessage] = useState('')
  const [inventoryError, setInventoryError] = useState('')
  const [inventoryCounts, setInventoryCounts] = useState({available:0,assigned:0,checkedIn:0,revoked:0,total:0})
  const [inventoryBands, setInventoryBands] = useState<Array<{serial:string;status:string;attendee_eid:string|null;name:string|null}>>([])
  const [inventorySearch, setInventorySearch] = useState('')
  const [inventoryBusy, setInventoryBusy] = useState(false)

  const [attendees, setAttendees] = useState<Attendee[]>(initialDemoAttendees)

  const [isSavingAttendee, setIsSavingAttendee] = useState(false)

  const [isLoadingAttendees, setIsLoadingAttendees] = useState(false)

  const [searchTerm, setSearchTerm] = useState('')

  const [registrationFilter, setRegistrationFilter] = useState<RegistrationFilter>('All')

  const [showAttendeeForm, setShowAttendeeForm] = useState(false)

  const [editingAttendee, setEditingAttendee] = useState<Attendee | null>(null)

  const [isUpdatingAttendee, setIsUpdatingAttendee] = useState(false)

  const [editName, setEditName] = useState('')

  const [editEmail, setEditEmail] = useState('')

  const [editProject, setEditProject] = useState('')
  const [editContactNumber, setEditContactNumber] = useState('')
  const [editFamilyEmergency, setEditFamilyEmergency] = useState('')
  const [editColleagueEmergency, setEditColleagueEmergency] = useState('')
  const [editPeopleLead, setEditPeopleLead] = useState('')

  const [editStatus, setEditStatus] = useState<Attendee['status']>('Registered')

  const [attendeeMessage, setAttendeeMessage] = useState('')

  const [attendeeFormError, setAttendeeFormError] = useState('')

  const [newEid, setNewEid] = useState('')

  const [newName, setNewName] = useState('')

  const [newEmail, setNewEmail] = useState('')

  const [newProject, setNewProject] = useState('')
  const [newContactNumber, setNewContactNumber] = useState('')
  const [newEmergencyContact, setNewEmergencyContact] = useState('')
  const [newColleagueContact, setNewColleagueContact] = useState('')
  const [newPeopleLead, setNewPeopleLead] = useState('')
  const [attendeeLookupMessage, setAttendeeLookupMessage] = useState('')
  const [attendeeLookupBusy, setAttendeeLookupBusy] = useState(false)

  const [wristbands, setWristbands] = useState<Wristband[]>([])

  const [wristbandImages, setWristbandImages] = useState<Record<string, string>>({})

  const [isLoadingWristbands, setIsLoadingWristbands] = useState(false)

  const [checkinInput, setCheckinInput] = useState('')

  const [checkinMessage, setCheckinMessage] = useState('')

  const [checkinError, setCheckinError] = useState('')

  const [isCheckingIn, setIsCheckingIn] = useState(false)

  const [scannerRunning, setScannerRunning] = useState(false)

  const scannerRef = useRef<Html5Qrcode | null>(null)
  const emergencyScannerRef = useRef<Html5Qrcode | null>(null)
  const [emergencyQuery, setEmergencyQuery] = useState('')
  const [emergencyBusy, setEmergencyBusy] = useState(false)
  const [emergencyScannerRunning, setEmergencyScannerRunning] = useState(false)
  const [emergencyError, setEmergencyError] = useState('')
  const [emergencyMessage, setEmergencyMessage] = useState('')
  const [emergencyResult, setEmergencyResult] = useState<EmergencyLookupResult | null>(null)

  const [checkedInAttendee, setCheckedInAttendee] = useState<CheckinResult['attendee'] | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {

    event.preventDefault()

    if (isLoading) return

    setIsLoading(true)

    setMessage('Signing in...')

    try {

      const response = await fetch('/api/login', {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        credentials: 'same-origin',

        body: JSON.stringify({ staffId: staffId.trim(), password }),

      })

      const result = (await response.json()) as LoginResponse

      if (!response.ok || !result.ok || !result.staff) {

        setSignedInStaff(null)

        setMessage(result.error || 'Sign-in failed. Please check your credentials.')

        return

      }

      setSignedInStaff(result.staff)

      setActivePage('home')

      setPassword('')

      setMessage('')

    } catch {

      setSignedInStaff(null)

      setMessage('Unable to connect to the server. Please check that the backend is running.')

    } finally {

      setIsLoading(false)

    }

  }

  function resetAttendeeForm() {

    setNewEid('')

    setNewName('')

    setNewEmail('')

    setNewProject('')
    setNewContactNumber('')
    setNewEmergencyContact('')
    setNewColleagueContact('')
    setNewPeopleLead('')

    setAttendeeFormError('')

  }

  async function handleAttendeeEidLookup(value: string) {
    const eid = value.trim()
    setAttendeeLookupMessage('')
    if (!eid) return
    setAttendeeLookupBusy(true)
    try {
      const fetchLookup = async (roster?: string) => {
        const suffix = roster ? `&roster=${roster}` : ''
        const response = await fetch(`/api/mypmo/lookup?eid=${encodeURIComponent(eid)}${suffix}`, {
          credentials: 'same-origin', headers: { Accept: 'application/json' },
        })
        return { response, result: await response.json() as {
          found?: boolean; ambiguous?: boolean; employee?: MyPmoEmployee
          matches?: MyPmoEmployee[]; message?: string; error?: string
        } }
      }
      let { response, result } = await fetchLookup()
      if (result.ambiguous && result.matches?.length) {
        const choice = window.prompt('This Enterprise ID exists in both MyPMO rosters. Type ASPIRE or IX to choose the correct roster.')
        const roster = choice?.trim().toUpperCase()
        if (roster !== 'ASPIRE' && roster !== 'IX') {
          setAttendeeLookupMessage('Both Aspire and IX records exist. Lookup cancelled; choose ASPIRE or IX when prompted.')
          return
        }
        ;({ response, result } = await fetchLookup(roster))
      }
      if (!response.ok || !result.found || !result.employee) {
        setAttendeeLookupMessage(result.message || 'Enterprise ID not found in MyPMO. Enter the details manually.')
        return
      }
      setNewEid(result.employee.enterprise_id)
      setNewName(result.employee.full_name)
      setNewEmail(result.employee.email)
      setNewProject(result.employee.project || '')
      setNewContactNumber('')
      setNewPeopleLead(result.employee.project_lead || '')
      setAttendeeLookupMessage(`Employee details filled from ${result.employee.roster_type === 'IX' ? 'Roche IX' : 'Roche Aspire'} MyPMO. Please verify before saving.`)
    } catch {
      setAttendeeLookupMessage('Could not reach MyPMO. You can enter the details manually.')
    } finally {
      setAttendeeLookupBusy(false)
    }
  }
  async function handleAddAttendee(event: FormEvent<HTMLFormElement>) {

    event.preventDefault()

    if (isSavingAttendee) return

    setAttendeeFormError('')

    setAttendeeMessage('')

    const eid = newEid.trim()

    const name = newName.trim()

    const email = newEmail.trim().toLowerCase()

    const project = newProject.trim()
    const contactNumber = newContactNumber.trim()
    const emergencyContact = newEmergencyContact.trim()
    const colleagueContact = newColleagueContact.trim()
    const peopleLead = newPeopleLead.trim()

    if (!eid || !name || !email || !project || !contactNumber || !emergencyContact || !colleagueContact || !peopleLead) {

      setAttendeeFormError('Please complete all fields.')

      return

    }

    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!validEmail.test(email)) {

      setAttendeeFormError('Please enter a valid email address.')

      return

    }

    if (attendees.some((attendee) => attendee.eid.toLowerCase() === eid.toLowerCase())) {

      setAttendeeFormError('That Employee ID already exists. Please use a unique ID.')

      return

    }

    if (attendees.some((attendee) => attendee.email.toLowerCase() === email)) {

      setAttendeeFormError('That email address already exists.')

      return

    }

    setIsSavingAttendee(true)

    try {

      const response = await fetch('/api/attendees', {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        credentials: 'same-origin',

        body: JSON.stringify({ eid, name, email, project, contact_number: contactNumber, family_emergency_contact_number: emergencyContact, colleague_emergency_contact_number: colleagueContact, project_lead: peopleLead, status: 'Registered' }),

      })

      const result = (await response.json()) as {

        ok?: boolean

        attendee?: Attendee

        error?: string

      }

      if (!response.ok || !result.ok || !result.attendee) {

        if (response.status === 401) {

          setAttendeeFormError('Your session has expired. Please sign in again.')

        } else {

          setAttendeeFormError(result.error || 'Could not save attendee. Please try again.')

        }

        return

      }

      setAttendees((current) => [

        result.attendee!,

        ...current.filter((attendee) => attendee.eid !== result.attendee!.eid),

      ])

      setSearchTerm('')

      setRegistrationFilter('All')

      resetAttendeeForm()

      setShowAttendeeForm(false)

      setAttendeeMessage(`${name} was saved successfully.`)

    } catch {

      setAttendeeFormError('Unable to connect to the server. Check that the backend is running.')

    } finally {

      setIsSavingAttendee(false)

    }

  }

  function startEditingAttendee(attendee: Attendee) {

    setEditingAttendee(attendee)

    setEditName(attendee.name)

    setEditEmail(attendee.email)

    setEditProject(attendee.project || '')
    setEditContactNumber(attendee.contact_number ?? '')
    setEditFamilyEmergency(attendee.family_emergency_contact_number ?? '')
    setEditColleagueEmergency(attendee.colleague_emergency_contact_number ?? '')
    setEditPeopleLead(attendee.project_lead ?? '')

    setEditStatus(attendee.status)

    setAttendeeFormError('')

    setAttendeeMessage('')

    setShowAttendeeForm(false)

  }

  function cancelEditingAttendee() {

    setEditingAttendee(null)

    setEditName('')

    setEditEmail('')

    setEditProject('')
    setEditContactNumber('')
    setEditFamilyEmergency('')
    setEditColleagueEmergency('')
    setEditPeopleLead('')

    setEditStatus('Registered')

    setAttendeeFormError('')

  }

  async function handleEditAttendee(event: FormEvent<HTMLFormElement>) {

    event.preventDefault()

    if (!editingAttendee || isUpdatingAttendee) return

    setAttendeeFormError('')

    setAttendeeMessage('')

    const name = editName.trim()

    const email = editEmail.trim().toLowerCase()

    const project = editProject.trim()

    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!name || !email || !project) {

      setAttendeeFormError('Please complete all fields.')

      return

    }

    if (!validEmail.test(email)) {

      setAttendeeFormError('Please enter a valid email address.')

      return

    }

    if (attendees.some((attendee) =>

      attendee.eid !== editingAttendee.eid &&

      attendee.email.toLowerCase() === email

    )) {

      setAttendeeFormError('That email address already belongs to another attendee.')

      return

    }

    setIsUpdatingAttendee(true)

    try {

      const response = await fetch('/api/attendees', {

        method: 'PATCH',

        headers: { 'Content-Type': 'application/json' },

        credentials: 'same-origin',

        body: JSON.stringify({

          eid: editingAttendee.eid,

          name,

          email,

          project,
          contact_number: editContactNumber.trim(),
          family_emergency_contact_number: editFamilyEmergency.trim(),
          colleague_emergency_contact_number: editColleagueEmergency.trim(),
          project_lead: editPeopleLead.trim(),

          status: editStatus,

        }),

      })

      const result = (await response.json()) as {

        ok?: boolean

        attendee?: Attendee

        error?: string

      }

      if (!response.ok || !result.ok || !result.attendee) {

        setAttendeeFormError(

          response.status === 401

            ? 'Your session has expired. Please sign in again.'

            : result.error || 'Could not update attendee. Please try again.',

        )

        return

      }

      setAttendees((current) =>

        current.map((attendee) =>

          attendee.eid === result.attendee!.eid ? result.attendee! : attendee,

        ),

      )

      setAttendeeMessage(`${name}'s registration was updated successfully.`)

      cancelEditingAttendee()

    } catch {

      setAttendeeFormError('Unable to connect to the server. Check that the backend is running.')

    } finally {

      setIsUpdatingAttendee(false)

    }

  }

  async function loadAttendees() {

    setIsLoadingAttendees(true)

    setAttendeeFormError('')

    try {

      const response = await fetch('/api/attendees', {

        method: 'GET',

        credentials: 'same-origin',

        headers: { Accept: 'application/json' },

      })

      const result = (await response.json()) as {

        ok?: boolean

        attendees?: Attendee[]

        error?: string

      }

      if (!response.ok || !result.ok || !result.attendees) {

        setAttendeeFormError(

          response.status === 401

            ? 'Your session has expired. Please sign in again.'

            : result.error || 'Could not load attendees.',

        )

        return

      }

      setAttendees(result.attendees)

    } catch {

      setAttendeeFormError('Unable to load attendees. Check that the backend is running.')

    } finally {

      setIsLoadingAttendees(false)

    }

  }

  // On app startup, ask the backend whether this browser still has a valid session.

  useEffect(() => {

    let cancelled = false

    async function restoreSession() {

      try {

        const response = await fetch('/api/me', {

          method: 'GET',

          credentials: 'same-origin',

          headers: { Accept: 'application/json' },

        })

        if (!response.ok) return

        const result = (await response.json()) as LoginResponse

        if (!cancelled && result.ok && result.staff) {

          setSignedInStaff(result.staff)

        }

      } catch {

        // If the backend is unavailable, leave the sign-in screen available.

      }

    }

    void restoreSession()

    return () => {

      cancelled = true

    }

  }, [])

  useEffect(() => {
  if (!signedInStaff) return

  const timeoutId = window.setTimeout(() => {
    void loadAttendees()
  }, 0)

  return () => window.clearTimeout(timeoutId)
}, [signedInStaff])

  async function handleSignOut() {
    setMessage('')

    try {
      const response = await fetch('/api/logout', {
        method: 'POST',
        credentials: 'same-origin',
      })

      if (!response.ok) {
        setMessage('Sign out failed. Please try again.')
        return
      }

      setSignedInStaff(null)
      setActivePage('home')
      setStaffId('')
      setPassword('')
      setShowPassword(false)
      setMessage('')
      setSearchTerm('')
      setRegistrationFilter('All')
      setShowAttendeeForm(false)
      setEditingAttendee(null)
      setAttendeeMessage('')
      setAttendeeFormError('')
      setCheckinInput('')
      setCheckinMessage('')
      setCheckinError('')
      setCheckedInAttendee(null)
      await stopQrScanner()
    } catch {
      setMessage('Unable to contact the server. Please try again.')
    }
  }

  async function loadWristbands() {

    setIsLoadingWristbands(true)

    try {

      const response = await fetch('/api/wristbands', { credentials: 'same-origin' })

      const result = await response.json() as { ok?: boolean; wristbands?: Wristband[]; error?: string }

      if (!response.ok || !result.ok || !result.wristbands) throw new Error(result.error || 'Could not load wristbands.')

      setWristbands(result.wristbands)

      const images: Record<string, string> = {}

      await Promise.all(result.wristbands.map(async (band) => {

        // Build SVG directly from the QR matrix; no canvas/getContext is needed.

        const qr = QRCode.create(band.qr_token, { errorCorrectionLevel: 'M' })

        const size = qr.modules.size

        const quietZone = 4

        const fullSize = size + quietZone * 2

        let path = ''

        for (let row = 0; row < size; row += 1) {

          for (let col = 0; col < size; col += 1) {

            if (qr.modules.data[row * size + col]) {

              path += `M${col + quietZone},${row + quietZone}h1v1h-1z`

            }

          }

        }

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fullSize} ${fullSize}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000"/></svg>`

        images[band.eid] = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

      }))

      setWristbandImages(images)

    } catch (error) {

      setCheckinError(error instanceof Error ? error.message : 'Could not load wristbands.')

    } finally { setIsLoadingWristbands(false) }

  }

  async function assignWristband(eid: string) {

    setCheckinError(''); setCheckinMessage('')

    try {

      const response = await fetch('/api/wristbands', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eid }) })

      const result = await response.json() as { ok?: boolean; wristband?: Wristband; error?: string }

      if (!response.ok || !result.ok || !result.wristband) throw new Error(result.error || 'Could not create QR wristband.')

      setCheckinMessage(`QR wristband ready for ${result.wristband.name} (${eid}).`)

      await loadWristbands()

    } catch (error) { setCheckinError(error instanceof Error ? error.message : 'Could not create QR wristband.') }

  }

  async function stopEmergencyScanner() {
    const scanner = emergencyScannerRef.current
    if (!scanner) { setEmergencyScannerRunning(false); return }
    try { if (scanner.isScanning) await scanner.stop() }
    catch (error) { console.error('Could not stop emergency scanner:', error) }
    finally { emergencyScannerRef.current = null; setEmergencyScannerRunning(false) }
  }

  async function lookupEmergencyDetails(value = emergencyQuery) {
    const query = value.trim()
    if (!query || emergencyBusy) return
    setEmergencyBusy(true)
    setEmergencyError('')
    setEmergencyMessage('')
    setEmergencyResult(null)
    try {
      const response = await fetch(`/api/emergency/lookup?q=${encodeURIComponent(query)}`, { credentials: 'same-origin' })
      const result = await response.json() as EmergencyLookupResult
      if (!response.ok || !result.found) throw new Error(result.error || 'No matching attendee found.')
      setEmergencyResult(result)
      setEmergencyMessage(result.message || 'Lookup complete. No event data was changed.')
      setEmergencyQuery(query)
    } catch (error) {
      setEmergencyError(error instanceof Error ? error.message : 'Could not retrieve attendee details.')
    } finally { setEmergencyBusy(false) }
  }

  async function startEmergencyScanner() {
    setEmergencyError('')
    setEmergencyMessage('')
    if (emergencyScannerRef.current) return
    const scanner = new Html5Qrcode('cc-emergency-qr-reader')
    emergencyScannerRef.current = scanner
    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 230, height: 230 } },
        async (decodedText) => {
          await stopEmergencyScanner()
          setEmergencyQuery(decodedText)
          await lookupEmergencyDetails(decodedText)
        },
        () => undefined
      )
      setEmergencyScannerRunning(true)
    } catch (error) {
      emergencyScannerRef.current = null
      setEmergencyScannerRunning(false)
      setEmergencyError(error instanceof Error ? error.message : 'Camera could not start. Enter the band number manually.')
    }
  }

  async function submitCheckin(value = checkinInput, method: 'QR' | 'EID' = 'EID') {

    const clean = value.trim()

    if (!clean || isCheckingIn) return

    setIsCheckingIn(true)

    setCheckinError('')

    setCheckinMessage('')

    setCheckedInAttendee(null)

    try {

      const response = await fetch(method === 'QR' ? '/api/inventory/checkin' : '/api/checkin', {

        method: 'POST',

        credentials: 'same-origin',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify(method === 'QR' ? { serial: clean } : { eid: clean }),

      })

      const result = await response.json() as CheckinResult

      if (!response.ok || !result.ok || !result.attendee) {

        throw new Error(result.error || 'Check-in failed.')

      }

      setCheckedInAttendee(result.attendee)

      setCheckinMessage('Check-in successful.')

      setCheckinInput('')

    } catch (error) {

      setCheckinError(error instanceof Error ? error.message : 'Check-in failed.')

    } finally {

      setIsCheckingIn(false)

    }

  }

  async function stopQrScanner() {

    const scanner = scannerRef.current

    if (!scanner) {

      setScannerRunning(false)

      return

    }

    try {

      if (scanner.isScanning) await scanner.stop()

    } catch (error) {

      console.error('Could not stop QR scanner:', error)

    } finally {

      scannerRef.current = null

      setScannerRunning(false)

    }

  }

  async function startQrScanner() {

    setCheckinError('')

    setCheckinMessage('')

    setCheckedInAttendee(null)

    if (scannerRef.current) return

    const scanner = new Html5Qrcode('cc-qr-reader')

    scannerRef.current = scanner

    try {

      await scanner.start(

        { facingMode: 'environment' },

        { fps: 10, qrbox: { width: 230, height: 230 } },

        async (decodedText) => {

          await stopQrScanner()

          await submitCheckin(decodedText, 'QR')

        },

        () => undefined,

      )

      setScannerRunning(true)

    } catch (error) {

      scannerRef.current = null

      setScannerRunning(false)

      setCheckinError(error instanceof Error ? error.message : 'Camera could not start. Use manual EID or check camera permissions.')

    }

  }

  function printWristband(eid: string) {

    const image = wristbandImages[eid]

    const band = wristbands.find((item) => item.eid === eid)

    if (!image || !band) return

    const win = window.open('', '_blank', 'width=420,height=560')

    if (!win) { setCheckinError('Allow pop-ups to print the QR wristband.'); return }

    win.document.write(`<html><head><title>QR Wristband ${eid}</title><style>body{font-family:Arial;text-align:center;padding:24px}img{width:240px;height:240px}.id{font-size:22px;font-weight:bold} @media print{button{display:none}}</style></head><body><h2>CHAMPION CELEBRATION</h2><p>${band.name.replace(/[&<>"']/g,'')}</p><img src="${image}"/><p class="id">${eid}</p><p>Staff-only event QR</p><button onclick="window.print()">Print</button></body></html>`)

    win.document.close()

  }

  const filteredAttendees = useMemo(() => {

    const query = searchTerm.trim().toLowerCase()

    return attendees.filter((attendee) => {

      const matchesSearch =

        query === '' ||

        attendee.name.toLowerCase().includes(query) ||

        attendee.eid.toLowerCase().includes(query) ||

        attendee.email.toLowerCase().includes(query) ||

        (attendee.project || '').toLowerCase().includes(query)

      const matchesStatus = registrationFilter === 'All' || attendee.status === registrationFilter

      return matchesSearch && matchesStatus

    })

  }, [attendees, searchTerm, registrationFilter])

  const registeredCount = attendees.filter((attendee) => attendee.status === 'Registered').length

  const pendingCount = attendees.filter((attendee) => attendee.status === 'Pending').length

  const cancelledCount = attendees.filter((attendee) => attendee.status === 'Cancelled').length

  async function handleMyPmoUpload() {
    setMypmoUploadMessage('')
    setMypmoUploadError('')
    if (!mypmoFile) {
      setMypmoUploadError('Choose an Excel workbook first.')
      return
    }
    if (!/\.(xlsx|xls)$/i.test(mypmoFile.name)) {
      setMypmoUploadError('Choose an .xlsx or .xls workbook.')
      return
    }

    setMypmoUploadBusy(true)
    try {
      const form = new FormData()
      form.append('file', mypmoFile)
      form.append('roster', mypmoRoster)
      const response = await fetch('/api/mypmo/upload', {
        method: 'POST',
        credentials: 'same-origin',
        body: form,
      })
      const result = await response.json() as {
        ok?: boolean
        imported?: number
        message?: string
        error?: string
      }
      if (!response.ok || !result.ok) {
        throw new Error(result.error || result.message || 'Upload failed.')
      }
      setMypmoUploadMessage(
        result.message || `Imported ${result.imported ?? 0} employees successfully.`,
      )
      setMypmoFile(null)
      const input = document.getElementById('mypmo-file') as HTMLInputElement | null
      if (input) input.value = ''
    } catch (error) {
      setMypmoUploadError(error instanceof Error ? error.message : 'Upload failed.')
    } finally {
      setMypmoUploadBusy(false)
    }
  }

  async function handleMyPmoLookup() {
    const eid = mypmoEid.trim()
    setMypmoLookupMessage('')
    setMypmoLookupError('')
    setMypmoEmployee(null)
    if (!eid) { setMypmoLookupError('Enter an Enterprise ID.'); return }
    setMypmoLookupBusy(true)
    try {
      const fetchLookup = async (roster?: string) => {
        const response = await fetch(`/api/mypmo/lookup?eid=${encodeURIComponent(eid)}${roster ? `&roster=${roster}` : ''}`, {
          credentials: 'same-origin', headers: { Accept: 'application/json' },
        })
        return { response, result: await response.json() as {
          found?: boolean; ambiguous?: boolean; employee?: MyPmoEmployee
          matches?: MyPmoEmployee[]; message?: string; error?: string
        } }
      }
      let { response, result } = await fetchLookup()
      if (result.ambiguous && result.matches?.length) {
        const choice = window.prompt('This Enterprise ID exists in both MyPMO rosters. Type ASPIRE or IX to choose the correct roster.')
        const roster = choice?.trim().toUpperCase()
        if (roster !== 'ASPIRE' && roster !== 'IX') throw new Error('Both Aspire and IX records exist. Lookup cancelled; choose ASPIRE or IX when prompted.')
        ;({ response, result } = await fetchLookup(roster))
      }
      if (!response.ok || !result.found || !result.employee) throw new Error(result.message || result.error || 'Enterprise ID not found in MyPMO.')
      setMypmoEmployee(result.employee)
      setMypmoLookupMessage(`Employee found in ${result.employee.roster_type === 'IX' ? 'Roche IX' : 'Roche Aspire'} MyPMO.`)
    } catch (error) {
      setMypmoLookupError(error instanceof Error ? error.message : 'Lookup failed.')
    } finally {
      setMypmoLookupBusy(false)
    }
  }
  async function loadInventory() {
    setInventoryError(''); setInventoryMessage(''); setInventoryBusy(true)
    try { const r=await fetch('/api/inventory',{credentials:'same-origin'}); const d=await r.json(); if(!r.ok) throw new Error(d.error||'Could not load inventory'); setInventoryCounts(d.counts); setInventoryBands(d.bands||[]) } catch(e) { setInventoryError(e instanceof Error?e.message:'Could not load inventory') } finally { setInventoryBusy(false) }
  }
  async function inventoryAction(path:string, payload:Record<string,unknown>) {
    setInventoryError(''); setInventoryMessage(''); setInventoryBusy(true)
    try { const r=await fetch(path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); const d=await r.json(); if(!r.ok) throw new Error(d.error||'Request failed'); setInventoryMessage(path.endsWith('/generate')?`Generated ${d.generated} bands (${d.prefix}${String(d.start).padStart(3,'0')}-${d.prefix}${String(d.end).padStart(3,'0')}).`:path.endsWith('/assign')?`${d.serial} assigned to ${d.attendee.name}.`:`${d.serial} checked in: ${d.attendee.name}.`); await loadInventory() } catch(e) { setInventoryError(e instanceof Error?e.message:'Request failed') } finally { setInventoryBusy(false) }
  }

  async function printInventoryLabels() {
    setInventoryError('')
    setInventoryMessage('')
    const start = Number(inventoryPrintStart)
    const count = Number(inventoryPrintCount)
    if (!Number.isInteger(start) || start < 1 || !Number.isInteger(count) || count < 1 || count > 1700 || start + count - 1 > 999999) {
      setInventoryError('Enter a first number of at least 1 and a label count between 1 and 1700.')
      return
    }
    let printableBands: typeof inventoryBands
    try {
      const response = await fetch('/api/inventory?forPrint=1', { credentials: 'same-origin' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load bands for printing')
      printableBands = data.bands || []
    } catch (error) {
      setInventoryError(error instanceof Error ? error.message : 'Could not load bands for printing')
      return
    }
    const serials = new Set(Array.from({ length: count }, (_, index) => `${inventoryPrefix}${String(start + index).padStart(3, '0')}`))
    const bands = printableBands.filter((band) => serials.has(band.serial) && band.status === 'Available')
    if (!bands.length) {
      setInventoryError('No available wristbands found in this serial range. Refresh inventory or choose another range.')
      return
    }
    const labels = bands.map((band) => {
      const qr = QRCode.create(band.serial, { errorCorrectionLevel: 'M' })
      const size = qr.modules.size
      const quietZone = 4
      const fullSize = size + quietZone * 2
      let path = ''
      for (let row = 0; row < size; row += 1) {
        for (let col = 0; col < size; col += 1) {
          if (qr.modules.data[row * size + col]) path += `M${col + quietZone},${row + quietZone}h1v1h-1z`
        }
      }
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fullSize} ${fullSize}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000"/></svg>`
      return `<article class="label"><img alt="QR code ${band.serial}" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}"><div class="serial">${band.serial}</div><div class="caption">Champion Celebration</div></article>`
    }).join('')
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) {
      setInventoryError('Allow pop-ups for this site, then click Print QR labels again.')
      return
    }
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Inventory QR Labels</title><style>
      *{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;color:#111}
      .toolbar{padding:12px 18px;background:#f2f5fa;border-bottom:1px solid #d8deea;display:flex;gap:12px;align-items:center}
      .toolbar button{padding:10px 18px;font-size:14px;cursor:pointer}.sheet{padding:10mm;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5mm}
      .label{border:1px dashed #aaa;min-height:48mm;padding:4mm 2mm;display:flex;flex-direction:column;align-items:center;justify-content:center;break-inside:avoid;text-align:center}
      .label img{width:28mm;height:28mm;object-fit:contain}.serial{font-size:16pt;font-weight:700;letter-spacing:.5px;margin-top:2mm}.caption{font-size:8pt;margin-top:1mm;color:#444}
      @page{size:A4;margin:8mm}@media print{.toolbar{display:none}.sheet{padding:0;gap:3mm}.label{min-height:47mm}}
      </style></head><body><div class="toolbar"><strong>${bands.length} available QR labels</strong><button onclick="window.print()">Print labels</button><button onclick="window.close()">Close</button></div><main class="sheet">${labels}</main></body></html>`)
    win.document.close()
    setInventoryMessage(`Prepared ${bands.length} QR label(s). The QR contains only its wristband serial; already assigned or checked-in bands were excluded.`)
  }

  if (signedInStaff) {

    return (

      <main className="celebration dashboard-page">

        <nav className="topbar">

          <div className="brand">

            <span className="brand-mark">CC</span>

            <span>CHAMPION <strong>CELEBRATION</strong></span>

          </div>

          <div className="topbar-actions">
            <span className="event-label">STAFF PORTAL</span>
            {signedInStaff && <button className="topbar-signout" type="button" onClick={handleSignOut}>Sign out <span aria-hidden="true">-&gt;</span></button>}
          </div>

        </nav>

        <section className="dashboard-content">

          {activePage === 'home' && (
            <>
              <div className="dashboard-welcome cc-home-welcome">
                <div>
                  <p className="section-kicker">CHAMPION CELEBRATION</p>
                  <h1>Event<br /><span>workspace.</span></h1>
                  <p className="login-description">
                    One place to manage attendees, issue QR wristbands and check guests in.
                  </p>
                </div>
                <div className="dashboard-user">
                  <span className="user-avatar">{signedInStaff.staffId.slice(0, 2).toUpperCase()}</span>
                  <div><strong>{signedInStaff.staffId}</strong><p>{signedInStaff.role.toUpperCase()}</p></div>
                </div>
              </div>

              <section className="cc-event-workspace" aria-labelledby="cc-workspace-title">
                <div className="cc-workspace-heading">
                  <div>
                    <p className="section-kicker">EVENT OPERATIONS</p>
                    <h2 id="cc-workspace-title">What would you like to do?</h2>
                  </div>
                  <span className="dashboard-status"><span className="status-dot" />Signed in</span>
                </div>

                <button
                  className="cc-primary-action"
                  type="button"
                  onClick={() => {
                    setActivePage('checkin')
                    setCheckinError('')
                    setCheckinMessage('')
                    setCheckedInAttendee(null)
                  }}
                >
                  <span className="cc-primary-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="25" height="25" fill="currentColor"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM19 14h2v2h-2zM19 19h2v2h-2z"/></svg></span>
                  <span className="cc-primary-copy">
                    <strong>Scan QR / Check in</strong>
                    <span>Scan an attendee's wristband or enter their employee ID.</span>
                  </span>
                  <span className="cc-primary-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h15M13 5l7 7-7 7"/></svg></span>
                </button>

                <div className="cc-quick-actions" aria-label="Other event tasks">
                  <button type="button" className="cc-quick-action cc-emergency-action" onClick={() => { setActivePage('emergency'); setEmergencyError(''); setEmergencyMessage(''); setEmergencyResult(null); void stopQrScanner() }}>
                    <span className="cc-quick-icon cc-emergency-icon" aria-hidden="true">!</span>
                    <span><strong>Emergency Scanner</strong><small>Scan or enter a wristband number to view attendee and emergency contacts</small></span>
                    <span className="cc-quick-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h15M13 5l7 7-7 7"/></svg></span>
                  </button>
                  {(signedInStaff.role === 'admin' || signedInStaff.role === 'registration') && (<button type="button" className="cc-quick-action" onClick={() => { setActivePage('registration'); void loadAttendees() }}>
                    <span className="cc-quick-icon" aria-hidden="true">&#9776;</span>
                    <span><strong>Attendees</strong><small>Search and update registrations</small></span>
                    <span className="cc-quick-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h15M13 5l7 7-7 7"/></svg></span>
                  </button>)}
                  {/* QR wristband management is intentionally not a primary workflow in Option 2. */}
                  {(signedInStaff.role === 'admin' || signedInStaff.role === 'registration') && (
                    <button type="button" className="cc-quick-action" onClick={() => { setActivePage('mypmo'); setMypmoUploadMessage(''); setMypmoUploadError(''); setMypmoLookupMessage(''); setMypmoLookupError(''); setMypmoEmployee(null) }}>
                      <span className="cc-quick-icon" aria-hidden="true">&#9776;</span>
                      <span><strong>MyPMO</strong><small>Import employee data and look up an Enterprise ID</small></span>
                      <span className="cc-quick-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h15M13 5l7 7-7 7"/></svg></span>
                    </button>
                  )}                  {(signedInStaff.role === 'admin' || signedInStaff.role === 'registration') && (<button type="button" className="cc-quick-action" onClick={() => { setActivePage('inventory'); void loadInventory() }}>
                    <span className="cc-quick-icon" aria-hidden="true">&#9776;</span>
                    <span><strong>Band Inventory</strong><small>Assign a preprinted band to an attendee</small></span>
                    <span className="cc-quick-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h15M13 5l7 7-7 7"/></svg></span>
                  </button>)}

                {signedInStaff.role === 'admin' && (
                  <button type="button" className="cc-quick-action" onClick={() => setActivePage('operations')}>
                    <span className="cc-quick-icon" aria-hidden="true">&#9776;</span>
                    <span><strong>Operations Dashboard</strong><small>Live event activity, wristbands and check-ins</small></span>
                    <span className="cc-quick-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h15M13 5l7 7-7 7"/></svg></span>
                  </button>
                )}
                {signedInStaff.role === 'admin' && (
                  <button type="button" className="cc-quick-action" onClick={() => setActivePage('employee-prereg')}>
                    <span className="cc-quick-icon" aria-hidden="true">&#128203;</span>
                    <span><strong>Employee Pre-Registration</strong><small>Upload and validate Microsoft Forms responses</small></span>
                    <span className="cc-quick-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h15M13 5l7 7-7 7"/></svg></span>
                  </button>
                )}
                </div>

                <div className="cc-attendee-summary cc-dashboard-summary">
                  <div className="summary-saved"><span>Saved attendees</span><strong>{attendees.length}</strong></div>
                  <div className="summary-registered"><span>Registered</span><strong>{registeredCount}</strong></div>
                  <div className="summary-checkin"><span>Checked in</span><strong>0</strong></div>
                </div>
              </section>

              <div className="dashboard-notice">
                <span aria-hidden="true">i</span>
                <p><strong>Before the event</strong><br />Confirm attendee records, assign QR wristbands, then use Scan QR / Check in at the entrance.</p>
              </div>
            </>
          )}

          {activePage === 'emergency' && (
            <section className="cc-inventory-page cc-emergency-page">
              <button className="dashboard-signout" type="button" onClick={() => { void stopEmergencyScanner(); setActivePage('home') }}>&#8592; Back to workspace</button>
              <p className="section-kicker">EMERGENCY RESPONSE</p>
              <h1>Emergency <span>attendee lookup.</span></h1>
              <p className="login-description">Scan the QR on an assigned wristband or enter its serial number or the attendee's Enterprise ID. This is a read-only lookup and will not check anyone in.</p>
              <div className="cc-inventory-panel">
                <h2>Scan wristband QR</h2>
                <div id="cc-emergency-qr-reader" className="cc-qr-reader" />
                <div className="cc-scanner-controls">
                  <button className="add-attendee-button" type="button" disabled={emergencyScannerRunning} onClick={() => void startEmergencyScanner()}>{emergencyScannerRunning ? 'Camera running...' : 'Start emergency camera'}</button>
                  <button className="attendee-cancel-button" type="button" disabled={!emergencyScannerRunning} onClick={() => void stopEmergencyScanner()}>Stop camera</button>
                </div>
                <form className="cc-manual-checkin" onSubmit={event => { event.preventDefault(); void lookupEmergencyDetails() }}>
                  <label htmlFor="cc-emergency-query">Wristband serial or Enterprise ID</label>
                  <input id="cc-emergency-query" value={emergencyQuery} onChange={event => setEmergencyQuery(event.target.value)} placeholder="Scan or enter band number / EID" maxLength={200} required />
                  <button className="cc-primary-action" type="submit" disabled={emergencyBusy}>{emergencyBusy ? 'Searching...' : 'Find attendee details'}</button>
                </form>
                {emergencyError && <p className="attendee-form-error" role="alert">{emergencyError}</p>}
                {emergencyMessage && <p className="attendee-form-message" role="status">{emergencyMessage}</p>}
              </div>
              {emergencyResult && (
                <div className="cc-inventory-panel cc-emergency-result" aria-live="polite">
                  <h2>{emergencyResult.attendee?.name || emergencyResult.mypmo?.[0]?.full_name || 'Attendee record'}</h2>
                  {!emergencyResult.registered && <p className="attendee-form-message">Not registered for the event. The MyPMO information below is roster data only.</p>}
                  {emergencyResult.attendee && (
                    <div className="cc-emergency-details">
                      <p><strong>Full name</strong><span>{emergencyResult.attendee.name || 'Not available'}</span></p>
                      <p><strong>Enterprise ID</strong><span>{emergencyResult.attendee.eid || 'Not available'}</span></p>
                      <p><strong>Email</strong><span>{emergencyResult.attendee.email || 'Not available'}</span></p>
                      <p><strong>Contact number</strong><span>{emergencyResult.attendee.contact_number || 'Not available'}</span></p>
                      <p><strong>Family emergency contact</strong><span>{emergencyResult.attendee.family_emergency_contact_number || 'Not available'}</span></p>
                      <p><strong>Colleague emergency contact</strong><span>{emergencyResult.attendee.colleague_emergency_contact_number || 'Not available'}</span></p>
                      <p><strong>Project</strong><span>{emergencyResult.attendee.project || 'Not available'}</span></p>
                      <p><strong>Project lead</strong><span>{emergencyResult.attendee.project_lead || 'Not available'}</span></p>
                      <p><strong>Registration status</strong><span>{emergencyResult.attendee.status || 'Not available'}</span></p>
                      <p><strong>Registration source</strong><span>{emergencyResult.attendee.registration_source || 'Not available'}</span></p>
                      <p><strong>Check-in time</strong><span>{formatIndiaDateTime(emergencyResult.attendee.checked_in_at)}</span></p>
                    </div>
                  )}
                  <h3>Wristband</h3>
                  <div className="cc-emergency-details">
                    <p><strong>Serial number</strong><span>{emergencyResult.band?.serial || 'No band assigned'}</span></p>
                    <p><strong>Band status</strong><span>{emergencyResult.band?.status || 'Not available'}</span></p>
                    <p><strong>Assigned at</strong><span>{formatIndiaDateTime(emergencyResult.band?.assigned_at)}</span></p>
                    <p><strong>Band check-in time</strong><span>{formatIndiaDateTime(emergencyResult.band?.checked_in_at)}</span></p>
                  </div>
                  <h3>MyPMO matches</h3>
                  {!emergencyResult.mypmo?.length && <p>No matching MyPMO record.</p>}
                  {emergencyResult.mypmo?.map((employee, index) => (
                    <div className="cc-emergency-mypmo" key={`${employee.roster_type}-${employee.enterprise_id}-${index}`}>
                      <p><strong>Roster:</strong> {employee.roster_type === 'IX' ? 'Roche IX MyPMO' : 'Roche Aspire MyPMO'}</p>
                      <p><strong>Full name:</strong> {employee.full_name || 'Not available'}</p>
                      <p><strong>Enterprise ID:</strong> {employee.enterprise_id || 'Not available'}</p>
                      <p><strong>Email:</strong> {employee.email || 'Not available'}</p>
                      <p><strong>Project:</strong> {employee.project || 'Not available'}</p>
                      <p><strong>Project lead:</strong> {employee.project_lead || 'Not available'}</p>
                      <p><strong>Resource status:</strong> {employee.resource_status || 'Not available'}</p>
                    </div>
                  ))}
                  <p className="login-description">Emergency details are shown only to signed-in event staff. Lookup does not change attendee registration, wristband assignment, or check-in.</p>
                </div>
              )}
            </section>
          )}

          {activePage === 'employee-prereg' && signedInStaff.role === 'admin' && (
            <section className="cc-inventory-page">
              <button className="dashboard-signout" type="button" onClick={() => setActivePage('home')}>&#8592; Back to workspace</button>
              <p className="section-kicker">EMPLOYEE REGISTRATION</p>
              <h1>Employee Pre-Registration.</h1>
              <p className="login-description">Upload employee responses exported from Microsoft Forms. Review and validate the records before importing them.</p>
              <div className="cc-inventory-panel">
                <h2>Upload Microsoft Forms responses</h2>
                <p>Choose an Excel or CSV export and review validation results before importing. If an Enterprise ID exists in both Aspire and IX, add a column named <strong>Roster</strong> with <strong>ASPIRE</strong> or <strong>IX</strong> for that row. Otherwise, the roster column is optional.</p>
                <label htmlFor="employee-import-file">Microsoft Forms export (.xlsx, .xls, .csv)</label>
                <input
                  id="employee-import-file"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) handleEmployeeImportFile(file)
                  }}
                />

                {employeeImportError && <p className="attendee-form-error" role="alert">{employeeImportError}</p>}
                {employeeImportMessage && <p role="status">{employeeImportMessage}</p>}

                {employeeImportRows.length > 0 && (
                  <>
                    <p>
                      <strong>{employeeImportRows.filter((row) => row.valid).length}</strong> valid rows;{' '}
                      <strong>{employeeImportRows.filter((row) => !row.valid).length}</strong> need attention.
                    </p>
                    <div className="registration-table-wrap">
                      <table className="registration-table">
                        <thead>
                          <tr>
                            <th>Employee ID</th><th>Roster</th><th>Name</th><th>Email</th>
                            <th>Project</th><th>Contact</th>
                            <th>Project Lead</th><th>Validation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {employeeImportRows.map((row, index) => (
                            <tr key={`${row.eid}-${index}`}>
                              <td>{row.eid || '—'}</td>
                              <td>{row.roster_type || 'Auto'}</td>
                              <td>{row.name || '—'}</td>
                              <td>{row.email || '—'}</td>
                              <td>{row.project || '—'}</td>
                              <td>{row.contact_number || '—'}</td>
                              <td>{row.project_lead || '—'}</td>
                              <td>{row.valid ? 'Valid' : row.issue}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p><strong>Review before importing.</strong> Only valid rows will be submitted. Existing employee IDs or emails will be skipped. No wristbands will be assigned and no check-ins will be performed.</p>
                    <label>
                      <input
                        type="checkbox"
                        checked={employeeImportConfirmed}
                        disabled={employeeImportBusy || employeeImportRows.every((row) => !row.valid)}
                        onChange={(event) => setEmployeeImportConfirmed(event.target.checked)}
                      />
                      I confirm importing the valid employee rows shown above.
                    </label>
                    <button
                      type="button"
                      disabled={!employeeImportConfirmed || employeeImportBusy || employeeImportRows.every((row) => !row.valid)}
                      onClick={() => void handleEmployeeImportSubmit()}
                    >
                      {employeeImportBusy ? 'Importing...' : 'Submit Import'}
                    </button>
                  </>
                )}
              </div>
            </section>
          )}
          {activePage === 'mypmo' && (
            <section className="cc-inventory-page">
              <button className="dashboard-signout" type="button" onClick={() => setActivePage('home')}>&#8592; Back to workspace</button>
              <p className="section-kicker">EMPLOYEE DIRECTORY</p>
              <h1>MyPMO.</h1>
              <p className="login-description">Import the approved MyPMO workbook, then search by Enterprise ID.</p>

              {signedInStaff?.role === 'admin' && (
                <section className="cc-inventory-panel">
                  <h2>Import Excel workbook</h2>
                  <p>Accepted formats: .xlsx and .xls. Use approved data only.</p>
                  <label htmlFor="mypmo-roster">MyPMO roster
                    <select id="mypmo-roster" value={mypmoRoster} onChange={(event) => setMypmoRoster(event.target.value as 'ASPIRE' | 'IX')}>
                      <option value="ASPIRE">Roche Aspire MyPMO</option>
                      <option value="IX">Roche IX MyPMO</option>
                    </select>
                  </label>
                  <input id="mypmo-file" type="file" accept=".xlsx,.xls" onChange={(event) => { setMypmoFile(event.target.files?.[0] ?? null); setMypmoUploadMessage(''); setMypmoUploadError('') }} />
                  <button className="cc-primary-action" type="button" disabled={!mypmoFile || mypmoUploadBusy} onClick={() => void handleMyPmoUpload()}>
                    {mypmoUploadBusy ? 'Uploading...' : 'Upload MyPMO workbook'}
                  </button>
                  {mypmoUploadMessage && <p className="attendee-form-message" role="status">{mypmoUploadMessage}</p>}
                  {mypmoUploadError && <p className="attendee-form-error" role="alert">{mypmoUploadError}</p>}
                </section>
              )}

              <section className="cc-inventory-panel">
                <h2>Enterprise ID lookup</h2>
                <form onSubmit={(event) => { event.preventDefault(); void handleMyPmoLookup() }}>
                  <div className="cc-inventory-fields">
                    <label htmlFor="mypmo-eid">Enterprise ID
                      <input id="mypmo-eid" value={mypmoEid} onChange={(event) => setMypmoEid(event.target.value)} maxLength={100} placeholder="Enter Enterprise ID" required />
                    </label>
                  </div>
                  <button className="cc-primary-action" type="submit" disabled={mypmoLookupBusy}>
                    {mypmoLookupBusy ? 'Searching...' : 'Find employee'}
                  </button>
                </form>
                {mypmoLookupMessage && <p className="attendee-form-message" role="status">{mypmoLookupMessage}</p>}
                {mypmoLookupError && <p className="attendee-form-error" role="alert">{mypmoLookupError}</p>}
                {mypmoEmployee && (
                  <div className="cc-inventory-fields">
                    <p><strong>Roster:</strong> {mypmoEmployee.roster_type === 'IX' ? 'Roche IX MyPMO' : 'Roche Aspire MyPMO'}</p>\n                    <p><strong>Enterprise ID:</strong> {mypmoEmployee.enterprise_id}</p>
                    <p><strong>Full name:</strong> {mypmoEmployee.full_name}</p>
                    <p><strong>Email:</strong> {mypmoEmployee.email}</p>
                    <p><strong>Project:</strong> {mypmoEmployee.project || 'Not provided'}</p>
                    <p><strong>Project lead:</strong> {mypmoEmployee.project_lead || 'Not provided'}</p>
                    <p><strong>Resource status:</strong> {mypmoEmployee.resource_status || 'Not provided'}</p>
                  </div>
                )}
              </section>
            </section>
          )}
          {activePage === 'operations' && signedInStaff.role === 'admin' && (
  <section className="cc-inventory-page">
    <button className="dashboard-signout" type="button" onClick={() => setActivePage('home')}>&#8592; Back to workspace</button>
    <p className="section-kicker">ADMIN ONLY</p>
    <h1>Operations dashboard.</h1>
    <p className="login-description">Attendee, wristband assignment and check-in operations.</p>
        {operationsDashboardError && <div className="cc-error">{operationsDashboardError}</div>}
    <div style={{display:'flex',gap:'12px',alignItems:'center',flexWrap:'wrap',margin:'20px 0'}}>
      <button className="cc-primary-action" type="button" onClick={() => void loadOperationsDashboard()} disabled={operationsDashboardBusy}>
        {operationsDashboardBusy ? 'Refreshing...' : 'Refresh now'}
      </button>
      <button className="cc-primary-action" type="button" onClick={() => void downloadAuditLogs()}>
        Download audit CSV
      </button>
      <span>Auto-refreshes every 5 seconds</span>
      {operationsDashboard?.generatedAt && <span>Updated: {formatIndiaDateTime(operationsDashboard.generatedAt)}</span>}
    </div>
    {!operationsDashboard && !operationsDashboardError && <p>Loading live event data...</p>}
    {operationsDashboard && (
      <>
        <div className="cc-attendee-summary cc-dashboard-summary">
          <div className="summary-saved"><span>Pre-event registrations</span><strong>{operationsDashboard.counts.preEventRegistrations ?? 0}</strong></div>
          <div className="summary-registered"><span>Live registrations</span><strong>{operationsDashboard.counts.liveRegistrations ?? 0}</strong></div>
          <div className="summary-checkin"><span>Total registrations</span><strong>{operationsDashboard.counts.registeredAttendees ?? 0}</strong></div>
          <div className="summary-saved"><span>Successful check-ins</span><strong>{operationsDashboard.counts.totalCheckins ?? 0}</strong></div>
        </div>
        <div className="cc-attendee-summary cc-dashboard-summary">
          <div className="summary-saved"><span>Available bands</span><strong>{operationsDashboard.counts.availableBands ?? 0}</strong></div>
          <div className="summary-registered"><span>Assigned bands</span><strong>{operationsDashboard.counts.assignedBands ?? 0}</strong></div>
          <div className="summary-checkin"><span>Checked-in bands</span><strong>{operationsDashboard.counts.checkedInBands ?? 0}</strong></div>
          <div className="summary-saved"><span>Revoked bands</span><strong>{operationsDashboard.counts.revokedBands ?? 0}</strong></div>
        </div>
        <div className="cc-inventory-panel" style={{marginTop:'20px'}}>
          <h2>Attention required</h2>
          <p>Registered attendees without an inventory band: <strong>{operationsDashboard.counts.attendeesWithoutBands ?? 0}</strong></p>
          <p>Assigned bands awaiting check-in: <strong>{(operationsDashboard.awaitingCheckin || []).length}</strong></p>
          <p>Pending registrations: <strong>{operationsDashboard.counts.pendingAttendees ?? 0}</strong></p>
        </div>
        <div className="cc-inventory-panel" style={{marginTop:'20px'}}>
          <h2>Search activity</h2>
          <input aria-label="Search dashboard activity" placeholder="Search attendee, EID, band serial or staff ID" value={operationsDashboardSearch} onChange={e => setOperationsDashboardSearch(e.target.value)} />
        </div>
        <div className="cc-inventory-panel" style={{marginTop:'20px',overflowX:'auto'}}>
          <h2>Band assignment and inventory audit</h2>
          <table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}>
            <thead><tr><th>Action</th><th>Attendee</th><th>EID</th><th>Band serial</th><th>Staff ID</th><th>Timestamp</th></tr></thead>
            <tbody>
              {(operationsDashboard.assignments || []).filter((item: OperationsAssignment) => [item.action,item.attendee_name,item.eid,item.serial,item.staff_id,item.performed_at].some(value => String(value ?? '').toLowerCase().includes(operationsDashboardSearch.toLowerCase()))).map((item: OperationsAssignment,index:number) => (
                <tr key={`${item.serial}-${item.performed_at}-${index}`}>
                  <td>{item.action}</td><td>{item.attendee_name || '—'}</td><td>{item.eid || '—'}</td><td>{item.serial}</td><td>{item.staff_id || '—'}</td><td>{item.performed_at ? formatIndiaDateTime(item.performed_at) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="cc-inventory-panel" style={{marginTop:'20px',overflowX:'auto'}}>
          <h2>Successful check-ins</h2>
          <table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}>
            <thead><tr><th>Attendee</th><th>EID</th><th>Band serial</th><th>Method</th><th>Staff ID</th><th>Timestamp</th></tr></thead>
            <tbody>
              {(operationsDashboard.checkins || []).filter((item: OperationsCheckin) => [item.attendee_name,item.eid,item.serial,item.method,item.staff_id,item.checked_in_at].some(value => String(value ?? '').toLowerCase().includes(operationsDashboardSearch.toLowerCase()))).map((item: OperationsCheckin,index:number) => (
                <tr key={`${item.eid}-${item.checked_in_at}-${index}`}>
                  <td>{item.attendee_name || '—'}</td><td>{item.eid}</td><td>{item.serial || '—'}</td><td>{item.method}</td><td>{item.staff_id || '—'}</td><td>{item.checked_in_at ? formatIndiaDateTime(item.checked_in_at) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="cc-inventory-panel" style={{marginTop:'20px',overflowX:'auto'}}>
          <h2>Assigned bands awaiting check-in</h2>
          <table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}>
            <thead><tr><th>Attendee</th><th>EID</th><th>Band serial</th><th>Assigned at</th></tr></thead>
            <tbody>
              {(operationsDashboard.awaitingCheckin || []).filter((item: OperationsAwaitingCheckin) => [item.attendee_name,item.eid,item.serial,item.assigned_at].some(value => String(value ?? '').toLowerCase().includes(operationsDashboardSearch.toLowerCase()))).map((item: OperationsAwaitingCheckin,index:number) => (
                <tr key={`${item.serial}-${index}`}>
                  <td>{item.attendee_name || '—'}</td><td>{item.eid}</td><td>{item.serial}</td><td>{item.assigned_at ? formatIndiaDateTime(item.assigned_at) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )}
  </section>
)}
          {activePage === 'inventory' && (
            <section className="cc-inventory-page">
              <button className="dashboard-signout" type="button" onClick={() => setActivePage('home')}>&#8592; Back to workspace</button>
              <p className="section-kicker">BAND INVENTORY</p><h1>Band inventory.</h1>
              <p className="login-description">Staff can assign an already printed band. Only administrators can generate serials, print QR labels, and view inventory records.</p>
              {inventoryError && (
                <div className="cc-error-modal-overlay" role="presentation">
                  <div
                    className="cc-error-modal"
                    role="alertdialog"
                    aria-modal="true"
                    aria-labelledby="cc-error-title"
                    aria-describedby="cc-error-message"
                  >
                    <div className="cc-error-modal-icon" aria-hidden="true">!</div>
                    <h2 id="cc-error-title">Action couldn't be completed</h2>
                    <p id="cc-error-message">{inventoryError}</p>
                    <button type="button" onClick={() => setInventoryError('')} autoFocus>
                      Got it
                    </button>
                  </div>
                </div>
              )}
              {inventoryMessage && (
                <div
                  className={`dashboard-notice cc-action-success ${
                    inventoryMessage.includes(' assigned to ')
                      ? 'cc-band-assigned'
                      : inventoryMessage.includes(' checked in: ')
                        ? 'cc-band-checked-in'
                        : ''
                  }`}
                  role="status"
                >
                  <span className="cc-success-icon" aria-hidden="true">OK</span>
                  <p>{inventoryMessage}</p>
                </div>
              )}
              <div className="cc-attendee-summary cc-inventory-summary">
                <div className="inventory-total"><span>Total bands</span><strong>{inventoryCounts.total}</strong></div>
                <div className="inventory-available"><span>Available</span><strong>{inventoryCounts.available}</strong></div>
                <div className="inventory-assigned"><span>Assigned</span><strong>{inventoryCounts.assigned}</strong></div>
                <div className="inventory-checked-in"><span>Checked in</span><strong>{inventoryCounts.checkedIn}</strong></div>
              </div>
              <div className="cc-inventory-workflow-grid">
              {signedInStaff.role === 'admin' && <section className="cc-inventory-panel"><h2>1. Generate serial inventory</h2><p>Generate up to 1,700 bands per batch. Existing serials are never overwritten.</p>
                <div className="cc-inventory-fields"><label>Prefix<input value={inventoryPrefix} onChange={e=>setInventoryPrefix(e.target.value.toUpperCase())} maxLength={8}/></label><label>First number<input type="number" min="1" value={inventoryStart} onChange={e=>setInventoryStart(e.target.value)}/></label><label>Number of bands<input type="number" min="1" max="1700" value={inventoryCount} onChange={e=>setInventoryCount(e.target.value)}/></label></div>
                <button className="cc-primary-action" disabled={inventoryBusy} type="button" onClick={()=>void inventoryAction('/api/inventory/generate',{prefix:inventoryPrefix,start:Number(inventoryStart),count:Number(inventoryCount)})}>{inventoryBusy?'Working...':'Generate inventory'}</button>
              </section>}
              {signedInStaff.role === 'admin' && <section className="cc-inventory-panel"><h2>Print QR labels</h2><p>Print QR labels for available bands in a serial range. This is part of Band Inventory, not a separate QR management page.</p>
                <div className="cc-inventory-fields"><label>First serial number<input type="number" min="1" max="999999" value={inventoryPrintStart} onChange={e=>setInventoryPrintStart(e.target.value)}/></label><label>Number of labels<input type="number" min="1" max="1700" value={inventoryPrintCount} onChange={e=>setInventoryPrintCount(e.target.value)}/></label></div>
                <button className="cc-primary-action" type="button" disabled={inventoryBusy} onClick={printInventoryLabels}>Preview / print QR labels</button>
              </section>}
              <section className="cc-inventory-panel"><h2>Assign a preprinted band</h2><p>Register walk-ins first in the Attendees screen. Scan/enter the printed serial and employee ID.</p>
                <div className="cc-inventory-fields"><label>Wristband serial<input placeholder="ACC057" value={inventorySerial} onChange={e=>setInventorySerial(e.target.value.toUpperCase())}/></label><label>Employee ID<input placeholder="Employee EID" value={inventoryEid} onChange={e=>setInventoryEid(e.target.value)}/></label></div>
                <button className="cc-primary-action" disabled={inventoryBusy||!inventorySerial.trim()||!inventoryEid.trim()} type="button" onClick={()=>void inventoryAction('/api/inventory/assign',{serial:inventorySerial,eid:inventoryEid})}>Assign band</button>
              </section>
              {signedInStaff.role === 'admin' && <section className="cc-inventory-panel"><h2>Inventory list</h2><div className="cc-inventory-fields"><label>Search serial number<input placeholder="ACC099" value={inventorySearch} onChange={e=>setInventorySearch(e.target.value.toUpperCase())}/></label><button type="button" className="dashboard-signout" onClick={()=>void loadInventory()}>Refresh</button></div>
                <div className="cc-inventory-table-wrap" style={{width:"100%", maxWidth:"100%", overflowX:"auto", display:"block"}}><table className="cc-inventory-table" style={{minWidth:"640px", width:"100%"}}><thead><tr><th>Serial</th><th>Status</th><th>Employee ID</th><th>Attendee</th></tr></thead><tbody>{inventoryBands.filter(b=>!inventorySearch||b.serial.includes(inventorySearch)).slice(0,10).map(b=><tr key={b.serial}><td>{b.serial}</td><td>{b.status}</td><td>{b.attendee_eid||'—'}</td><td>{b.name||'—'}</td></tr>)}</tbody></table></div><p className="login-description">Showing up to 10 latest inventory records.</p>
              </section>}
              </div>
            </section>
          )}

          {activePage === 'registration' && (

            <>

              <button className="dashboard-signout" type="button" onClick={() => setActivePage('home')}>&#8592; Back to workspace</button>

              <div className="dashboard-welcome">

                <div>

                  <p className="section-kicker">ATTENDEE MANAGEMENT</p><h1>Registration<br /><span>workspace.</span></h1>

                  <p className="login-description">Search attendees, add registrations, and review saved registration information.</p>

                </div>

                <div className="dashboard-user">

                  <span className="user-avatar">{signedInStaff.staffId.slice(0, 2).toUpperCase()}</span>

                  <div><strong>{signedInStaff.staffId}</strong><p>{signedInStaff.role.toUpperCase()}</p></div>

                </div>

              </div>


              {attendeeMessage && <p className="attendee-form-message" role="status">{attendeeMessage}</p>}

              <div className="dashboard-section-heading">

                <div><p className="section-kicker">REGISTRATION MANAGEMENT</p><h2>Attendee directory</h2></div>

                <span className="dashboard-status">{filteredAttendees.length} result{filteredAttendees.length === 1 ? '' : 's'}</span>

              </div>

              <div className="registration-actions">

                <button

                  className="add-attendee-button"

                  type="button"

                  onClick={() => {

                    setShowAttendeeForm((show) => !show)

                    setAttendeeFormError('')

                    setAttendeeMessage('')

                    if (editingAttendee) cancelEditingAttendee()

                  }}

                >

                  {showAttendeeForm ? '- Close form' : '+ Add attendee'}

                </button>

              </div>

              {showAttendeeForm && (

                <form className="attendee-form" onSubmit={handleAddAttendee}>

                  <div className="attendee-form-heading">

                    <div><p className="section-kicker">NEW REGISTRATION</p><h3>Add attendee</h3></div>

                    <p>All fields are required.</p>

                  </div>

                  {attendeeFormError && <p className="attendee-form-error" role="alert">{attendeeFormError}</p>}

                  <div className="attendee-form-grid">

                    <div><label htmlFor="new-eid">Employee ID</label><input id="new-eid" value={newEid} onChange={(event) => { setNewEid(event.target.value); setAttendeeLookupMessage('') }} onBlur={(event) => { void handleAttendeeEidLookup(event.target.value) }} placeholder="e.g. DEMO006" maxLength={50} required /></div>
<p className="login-description" role="status">{attendeeLookupBusy ? 'Looking up employee...' : attendeeLookupMessage}</p>

                    <div><label htmlFor="new-name">Full name</label><input id="new-name" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Enter full name" maxLength={120} required /></div>

                    <div><label htmlFor="new-email">Email address</label><input id="new-email" type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="name\@example.com" maxLength={254} required /></div>

                    <div><label htmlFor="new-project">Project</label><input id="new-project" value={newProject} onChange={(event) => setNewProject(event.target.value)} placeholder="e.g. Roche Aspire" maxLength={150} required /></div>
                    <div><label htmlFor="new-contact-number">Contact number (editable)</label><input id="new-contact-number" type="tel" value={newContactNumber} onChange={(event) => setNewContactNumber(event.target.value)} placeholder="Employee mobile number" maxLength={30} required /></div>
                    <div><label htmlFor="new-emergency-contact">Emergency contact number</label><input id="new-emergency-contact" type="tel" value={newEmergencyContact} onChange={(event) => setNewEmergencyContact(event.target.value)} maxLength={30} required /></div>
                    <div><label htmlFor="new-colleague-contact">Colleague's contact number</label><input id="new-colleague-contact" type="tel" value={newColleagueContact} onChange={(event) => setNewColleagueContact(event.target.value)} maxLength={30} required /></div>
                    <div><label htmlFor="new-people-lead">People Lead</label><input id="new-people-lead" value={newPeopleLead} onChange={(event) => setNewPeopleLead(event.target.value)} placeholder="People Lead name" maxLength={150} required /></div>

                  </div>

                  <div className="attendee-form-actions">

                    <button className="attendee-save-button" type="submit" disabled={isSavingAttendee}>{isSavingAttendee ? 'Saving...' : 'Save attendee'}</button>

                    <button className="attendee-cancel-button" type="button" onClick={() => { setShowAttendeeForm(false); resetAttendeeForm() }}>Cancel</button>

                  </div>

                </form>

              )}

              {editingAttendee && (

                <form className="attendee-form" onSubmit={handleEditAttendee}>

                  <div className="attendee-form-heading">

                    <div><p className="section-kicker">EDIT REGISTRATION</p><h3>Edit attendee: {editingAttendee.eid}</h3></div>

                    <p>Update attendee details. Existing registration eligibility is preserved.</p>

                  </div>

                  {attendeeFormError && <p className="attendee-form-error" role="alert">{attendeeFormError}</p>}

                  <div className="attendee-form-grid">

                    <div><label htmlFor="edit-name">Full name</label><input id="edit-name" value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={200} required /></div>

                    <div><label htmlFor="edit-email">Email address</label><input id="edit-email" type="email" value={editEmail} onChange={(event) => setEditEmail(event.target.value)} maxLength={254} required /></div>

                    <div><label htmlFor="edit-project">Project</label><input id="edit-project" value={editProject} onChange={(event) => setEditProject(event.target.value)} maxLength={150} required /></div>
                    <div><label htmlFor="edit-contact-number">Contact number</label><input id="edit-contact-number" type="tel" value={editContactNumber} onChange={(event) => setEditContactNumber(event.target.value)} maxLength={40} /></div>
                    <div><label htmlFor="edit-family-emergency">Emergency contact number</label><input id="edit-family-emergency" type="tel" value={editFamilyEmergency} onChange={(event) => setEditFamilyEmergency(event.target.value)} maxLength={40} /></div>
                    <div><label htmlFor="edit-colleague-emergency">Colleague's contact number</label><input id="edit-colleague-emergency" type="tel" value={editColleagueEmergency} onChange={(event) => setEditColleagueEmergency(event.target.value)} maxLength={40} /></div>
                    <div><label htmlFor="edit-people-lead">People Lead</label><input id="edit-people-lead" value={editPeopleLead} onChange={(event) => setEditPeopleLead(event.target.value)} maxLength={200} /></div>

                  </div>

                  <div className="attendee-form-actions">

                    <button className="attendee-save-button" type="submit" disabled={isUpdatingAttendee}>{isUpdatingAttendee ? 'Saving changes...' : 'Save changes'}</button>

                    <button className="attendee-cancel-button" type="button" onClick={cancelEditingAttendee} disabled={isUpdatingAttendee}>Cancel</button>

                  </div>

                </form>

              )}

              <div className="registration-toolbar">

                <div className="registration-search">

                  <label htmlFor="attendee-search">Search attendees</label>

                  <input id="attendee-search" type="search" placeholder="Search name, EID, email or project..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />

                </div>

                <div className="registration-filter">

                  <label htmlFor="registration-status">Registration status</label>

                  <select id="registration-status" value={registrationFilter} onChange={(event) => setRegistrationFilter(event.target.value as RegistrationFilter)}>

                    <option value="All">All statuses</option><option value="Registered">Registered</option><option value="Pending">Pending</option><option value="Cancelled">Cancelled</option>

                  </select>

                </div>

              </div>

              <div className="registration-summary">

                <div className="registration-stat"><span>Total attendees</span><strong>{attendees.length}</strong></div>

                <div className="registration-stat"><span>Registered</span><strong>{registeredCount}</strong></div>

                <div className="registration-stat"><span>Pending</span><strong>{pendingCount}</strong></div>

                <div className="registration-stat"><span>Cancelled</span><strong>{cancelledCount}</strong></div>

              </div>

              <div className="registration-table-wrap">

                {isLoadingAttendees && <p role="status">Loading saved attendees...</p>}

                <table className="registration-table">

                  <thead><tr><th>Employee ID</th><th>Attendee</th><th>Project</th><th>Status</th><th>Actions</th></tr></thead>

                  <tbody>

                    {filteredAttendees.map((attendee) => (

                      <tr key={attendee.eid}>

                        <td><span className="attendee-eid">{attendee.eid}</span></td>

                        <td><div className="attendee-name">{attendee.name}</div><div className="attendee-email">{attendee.email}</div></td>

                        <td>{attendee.project}</td>

                        <td><span className={`registration-status status-${attendee.status.toLowerCase()}`}>{attendee.status}</span></td>

                        <td><button className="attendee-save-button" type="button" onClick={() => startEditingAttendee(attendee)}>Edit</button></td>

                      </tr>

                    ))}

                  </tbody>

                </table>

                {filteredAttendees.length === 0 && (

                  <div className="registration-empty">

                    <span>Search:</span><h3>No attendees found</h3><p>Try a different search term or select another status.</p>

                    <button type="button" className="registration-reset" onClick={() => { setSearchTerm(''); setRegistrationFilter('All') }}>Clear search and filters</button>

                  </div>

                )}

              </div>

            </>

          )}

          {activePage === 'wristbands' && (

            <div className="cc-feature-page">

              <button className="dashboard-signout" type="button" onClick={() => setActivePage('home')}>&#8592; Back to workspace</button>

              <div className="dashboard-welcome"><div><p className="section-kicker">QR WRISTBANDS</p><h1>Band<br/><span>management.</span></h1><p className="login-description">Assign a unique QR token to an attendee and print a simple wristband label.</p></div></div>

              {checkinMessage && <p className="attendee-form-message" role="status">{checkinMessage}</p>}

              {checkinError && <p className="attendee-form-error" role="alert">{checkinError}</p>}

              <div className="registration-toolbar"><div className="registration-search"><label htmlFor="band-search">Find attendee</label><input id="band-search" type="search" placeholder="Search by name or EID" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div><button className="add-attendee-button" type="button" onClick={() => void loadWristbands()} disabled={isLoadingWristbands}>{isLoadingWristbands ? 'Loading...' : 'Refresh QR bands'}</button></div>

              <div className="cc-qr-grid">{attendees.filter(a => a.status === 'Registered' && (a.name.toLowerCase().includes(searchTerm.toLowerCase()) || a.eid.toLowerCase().includes(searchTerm.toLowerCase()))).map(a => { const band = wristbands.find(b => b.eid === a.eid); return <article className="cc-qr-card" key={a.eid}><h3>{a.name}</h3><p>{a.eid} - {a.project}</p>{band && wristbandImages[a.eid] ? <img className="cc-qr-image" src={wristbandImages[a.eid]} alt={`QR wristband for ${a.eid}`} /> : <div className="cc-qr-placeholder">QR not assigned</div>}<div className="cc-qr-actions"><button className="attendee-save-button" type="button" onClick={() => void assignWristband(a.eid)}>{band ? 'Refresh QR' : 'Generate QR'}</button><button className="attendee-cancel-button" type="button" disabled={!band || !wristbandImages[a.eid]} onClick={() => printWristband(a.eid)}>Print</button></div></article> })}</div>

              {attendees.filter(a => a.status === 'Registered').length === 0 && <p>No registered attendees yet. Add a test attendee first.</p>}

            </div>

          )}

          {activePage === 'checkin' && (

            <div className="cc-feature-page">

              <button className="dashboard-signout" type="button" onClick={() => setActivePage('home')}>&#8592; Back to workspace</button>

              <div className="dashboard-welcome"><div><p className="section-kicker">EVENT ENTRY</p><h1>Attendee<br/><span>check-in.</span></h1><p className="login-description">Scan the attendee's QR wristband or enter their employee ID manually.</p></div></div>

              {checkinMessage && <p className="attendee-form-message" role="status">{checkinMessage}</p>}

              {checkinError && <p className="attendee-form-error" role="alert">{checkinError}</p>}

              {checkedInAttendee && (

                <section className="cc-checkin-success cc-checkin-celebration" role="status" aria-live="polite">
                  <div className="cc-confetti" aria-hidden="true">
                    {Array.from({ length: 18 }, (_, i) => <span key={i} />)}
                  </div>
                  <div className="cc-checkin-badge" aria-hidden="true">OK</div>
                  <p className="cc-checkin-eyebrow">CHAMPION CELEBRATION</p>
                  <h2>WELCOME, CHAMPION!</h2>
                  <p className="cc-checkin-subtitle">Your check-in is confirmed. Let the celebration begin!</p>
                  <div className="cc-checkin-attendee">
                    <p><strong>Attendee</strong><span>{checkedInAttendee.name}</span></p>
                    <p><strong>Employee ID</strong><span>{checkedInAttendee.eid}</span></p>
                    <p><strong>Project</strong><span>{checkedInAttendee.project}</span></p>
                    <p><strong>Check-in time</strong><span>{formatIndiaDateTime(checkedInAttendee.checked_in_at)}</span></p>
                  </div>
                </section>

              )}

              <div className="cc-checkin-panel">

                <div id="cc-qr-reader" className="cc-qr-reader"/>

                <div className="cc-checkin-actions">

                  <div className="cc-scanner-controls">

                    <button className="add-attendee-button" type="button" disabled={scannerRunning} onClick={() => void startQrScanner()}>{scannerRunning ? 'Scanner running...' : 'Start camera scanner'}</button>

                    <button className="attendee-cancel-button" type="button" disabled={!scannerRunning} onClick={() => void stopQrScanner()}>Stop scanner</button>

                  </div>

                  <p className="cc-help-text">Camera access requires permission and a secure context (localhost or HTTPS).</p>

                  {signedInStaff?.role !== 'checkin' && (<form className="cc-manual-checkin" onSubmit={e => { e.preventDefault(); void submitCheckin(checkinInput, 'EID') }}>

                    <label htmlFor="cc-checkin-eid">Manual check-in - Employee ID</label>

                    <input id="cc-checkin-eid" value={checkinInput} onChange={e => setCheckinInput(e.target.value)} placeholder="e.g. DEMO006" required/>

                    <button className="attendee-save-button" type="submit" disabled={isCheckingIn}>{isCheckingIn ? 'Checking in...' : 'Record check-in'}</button>

                  </form>) }

                </div>

              </div>

            </div>

          )}

        </section>

        <footer className="site-footer">

          <span>CHAMPION CELEBRATION</span>

          <span>MADE FOR CHAMPIONS <span className="gold-star">*</span></span>

        </footer>

      </main>

    )

  }

  return (

    <main className="celebration login-page">

      <nav className="topbar">

        <div className="brand"><span className="brand-mark">CC</span><span>CHAMPION <strong>CELEBRATION</strong></span></div>

        <span className="event-label">STAFF PORTAL</span>

      </nav>

      <section className="login-layout">

        <div className="login-intro">

          <p className="section-kicker">THE TEAM BEHIND THE MAGIC</p>

          <h1>Every great<br />event starts<br /><span>with a team.</span></h1>

          <p className="login-description">Your event. Your team. One unforgettable celebration. Sign in to access the Champion Celebration staff portal.</p>

          <div className="login-promise"><span className="promise-icon">*</span><div><strong>One team. One celebration.</strong><p>Event operations, made simple.</p></div></div>

        </div>

        <div className="login-card">

          <div className="card-emblem">CC</div>

          <p className="section-kicker">WELCOME BACK</p><h2>Staff sign in</h2>

          <p className="card-description">Enter your staff credentials to continue.</p>

          <form onSubmit={handleSubmit}>

            <label htmlFor="staffId">Staff ID</label>

            <input id="staffId" name="staffId" type="text" autoComplete="username" placeholder="Enter your staff ID" value={staffId} onChange={(event) => { setStaffId(event.target.value); setMessage('') }} maxLength={100} required disabled={isLoading} />

            <label htmlFor="password">Password</label>

            <div className="password-field">

              <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => { setPassword(event.target.value); setMessage('') }} maxLength={256} required disabled={isLoading} />

              <button className="show-password" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} disabled={isLoading}>{showPassword ? 'HIDE' : 'SHOW'}</button>

            </div>

            <button className="explore-button login-button" type="submit" disabled={isLoading}>{isLoading ? 'Signing in...' : 'Sign in'}{!isLoading && <span>-&gt;</span>}</button>

          </form>

          {message && <p className="login-message" role="alert" aria-live="polite">{message}</p>}

          <div className="security-note"><span>*</span><span>Authorised event staff only</span></div>

        </div>

      </section>

      <footer className="site-footer"><span>CHAMPION CELEBRATION</span><span>MADE FOR CHAMPIONS <span className="gold-star">*</span></span></footer>

    </main>

  )

}

export default App
