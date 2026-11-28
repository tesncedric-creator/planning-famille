import { useEffect, useState } from 'react'
import { subscribe, add, update, remove, set, getAll } from '../db'
import { COLORS, capitalize, firstFreeColor, hashPin, newSalt, todayStr } from '../utils'

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
      <p className="muted">💡 6 chiffres, c’est plus sûr (4 à 6 acceptés).</p>
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

const BACKUP_KEY = 'planning-famille:lastBackup'
const BACKUP_COLLECTIONS = ['events', 'courses', 'habits', 'wishes', 'corvees', 'corveesFaites', 'menus', 'reglages', 'pointsPayes']

export default function Famille({ me, members }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('enfant')
  const [pin, setPin] = useState('')
  const [color, setColor] = useState(() => firstFreeColor(members))
  const [colorTouched, setColorTouched] = useState(false)
  const [err, setErr] = useState('')
  const [editColorId, setEditColorId] = useState(null)
  const [editPinId, setEditPinId] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)

  const [reglages, setReglages] = useState(null)
  const [pointValueInput, setPointValueInput] = useState('')
  const [pvSaved, setPvSaved] = useState(false)
  const [lastBackup, setLastBackup] = useState(() => localStorage.getItem(BACKUP_KEY))
  const [backing, setBacking] = useState(false)

  const [countdowns, setCountdowns] = useState([])
  const [cdTitle, setCdTitle] = useState('')
  const [cdDate, setCdDate] = useState('')
  const [cdEditId, setCdEditId] = useState(null)
  const [showCdForm, setShowCdForm] = useState(false)
  const [timezoneInput, setTimezoneInput] = useState('')
  const [tzSaved, setTzSaved] = useState(false)

  useEffect(() => subscribe('reglages', (rows) => setReglages(rows.find((r) => r.id === 'famille') || null)), [])
  useEffect(() => subscribe('comptesARebours', setCountdowns), [])
  useEffect(() => {
    setPointValueInput(reglages && reglages.pointValue != null ? String(reglages.pointValue) : '')
    setTimezoneInput((reglages && reglages.timezone) || 'America/Miquelon')
  }, [reglages])

  async function saveTimezone(e) {
    e.preventDefault()
    await set('reglages', 'famille', { timezone: timezoneInput.trim() || 'America/Miquelon' })
    setTzSaved(true)
    setTimeout(() => setTzSaved(false), 2000)
  }

  function startEditCountdown(c) {
    setCdEditId(c.id)
    setCdTitle(c.title)
    setCdDate(c.date)
    setShowCdForm(true)
  }

  function resetCountdownForm() {
    setCdEditId(null)
    setCdTitle('')
    setCdDate('')
    setShowCdForm(false)
  }

  async function submitCountdown(e) {
    e.preventDefault()
    if (!cdTitle.trim() || !cdDate) return
    const data = { title: cdTitle.trim(), date: cdDate }
    if (cdEditId) await update('comptesARebours', cdEditId, data)
    else await add('comptesARebours', { ...data, createdBy: me.id })
    resetCountdownForm()
  }

  async function removeCountdown(c) {
    if (!window.confirm(`Supprimer « ${c.title} » ?`)) return
    await remove('comptesARebours', c.id)
  }

  async function savePointValue(e) {
    e.preventDefault()
    const v = pointValueInput.trim() ? parseFloat(pointValueInput.replace(',', '.')) : null
    await set('reglages', 'famille', { pointValue: Number.isFinite(v) ? v : null })
    setPvSaved(true)
    setTimeout(() => setPvSaved(false), 2000)
  }

  async function downloadBackup() {
    setBacking(true)
    try {
      const data = {}
      for (const col of BACKUP_COLLECTIONS) {
        data[col] = await getAll(col)
      }
      // Jamais de secrets dans une sauvegarde : ni code (haché ou pas), ni jeton de notification.
      data.members = members.map(({ pinHash, pinSalt, pinHashName, fcmTokens, ...safe }) => safe)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `planning-famille-sauvegarde-${todayStr()}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      const now = new Date().toISOString()
      localStorage.setItem(BACKUP_KEY, now)
      setLastBackup(now)
    } finally {
      setBacking(false)
    }
  }

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
    setShowAddForm(false)
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
      <section>
        <h3>La famille</h3>
        <div className="grille">
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
              {me.admin && m.lockUntil && m.lockUntil > Date.now() && (
                <button
                  className="small ghost"
                  onClick={() => update('members', m.id, { failedAttempts: 0, lockUntil: null })}
                >
                  🔓 Débloquer
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
        </div>
      </section>

      {!showAddForm && (
        <button className="primary add-btn" onClick={() => setShowAddForm(true)}>
          + Ajouter un membre
        </button>
      )}
      {showAddForm && (
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
          <p className="muted">💡 6 chiffres, c’est plus sûr (4 à 6 acceptés).</p>
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
          <div className="two">
            <button className="primary">Ajouter</button>
            <button type="button" className="link" onClick={() => setShowAddForm(false)}>
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="cols">
      <section>
        <h3>Comptes à rebours</h3>

        <form onSubmit={saveTimezone} className="two">
          <input
            className="grow"
            placeholder="Fuseau horaire (ex. America/Miquelon)"
            value={timezoneInput}
            onChange={(e) => setTimezoneInput(e.target.value)}
          />
          <button className="primary">{tzSaved ? '✅' : 'OK'}</button>
        </form>
        <p className="muted">Utilisé pour calculer les jours restants (carte « Agenda »).</p>

        {countdowns.map((c) => (
          <div key={c.id} className="row">
            <div className="grow">
              <b>{c.title}</b>
              <div className="muted">{c.date}</div>
            </div>
            <button className="icon" title="Modifier" onClick={() => startEditCountdown(c)}>
              ✏️
            </button>
            <button className="icon" title="Supprimer" onClick={() => removeCountdown(c)}>
              🗑️
            </button>
          </div>
        ))}

        {!showCdForm ? (
          <button className="primary add-btn" onClick={() => setShowCdForm(true)}>
            + Ajouter un compte à rebours
          </button>
        ) : (
          <form onSubmit={submitCountdown} className="card">
            <h2>{cdEditId ? 'Modifier le compte à rebours' : 'Nouveau compte à rebours'}</h2>
            <input placeholder="Titre (ex. Vacances d’été)" value={cdTitle} onChange={(e) => setCdTitle(e.target.value)} />
            <input type="date" value={cdDate} onChange={(e) => setCdDate(e.target.value)} />
            <div className="two">
              <button className="primary">{cdEditId ? 'Enregistrer' : 'Ajouter'}</button>
              <button type="button" className="link" onClick={resetCountdownForm}>
                Annuler
              </button>
            </div>
          </form>
        )}
      </section>

      <div>
      {me.admin && (
        <form onSubmit={savePointValue} className="card">
          <h2>Points de corvées</h2>
          <p className="muted">Valeur d’un point en euros (facultatif) — affiche l’équivalent en euros des points gagnés.</p>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="Ex. 0,20"
            value={pointValueInput}
            onChange={(e) => setPointValueInput(e.target.value)}
          />
          <button className="primary">{pvSaved ? 'Enregistré ✅' : 'Enregistrer'}</button>
        </form>
      )}

      {me.admin && (
        <section className="card">
          <h2>Sauvegarde</h2>
          <button className="primary" onClick={downloadBackup} disabled={backing}>
            {backing ? 'Préparation…' : 'Télécharger une sauvegarde'}
          </button>
          <p className="muted">
            {lastBackup
              ? `Dernière sauvegarde sur cet appareil : ${new Date(lastBackup).toLocaleString('fr-FR')}`
              : 'Aucune sauvegarde faite sur cet appareil pour l’instant.'}
          </p>
          <p className="muted">💡 Pense à sauvegarder de temps en temps.</p>
        </section>
      )}
      </div>
      </div>
    </div>
  )
}
