import { useState } from 'react'
import { update } from '../db'
import { hashPin, hashPinFor, newSalt } from '../utils'

export default function MonCode({ me, onDone }) {
  const [oldPin, setOldPin] = useState('')
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setErr('')
    if (!/^\d{4,6}$/.test(p1)) return setErr('Le nouveau code doit faire 4 à 6 chiffres')
    if (p1 !== p2) return setErr('Les deux codes ne correspondent pas')
    setBusy(true)
    const h = await hashPinFor(me, oldPin)
    if (h !== me.pinHash) {
      setBusy(false)
      return setErr('Ancien code incorrect')
    }
    const salt = newSalt()
    await update('members', me.id, { pinSalt: salt, pinHash: await hashPin(salt, p1) })
    setBusy(false)
    onDone()
  }

  return (
    <form onSubmit={submit} className="card">
      <h2>Changer mon code</h2>
      <input
        type="password"
        inputMode="numeric"
        placeholder="Code actuel"
        value={oldPin}
        onChange={(e) => setOldPin(e.target.value)}
      />
      <input
        type="password"
        inputMode="numeric"
        placeholder="Nouveau code (4 à 6 chiffres)"
        value={p1}
        onChange={(e) => setP1(e.target.value)}
      />
      <input
        type="password"
        inputMode="numeric"
        placeholder="Confirme le nouveau code"
        value={p2}
        onChange={(e) => setP2(e.target.value)}
      />
      <p className="muted">💡 6 chiffres, c’est plus sûr (4 à 6 acceptés).</p>
      {err && <p className="error">{err}</p>}
      <div className="two">
        <button className="primary" disabled={busy}>
          Valider
        </button>
        <button type="button" className="link" onClick={onDone}>
          Annuler
        </button>
      </div>
    </form>
  )
}
