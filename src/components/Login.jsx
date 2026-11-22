import { useEffect, useState } from 'react'
import { add, update } from '../db'
import { COLORS, capitalize, hashPin, hashPinFor, newSalt } from '../utils'

const MAX_ATTEMPTS = 5
const LOCK_MINUTES = 5
const lockKey = (id) => `planning-famille:lock:${id}`

function Setup({ onLogin }) {
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return setErr('Mets ton prénom')
    if (!/^\d{4,6}$/.test(pin)) return setErr('Le code doit faire 4 à 6 chiffres')
    const salt = newSalt()
    const id = await add('members', {
      name: capitalize(name.trim()),
      role: 'parent',
      admin: true, // le premier membre créé est l'administrateur de la famille
      color: COLORS[0],
      pinSalt: salt,
      pinHash: await hashPin(salt, pin),
    })
    onLogin(id)
  }

  return (
    <div className="login">
      <h1>Bienvenue 👋</h1>
      <p>On commence par créer le premier parent (toi). Tu ajouteras les autres ensuite.</p>
      <form onSubmit={submit} className="card">
        <input placeholder="Ton prénom" value={name} onChange={(e) => setName(e.target.value)} />
        <input
          placeholder="Code secret (4 à 6 chiffres)"
          inputMode="numeric"
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
        />
        <p className="muted">💡 6 chiffres, c’est plus sûr (4 à 6 acceptés).</p>
        {err && <p className="error">{err}</p>}
        <button className="primary">Créer mon profil</button>
      </form>
    </div>
  )
}

export default function Login({ members, onLogin }) {
  const [sel, setSel] = useState(null)
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const [now, setNow] = useState(Date.now())

  // Rafraîchit le compte à rebours du blocage sans action de l'utilisateur
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (members.length === 0) return <Setup onLogin={onLogin} />

  // `sel` est figé au moment du clic sur le profil : il ne reflète plus les tentatives suivantes
  // (failedAttempts/lockUntil mis à jour par submit()). On relit toujours la version à jour dans
  // `members` (tenu à jour en direct par l'abonnement Firestore de App.jsx) pour ces champs-là.
  const current = sel ? members.find((m) => m.id === sel.id) || sel : null

  // Le champ lockUntil sur le membre (Firestore) fait foi, y compris depuis un autre téléphone ;
  // la copie locale (localStorage) ne sert qu'à garder une trace si jamais le membre n'a pas encore
  // reçu la mise à jour (ex. tout juste après une tentative, avant que l'écriture ne revienne).
  const localLock = current ? JSON.parse(localStorage.getItem(lockKey(current.id)) || '{}') : {}
  const lockUntil = current ? current.lockUntil || localLock.lockUntil || 0 : 0
  const locked = lockUntil > now

  async function submit(e) {
    e.preventDefault()
    if (locked) return
    const h = await hashPinFor(current, pin)
    if (h === current.pinHash) {
      localStorage.removeItem(lockKey(current.id))
      if (current.failedAttempts || current.lockUntil) await update('members', current.id, { failedAttempts: 0, lockUntil: null })
      onLogin(current.id)
      return
    }
    const attempts = (current.failedAttempts || 0) + 1
    const patch = { failedAttempts: attempts }
    if (attempts >= MAX_ATTEMPTS) {
      patch.failedAttempts = 0
      patch.lockUntil = Date.now() + LOCK_MINUTES * 60000
    }
    localStorage.setItem(lockKey(current.id), JSON.stringify(patch))
    await update('members', current.id, patch)
    setErr('Code incorrect')
    setPin('')
  }

  return (
    <div className="login">
      <h1>Planning famille</h1>
      {!sel ? (
        <>
          <p>Qui es-tu ?</p>
          <div className="members">
            {members.map((m) => (
              <button key={m.id} className="member" onClick={() => setSel(m)}>
                <span className="avatar" style={{ background: m.color }}>
                  {m.name.charAt(0).toUpperCase()}
                </span>
                {m.name}
              </button>
            ))}
          </div>
        </>
      ) : (
        <form onSubmit={submit} className="card">
          <p>
            Salut <b>{current.name}</b>, tape ton code :
          </p>
          {locked ? (
            <p className="error">Trop d’essais, réessaie dans {Math.max(1, Math.ceil((lockUntil - now) / 60000))} min</p>
          ) : (
            <>
              <input
                autoFocus
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value)
                  setErr('')
                }}
              />
              {err && <p className="error">{err}</p>}
              <button className="primary">Entrer</button>
            </>
          )}
          <button
            type="button"
            className="link"
            onClick={() => {
              setSel(null)
              setPin('')
              setErr('')
            }}
          >
            ← Retour
          </button>
        </form>
      )}
    </div>
  )
}
