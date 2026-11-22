import { useEffect, useState } from 'react'
import { subscribe, add, update, remove } from '../db'
import {
  dayLabel, todayStr, dateStr, expandEvents, REPEAT_LABELS, birthdaysInRange,
  todayInTz, daysUntil, nextAnnualDate, nextBirthday,
} from '../utils'
import Mois from './Mois'
import Annee from './Annee'
import Semaine from './Semaine'

function formatCountdown({ emoji, title, days }) {
  if (days === 0) return title === 'Noël' ? '🎄 C’est Noël !' : `${emoji} ${title} : c’est aujourd’hui !`
  return `${emoji} ${title} dans ${days} jour${days > 1 ? 's' : ''}`
}

export default function Agenda({ me, members }) {
  const isParent = me.role === 'parent'
  const [events, setEvents] = useState([])
  const [countdowns, setCountdowns] = useState([])
  const [reglages, setReglages] = useState(null)
  const [view, setView] = useState('mois')
  const [selected, setSelected] = useState(todayStr())
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null) // { ev, scope: 'series' | 'single' }
  const [scopeFor, setScopeFor] = useState(null) // { action: 'edit' | 'delete', ev }
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(todayStr())
  const [time, setTime] = useState('')
  const [who, setWho] = useState([])
  const [note, setNote] = useState('')
  const [location, setLocation] = useState('')
  const [driver, setDriver] = useState('')
  const [repeat, setRepeat] = useState('none')
  const [repeatUntil, setRepeatUntil] = useState('')
  const [showPast, setShowPast] = useState(false)

  useEffect(() => subscribe('events', setEvents), [])
  useEffect(() => subscribe('comptesARebours', setCountdowns), [])
  useEffect(() => subscribe('reglages', (rows) => setReglages(rows.find((r) => r.id === 'famille') || null)), [])

  const today = todayStr()
  const todayTz = todayInTz(reglages && reglages.timezone)

  const countdownEntries = (() => {
    const list = [{ emoji: '🎄', title: 'Noël', date: nextAnnualDate(12, 25, todayTz) }]
    countdowns
      .filter((c) => c.date >= todayTz)
      .forEach((c) => list.push({ emoji: '📅', title: c.title, date: c.date }))
    const nextBirthdays = members
      .map((m) => ({ m, date: nextBirthday(m, todayTz) }))
      .filter((x) => x.date)
      .sort((a, b) => a.date.localeCompare(b.date))
    if (nextBirthdays.length > 0) {
      list.push({ emoji: '🎂', title: `Anniversaire de ${nextBirthdays[0].m.name}`, date: nextBirthdays[0].date })
    }
    return list
      .map((e) => ({ ...e, days: daysUntil(e.date, todayTz) }))
      .sort((a, b) => a.days - b.days)
      .slice(0, 3)
  })()
  const now = new Date()
  // Fenêtre large pour calculer les occurrences (couvre largement la navigation Mois/Année/Liste)
  const rangeStart = dateStr(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()))
  const rangeEnd = dateStr(new Date(now.getFullYear() + 3, now.getMonth(), now.getDate()))
  const nameOf = (id) => (members.find((m) => m.id === id) || {}).name || '?'

  // Anniversaires calculés à l'affichage, jamais stockés comme rendez-vous : on les mélange aux
  // occurrences réelles pour qu'ils apparaissent automatiquement dans toutes les vues (Mois/Année/Semaine/Liste).
  const birthdayOccurrences = birthdaysInRange(members, rangeStart, rangeEnd).map(({ member, date, age }) => ({
    id: 'bday-' + member.id + '@' + date,
    occId: 'bday-' + member.id + '@' + date,
    date,
    time: '',
    title: `🎂 Anniversaire de ${member.name}${age != null ? ` (${age} ans)` : ''}`,
    who: [member.id],
    isBirthday: true,
    recurring: false,
  }))

  const key = (e) => e.date + ' ' + (e.time || '00:00')
  const occurrences = [...expandEvents(events, rangeStart, rangeEnd), ...birthdayOccurrences].sort((a, b) =>
    key(a).localeCompare(key(b))
  )

  const upcoming = occurrences.filter((e) => e.date >= today)
  const past = occurrences.filter((e) => e.date < today).reverse()
  const dayEvents = occurrences.filter((e) => e.date === selected)

  function openNewForm() {
    setEditing(null)
    setTitle('')
    setDate(selected)
    setTime('')
    setWho([])
    setNote('')
    setLocation('')
    setDriver('')
    setRepeat('none')
    setRepeatUntil('')
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditing(null)
  }

  function openEditForm(ev, dateForForm, scope) {
    setEditing({ ev, scope })
    setTitle(ev.title)
    setDate(dateForForm)
    setTime(ev.time || '')
    setWho(ev.who || [])
    setNote(ev.note || '')
    setLocation(ev.location || '')
    setDriver(ev.driver || '')
    setRepeat(scope === 'single' ? 'none' : ev.repeat || 'none')
    setRepeatUntil(scope === 'single' ? '' : ev.repeatUntil || '')
    setScopeFor(null)
    setShowForm(true)
  }

  function askEdit(ev) {
    if (ev.recurring) setScopeFor({ action: 'edit', ev })
    else openEditForm(ev, ev.anchorDate, 'series')
  }

  function askDelete(ev) {
    if (ev.recurring) setScopeFor({ action: 'delete', ev })
    else if (window.confirm('Supprimer ce rendez-vous ?')) remove('events', ev.id)
  }

  async function handleScope(scope) {
    const { action, ev } = scopeFor
    setScopeFor(null)
    if (action === 'delete') {
      if (scope === 'series') {
        if (window.confirm('Supprimer toute la série ?')) await remove('events', ev.id)
      } else if (window.confirm('Supprimer seulement cette occurrence ?')) {
        await update('events', ev.id, { excludedDates: [...(ev.excludedDates || []), ev.date] })
      }
    } else {
      openEditForm(ev, scope === 'series' ? ev.anchorDate : ev.date, scope)
    }
  }

  async function submit(e) {
    e.preventDefault()
    if (!title.trim() || !date) return
    const payload = {
      title: title.trim(),
      date,
      time,
      who,
      note: note.trim(),
      location: location.trim(),
      driver: driver || null,
      repeat,
      repeatUntil: repeat !== 'none' ? repeatUntil : '',
    }
    if (editing && editing.scope === 'series') {
      await update('events', editing.ev.id, payload)
    } else if (editing && editing.scope === 'single') {
      // Détache cette occurrence : la série continue sans cette date, un évènement indépendant la remplace.
      await update('events', editing.ev.id, { excludedDates: [...(editing.ev.excludedDates || []), editing.ev.date] })
      await add('events', { ...payload, repeat: 'none', repeatUntil: '', addedBy: me.id })
    } else {
      await add('events', { ...payload, addedBy: me.id })
    }
    setSelected(date)
    setShowForm(false)
    setEditing(null)
  }

  const toggleWho = (id) => setWho((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]))

  function pickDay(ds) {
    setSelected(ds)
    setDate(ds) // le formulaire reprend le jour touché
  }

  function renderList(list) {
    const groups = []
    list.forEach((ev) => {
      const last = groups[groups.length - 1]
      if (last && last.date === ev.date) last.items.push(ev)
      else groups.push({ date: ev.date, items: [ev] })
    })
    return groups.map((g) => (
      <section key={g.date}>
        <h3>{dayLabel(g.date)}</h3>
        {g.items.map((ev) => (
          <div key={ev.occId} className={'row event' + (ev.isBirthday ? ' birthday' : '')}>
            <div className="grow">
              <b>
                {ev.time && <span className="time">{ev.time}</span>} {ev.title}
                {ev.recurring && (
                  <span className="recur" title={REPEAT_LABELS[ev.repeat]}>
                    {' '}
                    ↻
                  </span>
                )}
              </b>
              {ev.note && <div className="muted">{ev.note}</div>}
              {ev.location && (
                <div className="muted">
                  📍{' '}
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.location)}`} target="_blank" rel="noreferrer">
                    {ev.location}
                  </a>
                </div>
              )}
              {ev.driver && <div className="muted">🚗 Emmené par {nameOf(ev.driver)}</div>}
              <div className="chips">
                {(ev.who || []).map((id) => {
                  const m = members.find((x) => x.id === id)
                  return m ? (
                    <span key={id} className="chip" style={{ background: m.color }}>
                      {m.name}
                    </span>
                  ) : null
                })}
              </div>
            </div>
            {isParent && !ev.isBirthday && (
              <>
                <button className="icon" title="Modifier" onClick={() => askEdit(ev)}>
                  ✏️
                </button>
                <button className="icon" title="Supprimer" onClick={() => askDelete(ev)}>
                  🗑️
                </button>
              </>
            )}
          </div>
        ))}
      </section>
    ))
  }

  const form = (
    <form onSubmit={submit} className="card">
      <h2>{editing ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous'}</h2>
      <input placeholder="Quoi ? (dentiste, foot, réunion école…)" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="two">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </div>
      <div className="chips pick">
        {members.map((m) => (
          <button
            type="button"
            key={m.id}
            className={'chip' + (who.includes(m.id) ? ' on' : '')}
            style={who.includes(m.id) ? { background: m.color, color: '#fff' } : { borderColor: m.color }}
            onClick={() => toggleWho(m.id)}
          >
            {m.name}
          </button>
        ))}
      </div>
      <input placeholder="Lieu (adresse, nom du lieu…) — facultatif" value={location} onChange={(e) => setLocation(e.target.value)} />
      <select value={driver} onChange={(e) => setDriver(e.target.value)}>
        <option value="">Qui emmène ? (facultatif)</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <input placeholder="Note (à apporter…) — facultatif" value={note} onChange={(e) => setNote(e.target.value)} />
      <select value={repeat} onChange={(e) => setRepeat(e.target.value)}>
        <option value="none">Jamais</option>
        <option value="weekly">Chaque semaine</option>
        <option value="biweekly">Toutes les 2 semaines</option>
        <option value="monthly">Chaque mois</option>
        <option value="yearly">Chaque année</option>
      </select>
      {repeat !== 'none' && (
        <>
          <p className="muted">Se répète jusqu'au (facultatif) :</p>
          <input type="date" value={repeatUntil} onChange={(e) => setRepeatUntil(e.target.value)} />
        </>
      )}
      <div className="two">
        <button className="primary">{editing ? 'Enregistrer' : 'Ajouter'}</button>
        <button type="button" className="link" onClick={closeForm}>
          Annuler
        </button>
      </div>
    </form>
  )

  return (
    <div>
      {countdownEntries.length > 0 && (
        <div className="card countdown-card">
          {countdownEntries.map((e, i) => (
            <p key={e.title + e.date} className={i === 0 ? '' : 'muted'}>
              {formatCountdown(e)}
            </p>
          ))}
        </div>
      )}

      <div className="seg">
        <button className={view === 'mois' ? 'active' : ''} onClick={() => setView('mois')}>
          🗓️ Mois
        </button>
        <button className={view === 'semaine' ? 'active' : ''} onClick={() => setView('semaine')}>
          📅 Semaine
        </button>
        <button className={view === 'annee' ? 'active' : ''} onClick={() => setView('annee')}>
          📆 Année
        </button>
        <button className={view === 'liste' ? 'active' : ''} onClick={() => setView('liste')}>
          📋 Liste
        </button>
      </div>

      {isParent && (
        <>
          {scopeFor ? (
            <div className="card">
              <h2>
                {scopeFor.action === 'edit' ? 'Modifier' : 'Supprimer'} « {scopeFor.ev.title} »
              </h2>
              <p className="muted">
                Ce rendez-vous se répète. Que veux-tu {scopeFor.action === 'edit' ? 'modifier' : 'supprimer'} ?
              </p>
              <div className="choice-stack">
                <button className="primary" onClick={() => handleScope('single')}>
                  Seulement celui-ci ({dayLabel(scopeFor.ev.date)})
                </button>
                <button className="primary" onClick={() => handleScope('series')}>
                  Toute la série
                </button>
                <button className="link" onClick={() => setScopeFor(null)}>
                  Annuler
                </button>
              </div>
            </div>
          ) : showForm ? (
            form
          ) : (
            <button className="primary add-btn" onClick={openNewForm}>
              + Nouveau rendez-vous
            </button>
          )}
        </>
      )}

      {view === 'annee' ? (
        <Annee
          events={occurrences}
          members={members}
          selected={selected}
          onPick={(ds) => {
            pickDay(ds)
            setView('mois') // un clic sur un jour ouvre le mois correspondant
          }}
        />
      ) : view === 'semaine' ? (
        <Semaine events={occurrences} members={members} />
      ) : view === 'mois' ? (
        <>
          <Mois events={occurrences} members={members} selected={selected} onSelect={pickDay} />
          {dayEvents.length === 0 ? (
            <>
              <h3>{dayLabel(selected)}</h3>
              <p className="muted">Rien de prévu ce jour-là.</p>
            </>
          ) : (
            renderList(dayEvents)
          )}
        </>
      ) : (
        <>
          {upcoming.length === 0 ? <p className="muted center">Aucun rendez-vous à venir 🎉</p> : renderList(upcoming)}

          {past.length > 0 && (
            <>
              <button className="link" onClick={() => setShowPast(!showPast)}>
                {showPast ? 'Cacher' : 'Voir'} les rendez-vous passés ({past.length})
              </button>
              {showPast && <div className="past">{renderList(past)}</div>}
            </>
          )}
        </>
      )}
    </div>
  )
}
