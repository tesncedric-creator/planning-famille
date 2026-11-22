import { useEffect, useState } from 'react'
import { add, update, remove } from '../db'
import { COLORS, capitalize, firstFreeColor, hashPin, newSalt } from '../utils'

function PinForm({ member, onDone }) {
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!/^\d{4,6}$/.test(p1)) return setErr('Le code doit faire 4 à 6 chiffres')
    if (p1 !== p2) return setErr('Les deux codes ne correspondent pas')
    const salt = newSalt()
    await update('members', member.id, { pinSalt: salt, pinHash: await hashPin(salt, p1) })
    onDone()
  }

  return (
    <form onSubmit={submit} className="card">
      <h2>Nouveau code pour {member.name}</h2>
      <input
        type="password"
        inputMode="numeric"
        placeholder="Nouveau code (4 à 6 chiffres)"
        value={p1}
        onChange={(e) => setP1(e.target.value)}
      />
      <input type="password" inputMode="numeric" placeholder="Confirme le code" value={p2} onChange={(e) => setP2(e.target.value)} />
      {err && <p className="error">{err}</p>}
      <div className="two">
        <button className="primary">Valider</button>
        <button type="button" className="link" onClick={onDone}>
          Annuler
        </button>
      </div>
    </form>
  )
}

const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

export default function Famille({ me, members }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('enfant')
  const [pin, setPin] = useState('')
  const [color, setColor] = useState(() => firstFreeColor(members))
  const [colorTouched, setColorTouched] = useState(false)
  const [err, setErr] = useState('')
  const [editColorId, setEditColorId] = useState(null)
  const [editPinId, setEditPinId] = useState(null)

  async function editBirthday(m) {
    const d = window.prompt(`Jour de naissance de ${m.name} (1 à 31) :`, m.birthDay || '')
    if (d === null) return
    const day = parseInt(d, 10)
    if (!(day >= 1 && day <= 31)) return window.alert('Jour invalide (1 à 31)')
    const mo = window.prompt(`Mois de naissance de ${m.name} (1 à 12) :`, m.birthMonth || '')
    if (mo === null) return
    const month = parseInt(mo, 10)
    if (!(month >= 1 && month <= 12)) return window.alert('Mois invalide (1 à 12)')
    const y = window.prompt(`Année de naissance de ${m.name} (facultatif, laisse vide si inconnue) :`, m.birthYear || '')
    if (y === null) return
    const year = y.trim() ? parseInt(y, 10) : null
    if (year !== null && (Number.isNaN(year) || year < 1900 || year > new Date().getFullYear())) return window.alert('Année invalide')
    await update('members', m.id, { birthDay: day, birthMonth: month, birthYear: year })
    window.alert('Anniversaire enregistré 🎂')
  }

  // Tant que l'utilisateur n'a pas choisi lui-même une couleur, on garde la première encore libre à jour
  useEffect(() => {
    if (!colorTouched) setColor(firstFreeColor(members))
  }, [members, colorTouched])

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return setErr('Mets un prénom')
    if (!/^\d{4,6}$/.test(pin)) return setErr('Le code doit faire 4 à 6 chiffres')
    const finalName = capitalize(name.trim())
    if (members.some((m) => m.name.trim().toLowerCase() === finalName.toLowerCase())) return setErr('Ce prénom existe déjà')
    const salt = newSalt()
    await add('members', {
      name: finalName,
      role,
      color,
      pinSalt: salt,
      pinHash: await hashPin(salt, pin),
    })
    setName('')
    setPin('')
    setErr('')
    setColorTouched(false)
  }

  async function renameMember(m) {
    const n = window.prompt(`Nouveau prénom pour ${m.name} :`, m.name)
    if (n === null) return
    const trimmed = n.trim()
    if (!trimmed) return window.alert('Le prénom ne peut pas être vide')
    if (members.some((x) => x.id !== m.id && x.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      return window.alert('Ce prénom existe déjà')
    }
    const patch = { name: trimmed }
    // Fige le prénom qui servait au calcul du code, pour les comptes créés avant l'ajout de pinSalt
    if (!m.pinSalt && !m.pinHashName) patch.pinHashName = m.name
    await update('members', m.id, patch)
  }

  return (
    <div>
      <form onSubmit={submit} className="card">
        <h2>Ajouter un membre</h2>
        <input placeholder="Prénom" value={name} onChange={(e) => setName(e.target.value)} />
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="enfant">Enfant</option>
          <option value="parent">Parent</option>
        </select>
        <input
          placeholder="Code secret (4 à 6 chiffres)"
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
        />
        <div className="swatches">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={'swatch' + (color === c ? ' sel' : '')}
              style={{ background: c }}
              aria-label={'Choisir la couleur ' + c}
              onClick={() => {
                setColor(c)
                setColorTouched(true)
              }}
            />
          ))}
        </div>
        {err && <p className="error">{err}</p>}
        <button className="primary">Ajouter</button>
      </form>

      <section>
        <h3>La famille</h3>
        {members.map((m) => (
          <div key={m.id} className="card">
            <div className="member-head">
              <span className="avatar" style={{ background: m.color }}>
                {m.name.charAt(0).toUpperCase()}
              </span>
              <div className="grow">
                <b>{m.name}</b>
                <div className="muted">
                  {m.role === 'parent' ? 'Parent' : 'Enfant'}
                  {m.admin ? ' · Admin' : ''}
                  {m.birthDay && m.birthMonth && (
                    <> · 🎂 {m.birthDay} {MONTHS[m.birthMonth - 1]}{m.birthYear ? ' ' + m.birthYear : ''}</>
                  )}
                </div>
              </div>
              {m.id !== me.id && (
                <button
                  className="icon"
                  title="Supprimer"
                  onClick={() => window.confirm(`Supprimer ${m.name} ?`) && remove('members', m.id)}
                >
                  🗑️
                </button>
              )}
            </div>

            <div className="member-actions">
              <button className="small ghost" onClick={() => setEditColorId(editColorId === m.id ? null : m.id)}>
                Changer la couleur
              </button>
              <button className="small ghost" onClick={() => renameMember(m)}>
                Modifier le prénom
              </button>
              {me.admin && (
                <button className="small ghost" onClick={() => editBirthday(m)}>
                  🎂 Anniversaire
                </button>
              )}
              {me.admin && (
                <button className="small ghost" onClick={() => setEditPinId(editPinId === m.id ? null : m.id)}>
                  Changer le code
                </button>
              )}
            </div>

            {editColorId === m.id && (
              <div className="swatches">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={'swatch' + (m.color === c ? ' sel' : '')}
                    style={{ background: c }}
                    aria-label={'Choisir la couleur ' + c}
                    onClick={async () => {
                      await update('members', m.id, { color: c })
                      setEditColorId(null)
                    }}
                  />
                ))}
              </div>
            )}

            {editPinId === m.id && <PinForm member={m} onDone={() => setEditPinId(null)} />}
          </div>
        ))}
      </section>
    </div>
  )
}
