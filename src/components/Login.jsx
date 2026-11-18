import { useState } from 'react'
import { add } from '../db'
import { COLORS, capitalize, hashPin, hashPinFor, newSalt } from '../utils'

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

  if (members.length === 0) return <Setup onLogin={onLogin} />

  async function submit(e) {
    e.preventDefault()
    const h = await hashPinFor(sel, pin)
    if (h === sel.pinHash) onLogin(sel.id)
    else {
      setErr('Code incorrect')
      setPin('')
    }
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
            Salut <b>{sel.name}</b>, tape ton code :
          </p>
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
