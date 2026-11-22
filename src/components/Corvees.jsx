import { useEffect, useState } from 'react'
import { subscribe, add, update, remove } from '../db'
import { todayStr, chorePeriod, choreAssignee, weekIndexOf, weekDatesSoFar } from '../utils'

const FREQ = [
  ['daily', 'Chaque jour'],
  ['weekly', 'Chaque semaine'],
  ['once', 'Une seule fois'],
]
const FREQ_LABEL = Object.fromEntries(FREQ)

export default function Corvees({ me, members }) {
  const isParent = me.role === 'parent'
  const [chores, setChores] = useState([])
  const [done, setDone] = useState([])
  const [payments, setPayments] = useState([])
  const [reglages, setReglages] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [title, setTitle] = useState('')
  const [frequency, setFrequency] = useState('daily')
  const [points, setPoints] = useState('1')
  const [assignMode, setAssignMode] = useState('person')
  const [assigneeId, setAssigneeId] = useState(me.id)
  const [rotationIds, setRotationIds] = useState([])
  const [err, setErr] = useState('')

  useEffect(() => subscribe('corvees', setChores), [])
  useEffect(() => subscribe('corveesFaites', setDone), [])
  useEffect(() => subscribe('pointsPayes', setPayments), [])
  useEffect(() => subscribe('reglages', (rows) => setReglages(rows.find((r) => r.id === 'famille') || null)), [])

  const today = todayStr()
  const pointValue = reglages && reglages.pointValue != null ? reglages.pointValue : null
  const euroFor = (pts) => (pointValue ? (pts * pointValue).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) : null)

  const nameOf = (id) => (members.find((m) => m.id === id) || {}).name || '?'
  const isDone = (choreId, period) => done.some((d) => d.choreId === choreId && d.period === period)
  const choresFor = (memberId) => chores.filter((c) => choreAssignee(c, today) === memberId)
  const myChores = choresFor(me.id)

  const pointsEarned = (memberId) => done.filter((d) => d.by === memberId).reduce((sum, d) => sum + (d.points || 0), 0)
  const pointsPaidOut = (memberId) => payments.filter((p) => p.memberId === memberId).reduce((sum, p) => sum + (p.points || 0), 0)
  const pointsBalance = (memberId) => pointsEarned(memberId) - pointsPaidOut(memberId)
  const pointsThisWeek = (memberId) => {
    const dates = weekDatesSoFar(today)
    return done.filter((d) => d.by === memberId && dates.includes(d.date)).reduce((sum, d) => sum + (d.points || 0), 0)
  }

  async function toggle(chore, period, memberId) {
    const rec = done.find((d) => d.choreId === chore.id && d.period === period)
    if (rec) await remove('corveesFaites', rec.id)
    else await add('corveesFaites', { choreId: chore.id, period, by: memberId, date: today, points: chore.points || 1 })
  }

  async function payOut(memberId) {
    const balance = pointsBalance(memberId)
    if (balance <= 0) return
    if (!window.confirm(`Marquer ${balance} point${balance > 1 ? 's' : ''} comme payé${balance > 1 ? 's' : ''} à ${nameOf(memberId)} ?`)) return
    await add('pointsPayes', { memberId, points: balance, date: today })
  }

  function startEdit(c) {
    setEditId(c.id)
    setTitle(c.title)
    setFrequency(c.frequency)
    setPoints(String(c.points || 1))
    setAssignMode(c.assignMode)
    setAssigneeId(c.assigneeId || me.id)
    setRotationIds(c.rotationIds || [])
    setErr('')
    setShowForm(true)
  }

  function resetForm() {
    setEditId(null)
    setTitle('')
    setFrequency('daily')
    setPoints('1')
    setAssignMode('person')
    setAssigneeId(me.id)
    setRotationIds([])
    setErr('')
    setShowForm(false)
  }

  const toggleRotation = (id) => setRotationIds((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]))

  async function submit(e) {
    e.preventDefault()
    if (!title.trim()) return setErr('Mets un titre')
    if (assignMode === 'rotation' && rotationIds.length < 2) return setErr('Choisis au moins deux personnes pour le tour de rôle')
    const pts = parseInt(points, 10)
    const data = {
      title: title.trim(),
      frequency,
      points: Number.isFinite(pts) && pts > 0 ? pts : 1,
      assignMode,
      assigneeId: assignMode === 'person' ? assigneeId : null,
      rotationIds: assignMode === 'rotation' ? rotationIds : [],
    }
    if (editId) await update('corvees', editId, data)
    else await add('corvees', { ...data, createdBy: me.id })
    resetForm()
  }

  async function removeChore(c) {
    if (!window.confirm(`Supprimer « ${c.title} » ?`)) return
    await remove('corvees', c.id)
  }

  function assignLabel(c) {
    if (c.assignMode === 'rotation') {
      const names = (c.rotationIds || []).map(nameOf).join(', ')
      return `Tour de rôle (${names}) · aujourd’hui : ${nameOf(choreAssignee(c, today))}`
    }
    return `Assigné à ${nameOf(c.assigneeId)}`
  }

  function weeklyStats(memberId) {
    const dates = weekDatesSoFar(today)
    const wk = 'W' + weekIndexOf(today)
    let total = 0
    let doneCount = 0
    chores.forEach((c) => {
      if (c.frequency === 'once') return
      if (choreAssignee(c, today) !== memberId) return
      if (c.frequency === 'daily') {
        total += dates.length
        dates.forEach((d) => { if (isDone(c.id, d)) doneCount++ })
      } else {
        total += 1
        if (isDone(c.id, wk)) doneCount++
      }
    })
    return { total, doneCount }
  }

  function renderChoreRow(c, memberId) {
    const period = chorePeriod(c, today)
    const checked = isDone(c.id, period)
    return (
      <div key={c.id} className={'row' + (checked ? ' done' : '')}>
        <label className="grow check">
          <input type="checkbox" checked={checked} onChange={() => toggle(c, period, memberId)} />
          <span>{c.title}</span>
        </label>
      </div>
    )
  }

  const familyHasChores = members.some((m) => choresFor(m.id).length > 0)

  return (
    <div>
      <section>
        <h3>Mes corvées du jour</h3>
        <p className="muted">
          💰 {pointsBalance(me.id)} pt{pointsBalance(me.id) > 1 ? 's' : ''}
          {euroFor(pointsBalance(me.id)) ? ` (≈ ${euroFor(pointsBalance(me.id))})` : ''}
        </p>
        {myChores.length === 0 ? (
          <p className="muted">Rien pour toi aujourd’hui 🎉</p>
        ) : (
          myChores.map((c) => renderChoreRow(c, me.id))
        )}
      </section>

      {isParent && (
        <section>
          <h3>Toute la famille</h3>

          {members
            .filter((m) => m.role === 'enfant')
            .map((m) => {
              const weekPts = pointsThisWeek(m.id)
              const balance = pointsBalance(m.id)
              const history = payments.filter((p) => p.memberId === m.id).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
              return (
                <div key={m.id} className="row">
                  <div className="grow">
                    <b>{m.name}</b>
                    <div className="muted">
                      {weekPts} pt{weekPts > 1 ? 's' : ''} cette semaine · {balance} pt{balance > 1 ? 's' : ''} au total
                      {euroFor(balance) ? ` (≈ ${euroFor(balance)})` : ''}
                    </div>
                    {history.length > 0 && (
                      <div className="muted">
                        {history.map((p) => (
                          <div key={p.id}>payé le {p.date} : {p.points} pts</div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button className="small ghost" disabled={balance <= 0} onClick={() => payOut(m.id)}>
                    Payer
                  </button>
                </div>
              )
            })}

          {!familyHasChores ? (
            <p className="muted">Personne n’a de corvée aujourd’hui</p>
          ) : (
            <>
              <div className="chips">
                {members
                  .filter((m) => m.role === 'enfant')
                  .map((m) => {
                    const { total, doneCount } = weeklyStats(m.id)
                    if (total === 0) return null
                    return (
                      <span key={m.id} className="chip" style={{ background: m.color }}>
                        {m.name} : {doneCount} faite{doneCount > 1 ? 's' : ''} sur {total}
                      </span>
                    )
                  })}
              </div>

              {members.map((m) => {
                const list = choresFor(m.id)
                if (list.length === 0) return null
                return (
                  <div key={m.id} className="chore-member">
                    <div className="chore-member-head">
                      <span className="avatar" style={{ background: m.color }}>
                        {m.name.charAt(0).toUpperCase()}
                      </span>
                      <b>{m.name}</b>
                    </div>
                    {list.map((c) => renderChoreRow(c, m.id))}
                  </div>
                )
              })}
            </>
          )}
        </section>
      )}

      {isParent && (
        <>
          {!showForm && (
            <button className="primary add-btn" onClick={() => setShowForm(true)}>
              + Nouvelle corvée
            </button>
          )}
          {showForm && (
            <form onSubmit={submit} className="card">
              <h2>{editId ? 'Modifier la corvée' : 'Nouvelle corvée'}</h2>
              <input
                placeholder="Sortir les poubelles, mettre la table…"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                {FREQ.map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                placeholder="Points (1 par défaut)"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
              />
              <div className="seg">
                <button type="button" className={assignMode === 'person' ? 'active' : ''} onClick={() => setAssignMode('person')}>
                  Une personne
                </button>
                <button type="button" className={assignMode === 'rotation' ? 'active' : ''} onClick={() => setAssignMode('rotation')}>
                  Tour de rôle
                </button>
              </div>
              {assignMode === 'person' ? (
                <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="chips pick">
                  {members.map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      className={'chip' + (rotationIds.includes(m.id) ? ' on' : '')}
                      style={rotationIds.includes(m.id) ? { background: m.color, color: '#fff' } : { borderColor: m.color }}
                      onClick={() => toggleRotation(m.id)}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              )}
              {err && <p className="error">{err}</p>}
              <div className="two">
                <button className="primary">{editId ? 'Enregistrer' : 'Ajouter'}</button>
                <button type="button" className="link" onClick={resetForm}>
                  Annuler
                </button>
              </div>
            </form>
          )}

          <section>
            <h3>Corvées de la famille</h3>
            {chores.length === 0 && <p className="muted">Aucune corvée pour l’instant.</p>}
            {chores.map((c) => (
              <div key={c.id} className="row">
                <div className="grow">
                  <b>{c.title}</b>
                  <div className="muted">
                    {FREQ_LABEL[c.frequency]} · {c.points || 1} pt{(c.points || 1) > 1 ? 's' : ''} · {assignLabel(c)}
                  </div>
                </div>
                <button className="icon" title="Modifier" onClick={() => startEdit(c)}>
                  ✏️
                </button>
                <button className="icon" title="Supprimer" onClick={() => removeChore(c)}>
                  🗑️
                </button>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  )
}
