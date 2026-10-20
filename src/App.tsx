import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import QRCode from 'qrcode'

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

  department: string

  status: 'Registered' | 'Pending' | 'Cancelled'

}

type RegistrationFilter = 'All' | Attendee['status']

type Wristband = { eid: string; name: string; email: string; department: string; status: Attendee['status']; qr_token: string; band_status: string; checked_in_at?: string | null }

type CheckinResult = { ok?: boolean; error?: string; attendee?: { eid: string; name: string; email: string; department: string; status: Attendee['status']; checked_in_at: string } }

const initialDemoAttendees: Attendee[] = []

function App() {

  const [staffId, setStaffId] = useState('')

  const [password, setPassword] = useState('')

  const [showPassword, setShowPassword] = useState(false)

  const [message, setMessage] = useState('')

  const [isLoading, setIsLoading] = useState(false)

  const [signedInStaff, setSignedInStaff] = useState<Staff | null>(null)

  const [activePage, setActivePage] = useState('home')

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

  const [editDepartment, setEditDepartment] = useState('')

  const [editStatus, setEditStatus] = useState<Attendee['status']>('Registered')

  const [attendeeMessage, setAttendeeMessage] = useState('')

  const [attendeeFormError, setAttendeeFormError] = useState('')

  const [newEid, setNewEid] = useState('')

  const [newName, setNewName] = useState('')

  const [newEmail, setNewEmail] = useState('')

  const [newDepartment, setNewDepartment] = useState('')

  const [newStatus, setNewStatus] = useState<Attendee['status']>('Registered')

  const [wristbands, setWristbands] = useState<Wristband[]>([])

  const [wristbandImages, setWristbandImages] = useState<Record<string, string>>({})

  const [isLoadingWristbands, setIsLoadingWristbands] = useState(false)

  const [checkinInput, setCheckinInput] = useState('')

  const [checkinMessage, setCheckinMessage] = useState('')

  const [checkinError, setCheckinError] = useState('')

  const [isCheckingIn, setIsCheckingIn] = useState(false)

  const [scannerRunning, setScannerRunning] = useState(false)

  const scannerRef = useRef<Html5Qrcode | null>(null)

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

    setNewDepartment('')

    setNewStatus('Registered')

    setAttendeeFormError('')

  }

  async function handleAddAttendee(event: FormEvent<HTMLFormElement>) {

    event.preventDefault()

    if (isSavingAttendee) return

    setAttendeeFormError('')

    setAttendeeMessage('')

    const eid = newEid.trim()

    const name = newName.trim()

    const email = newEmail.trim().toLowerCase()

    const department = newDepartment.trim()

    if (!eid || !name || !email || !department) {

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

        body: JSON.stringify({ eid, name, email, department, status: newStatus }),

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

    setEditDepartment(attendee.department)

    setEditStatus(attendee.status)

    setAttendeeFormError('')

    setAttendeeMessage('')

    setShowAttendeeForm(false)

  }

  function cancelEditingAttendee() {

    setEditingAttendee(null)

    setEditName('')

    setEditEmail('')

    setEditDepartment('')

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

    const department = editDepartment.trim()

    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!name || !email || !department) {

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

          department,

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

    if (signedInStaff) {

      void loadAttendees()

    }

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

        const svg = `<svg xmlns="http://www\.w3.org/2000/svg" viewBox="0 0 ${fullSize} ${fullSize}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000"/></svg>`

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

  async function submitCheckin(value = checkinInput, method: 'QR' | 'EID' = 'EID') {

    const clean = value.trim()

    if (!clean || isCheckingIn) return

    setIsCheckingIn(true)

    setCheckinError('')

    setCheckinMessage('')

    setCheckedInAttendee(null)

    try {

      const response = await fetch('/api/checkin', {

        method: 'POST',

        credentials: 'same-origin',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify(method === 'QR' ? { token: clean } : { eid: clean }),

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

        attendee.department.toLowerCase().includes(query)

      const matchesStatus = registrationFilter === 'All' || attendee.status === registrationFilter

      return matchesSearch && matchesStatus

    })

  }, [attendees, searchTerm, registrationFilter])

  const registeredCount = attendees.filter((attendee) => attendee.status === 'Registered').length

  const pendingCount = attendees.filter((attendee) => attendee.status === 'Pending').length

  const cancelledCount = attendees.filter((attendee) => attendee.status === 'Cancelled').length

  if (signedInStaff) {

    return (

      <main className="celebration dashboard-page">

        <nav className="topbar">

          <div className="brand">

            <span className="brand-mark">CC</span>

            <span>CHAMPION <strong>CELEBRATION</strong></span>

          </div>

          <span className="event-label">STAFF PORTAL</span>

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
                  <span className="cc-primary-icon" aria-hidden="true">⌗</span>
                  <span className="cc-primary-copy">
                    <strong>Scan QR / Check in</strong>
                    <span>Scan an attendee's wristband or enter their employee ID.</span>
                  </span>
                  <span className="cc-primary-arrow" aria-hidden="true">→</span>
                </button>

                <div className="cc-quick-actions" aria-label="Other event tasks">
                  <button type="button" className="cc-quick-action" onClick={() => { setActivePage('registration'); void loadAttendees() }}>
                    <span className="cc-quick-icon" aria-hidden="true">♙</span>
                    <span><strong>Attendees</strong><small>Search and update registrations</small></span>
                    <span className="cc-quick-arrow" aria-hidden="true">→</span>
                  </button>
                  <button type="button" className="cc-quick-action" onClick={() => { setActivePage('wristbands'); setCheckinError(''); setCheckinMessage(''); void loadWristbands() }}>
                    <span className="cc-quick-icon" aria-hidden="true">◇</span>
                    <span><strong>QR wristbands</strong><small>Assign and print attendee QR codes</small></span>
                    <span className="cc-quick-arrow" aria-hidden="true">→</span>
                  </button>
                </div>

                <div className="cc-attendee-summary">
                  <div><span>Saved attendees</span><strong>{attendees.length}</strong></div>
                  <div><span>Registered</span><strong>{registeredCount}</strong></div>
                  <div><span>Pending</span><strong>{pendingCount}</strong></div>
                  <div><span>Cancelled</span><strong>{cancelledCount}</strong></div>
                </div>
              </section>

              <div className="dashboard-notice">
                <span aria-hidden="true">ⓘ</span>
                <p><strong>Before the event</strong><br />Confirm attendee records, assign QR wristbands, then use Scan QR / Check in at the entrance.</p>
              </div>
            </>
          )}

          {activePage === 'registration' && (

            <>

              <button className="dashboard-signout" type="button" onClick={() => setActivePage('home')}>← Back to workspace</button>

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

              <div className="dashboard-notice"><span>Info:</span><p><strong>Development database</strong><br />Attendee records are saved in the connected database. Use fictional test records until hosting and privacy approvals are complete.</p></div>

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

                    <div><label htmlFor="new-eid">Employee ID</label><input id="new-eid" value={newEid} onChange={(event) => setNewEid(event.target.value)} placeholder="e.g. DEMO006" maxLength={50} required /></div>

                    <div><label htmlFor="new-name">Full name</label><input id="new-name" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Enter full name" maxLength={120} required /></div>

                    <div><label htmlFor="new-email">Email address</label><input id="new-email" type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="name\@example.com" maxLength={254} required /></div>

                    <div><label htmlFor="new-department">Department</label><input id="new-department" value={newDepartment} onChange={(event) => setNewDepartment(event.target.value)} placeholder="e.g. Finance" maxLength={100} required /></div>

                    <div>

                      <label htmlFor="new-status">Registration status</label>

                      <select id="new-status" value={newStatus} onChange={(event) => setNewStatus(event.target.value as Attendee['status'])}>

                        <option value="Registered">Registered</option><option value="Pending">Pending</option><option value="Cancelled">Cancelled</option>

                      </select>

                    </div>

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

                    <p>Update attendee details and registration status.</p>

                  </div>

                  {attendeeFormError && <p className="attendee-form-error" role="alert">{attendeeFormError}</p>}

                  <div className="attendee-form-grid">

                    <div><label htmlFor="edit-name">Full name</label><input id="edit-name" value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={200} required /></div>

                    <div><label htmlFor="edit-email">Email address</label><input id="edit-email" type="email" value={editEmail} onChange={(event) => setEditEmail(event.target.value)} maxLength={254} required /></div>

                    <div><label htmlFor="edit-department">Department</label><input id="edit-department" value={editDepartment} onChange={(event) => setEditDepartment(event.target.value)} maxLength={150} required /></div>

                    <div>

                      <label htmlFor="edit-status">Registration status</label>

                      <select id="edit-status" value={editStatus} onChange={(event) => setEditStatus(event.target.value as Attendee['status'])}>

                        <option value="Registered">Registered</option><option value="Pending">Pending</option><option value="Cancelled">Cancelled</option>

                      </select>

                    </div>

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

                  <input id="attendee-search" type="search" placeholder="Search name, EID, email or department..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />

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

                  <thead><tr><th>Employee ID</th><th>Attendee</th><th>Department</th><th>Status</th><th>Actions</th></tr></thead>

                  <tbody>

                    {filteredAttendees.map((attendee) => (

                      <tr key={attendee.eid}>

                        <td><span className="attendee-eid">{attendee.eid}</span></td>

                        <td><div className="attendee-name">{attendee.name}</div><div className="attendee-email">{attendee.email}</div></td>

                        <td>{attendee.department}</td>

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

              <button className="dashboard-signout" type="button" onClick={() => setActivePage('home')}>← Back to workspace</button>

              <div className="dashboard-welcome"><div><p className="section-kicker">QR WRISTBANDS</p><h1>Band<br/><span>management.</span></h1><p className="login-description">Assign a unique QR token to an attendee and print a simple wristband label.</p></div></div>

              {checkinMessage && <p className="attendee-form-message" role="status">{checkinMessage}</p>}

              {checkinError && <p className="attendee-form-error" role="alert">{checkinError}</p>}

              <div className="registration-toolbar"><div className="registration-search"><label htmlFor="band-search">Find attendee</label><input id="band-search" type="search" placeholder="Search by name or EID" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div><button className="add-attendee-button" type="button" onClick={() => void loadWristbands()} disabled={isLoadingWristbands}>{isLoadingWristbands ? 'Loading...' : 'Refresh QR bands'}</button></div>

              <div className="cc-qr-grid">{attendees.filter(a => a.status === 'Registered' && (a.name.toLowerCase().includes(searchTerm.toLowerCase()) || a.eid.toLowerCase().includes(searchTerm.toLowerCase()))).map(a => { const band = wristbands.find(b => b.eid === a.eid); return <article className="cc-qr-card" key={a.eid}><h3>{a.name}</h3><p>{a.eid} - {a.department}</p>{band && wristbandImages[a.eid] ? <img className="cc-qr-image" src={wristbandImages[a.eid]} alt={`QR wristband for ${a.eid}`} /> : <div className="cc-qr-placeholder">QR not assigned</div>}<div className="cc-qr-actions"><button className="attendee-save-button" type="button" onClick={() => void assignWristband(a.eid)}>{band ? 'Refresh QR' : 'Generate QR'}</button><button className="attendee-cancel-button" type="button" disabled={!band || !wristbandImages[a.eid]} onClick={() => printWristband(a.eid)}>Print</button></div></article> })}</div>

              {attendees.filter(a => a.status === 'Registered').length === 0 && <p>No registered attendees yet. Add a test attendee first.</p>}

            </div>

          )}

          {activePage === 'checkin' && (

            <div className="cc-feature-page">

              <button className="dashboard-signout" type="button" onClick={() => setActivePage('home')}>← Back to workspace</button>

              <div className="dashboard-welcome"><div><p className="section-kicker">EVENT ENTRY</p><h1>Attendee<br/><span>check-in.</span></h1><p className="login-description">Scan the attendee's QR wristband or enter their employee ID manually.</p></div></div>

              {checkinMessage && <p className="attendee-form-message" role="status">{checkinMessage}</p>}

              {checkinError && <p className="attendee-form-error" role="alert">{checkinError}</p>}

              {checkedInAttendee && (

                <section className="cc-checkin-success" role="status" aria-live="polite">

                  <h2>Attendee checked in</h2>

                  <p><strong>Name:</strong> {checkedInAttendee.name}</p>

                  <p><strong>Employee ID:</strong> {checkedInAttendee.eid}</p>

                  <p><strong>Department:</strong> {checkedInAttendee.department}</p>

                  <p><strong>Check-in time:</strong> {new Date(checkedInAttendee.checked_in_at).toLocaleString()}</p>

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

                  <form className="cc-manual-checkin" onSubmit={e => { e.preventDefault(); void submitCheckin(checkinInput, 'EID') }}>

                    <label htmlFor="cc-checkin-eid">Manual check-in - Employee ID</label>

                    <input id="cc-checkin-eid" value={checkinInput} onChange={e => setCheckinInput(e.target.value)} placeholder="e.g. DEMO006" required/>

                    <button className="attendee-save-button" type="submit" disabled={isCheckingIn}>{isCheckingIn ? 'Checking in...' : 'Record check-in'}</button>

                  </form>

                </div>

              </div>

            </div>

          )}

          <button className="dashboard-signout" type="button" onClick={handleSignOut}>Sign out <span>→</span></button>

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

            <button className="explore-button login-button" type="submit" disabled={isLoading}>{isLoading ? 'Signing in...' : 'Sign in'}{!isLoading && <span>→</span>}</button>

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