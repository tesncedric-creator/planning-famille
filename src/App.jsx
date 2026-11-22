import { useEffect, useRef, useState } from 'react'
import { subscribe, update, useFirebase } from './db'
import Login from './components/Login'
import Agenda from './components/Agenda'
import Courses from './components/Courses'
import Voeux from './components/Voeux'
import Famille from './components/Famille'
import MonCode from './components/MonCode'
import Notifications from './components/Notifications'
import Corvees from './components/Corvees'

const SESSION = 'planning-famille:session'
const THEME_KEY = 'planning-famille:theme'

export default function App() {
  const [members, setMembers] = useState(null)
  const [error, setError] = useState('')
  const [meId, setMeId] = useState(() => localStorage.getItem(SESSION))
  const [tab, setTab] = useState('agenda')
  const [showPinForm, setShowPinForm] = useState(false)
  const [showNotifForm, setShowNotifForm] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef(null)
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine)
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'system')

  useEffect(() => {
    if (!showMenu) return
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [showMenu])

  const effectiveTheme =
    theme === 'system'
      ? window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme

  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.dataset.theme = theme
  }, [theme])

  function toggleTheme() {
    const next = effectiveTheme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem(THEME_KEY, next)
  }

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
    ['corvees', '🧹 Corvées'],
    ...(isParent ? [['famille', '👨‍👩‍👧 Famille']] : []),
  ]

  return (
    <div className="app">
      <header>
        <h1>Planning famille</h1>
        <div className="who">
          <span className="dot" style={{ background: me.color }} />
          {me.name}
          <button className="icon-btn" title="Thème clair/sombre" onClick={toggleTheme}>
            {effectiveTheme === 'dark' ? '☀️' : '🌙'}
          </button>
          <div className="menu-wrap" ref={menuRef}>
            <button className="icon-btn" title="Menu" onClick={() => setShowMenu((v) => !v)}>
              ⚙️
            </button>
            {showMenu && (
              <div className="menu-panel">
                <button
                  className="menu-item"
                  onClick={() => {
                    setShowPinForm(true)
                    setShowMenu(false)
                  }}
                >
                  Mon code
                </button>
                <button
                  className="menu-item"
                  onClick={() => {
                    setShowNotifForm(true)
                    setShowMenu(false)
                  }}
                >
                  🔔 Notifications
                </button>
                <button
                  className="menu-item"
                  onClick={() => {
                    localStorage.removeItem(SESSION)
                    setMeId(null)
                    setShowMenu(false)
                  }}
                >
                  Changer de profil
                </button>
              </div>
            )}
          </div>
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
        {tab === 'corvees' && <Corvees me={me} members={members} />}
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
