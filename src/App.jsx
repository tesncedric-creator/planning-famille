import { useEffect, useState } from 'react'
import { subscribe, update, useFirebase } from './db'
import Login from './components/Login'
import Agenda from './components/Agenda'
import Courses from './components/Courses'
import Voeux from './components/Voeux'
import Famille from './components/Famille'
import MonCode from './components/MonCode'
import Notifications from './components/Notifications'

const SESSION = 'planning-famille:session'

export default function App() {
  const [members, setMembers] = useState(null)
  const [error, setError] = useState('')
  const [meId, setMeId] = useState(() => localStorage.getItem(SESSION))
  const [tab, setTab] = useState('agenda')
  const [showPinForm, setShowPinForm] = useState(false)
  const [showNotifForm, setShowNotifForm] = useState(false)
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine)

  useEffect(() => {
    const goOnline = () => setOffline(false)
    const goOffline = () => setOffline(true)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  useEffect(
    () =>
      subscribe(
        'members',
        (rows) => {
          const sorted = [...rows].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
          setMembers(sorted)
          // Le premier membre créé est l'admin : on marque son compte si ce n'est pas déjà fait
          if (sorted[0] && !sorted[0].admin) update('members', sorted[0].id, { admin: true })
        },
        () => setError("Impossible de lire les données. Vérifie la config Firebase et les règles Firestore.")
      ),
    []
  )

  if (error) return <p className="center error">{error}</p>
  if (members === null) return <p className="center">Chargement…</p>

  const me = members.find((m) => m.id === meId)

  if (!me) {
    return (
      <Login
        members={members}
        onLogin={(id) => {
          localStorage.setItem(SESSION, id)
          setMeId(id)
          setTab('agenda')
        }}
      />
    )
  }

  const isParent = me.role === 'parent'
  const tabs = [
    ['agenda', '📅 Agenda'],
    ['courses', '🛒 Courses'],
    ['voeux', '🎁 Vœux'],
    ...(isParent ? [['famille', '👨‍👩‍👧 Famille']] : []),
  ]

  return (
    <div className="app">
      <header>
        <h1>Planning famille</h1>
        <div className="who">
          <span className="dot" style={{ background: me.color }} />
          {me.name}
          <button className="link" onClick={() => setShowPinForm(true)}>
            Mon code
          </button>
          <button className="link" onClick={() => setShowNotifForm(true)}>
            🔔 Notifications
          </button>
          <button
            className="link"
            onClick={() => {
              localStorage.removeItem(SESSION)
              setMeId(null)
            }}
          >
            Changer
          </button>
        </div>
      </header>

      {!useFirebase && (
        <p className="banner">Mode test : les données restent sur cet appareil (Firebase pas encore branché).</p>
      )}
      {offline && (
        <p className="banner offline">
          📴 Hors connexion : tu vois les dernières données connues. Tes ajouts partiront au retour du réseau.
        </p>
      )}

      <main>
        {showPinForm && <MonCode me={me} onDone={() => setShowPinForm(false)} />}
        {showNotifForm && <Notifications me={me} onDone={() => setShowNotifForm(false)} />}
        {tab === 'agenda' && <Agenda me={me} members={members} />}
        {tab === 'courses' && <Courses me={me} members={members} />}
        {tab === 'voeux' && <Voeux me={me} members={members} />}
        {tab === 'famille' && isParent && <Famille me={me} members={members} />}
      </main>

      <nav>
        {tabs.map(([key, label]) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}
