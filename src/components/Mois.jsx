import { useState } from 'react'
import { dateStr } from '../utils'

const JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const GRIS = '#9ca3af' // rendez-vous sans personne cochée

export default function Mois({ events, members, selected, onSelect }) {
  const [cursor, setCursor] = useState(() => {
    const d = selected ? new Date(selected + 'T00:00') : new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const offset = (new Date(year, month, 1).getDay() + 6) % 7 // semaine qui commence le lundi
  const nbDays = new Date(year, month + 1, 0).getDate()
  const weeks = Math.ceil((offset + nbDays) / 7)
  const today = dateStr(new Date())

  // date -> liste des couleurs (une par personne, pas de doublon)
  const byDay = {}
  const recurDays = new Set()
  const birthdayDays = new Set()
  // date -> rendez-vous du jour (hors anniversaires), pour l'aperçu affiché sur grand écran
  const itemsByDay = {}
  events.forEach((ev) => {
    const ids = ev.who && ev.who.length ? ev.who : ['_']
    byDay[ev.date] = byDay[ev.date] || []
    ids.forEach((id) => {
      if (!byDay[ev.date].includes(id)) byDay[ev.date].push(id)
    })
    if (ev.recurring) recurDays.add(ev.date)
    if (ev.isBirthday) birthdayDays.add(ev.date)
    else (itemsByDay[ev.date] = itemsByDay[ev.date] || []).push(ev)
  })
  const colorOf = (id) => (members.find((m) => m.id === id) || {}).color || GRIS

  const cells = []
  for (let i = 0; i < weeks * 7; i++) {
    cells.push(new Date(year, month, 1 - offset + i))
  }

  const title = cursor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const go = (n) => setCursor(new Date(year, month + n, 1))

  return (
    <div className="card cal">
      <div className="cal-head">
        <button className="icon" onClick={() => go(-1)} aria-label="Mois précédent">
          ◀
        </button>
        <b>{title.charAt(0).toUpperCase() + title.slice(1)}</b>
        <button className="icon" onClick={() => go(1)} aria-label="Mois suivant">
          ▶
        </button>
      </div>

      <div className="cal-grid">
        {JOURS.map((j, i) => (
          <div key={i} className="cal-dow">
            {j}
          </div>
        ))}
        {cells.map((d) => {
          const ds = dateStr(d)
          const inMonth = d.getMonth() === month
          const ids = byDay[ds] || []
          const dayItems = itemsByDay[ds] || []
          return (
            <button
              key={ds}
              className={
                'cal-day' + (inMonth ? '' : ' out') + (ds === today ? ' today' : '') + (ds === selected ? ' sel' : '')
              }
              onClick={() => onSelect(ds)}
            >
              <span className="num">
                {d.getDate()}
                {recurDays.has(ds) && <span className="recur">↻</span>}
                {birthdayDays.has(ds) && <span className="bday">🎂</span>}
              </span>
              <span className="dots">
                {ids.slice(0, 3).map((id) => (
                  <i key={id} style={{ background: colorOf(id) }} />
                ))}
                {ids.length > 3 && <span className="more">+</span>}
              </span>
              {dayItems.length > 0 && (
                <span className="day-events">
                  {dayItems.slice(0, 3).map((ev) => (
                    <span key={ev.occId} className="day-event" style={{ background: colorOf((ev.who && ev.who[0]) || '_') }}>
                      {ev.time && <b>{ev.time}</b>} {ev.title}
                    </span>
                  ))}
                  {dayItems.length > 3 && <span className="day-event-more">+{dayItems.length - 3} autres</span>}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="legend">
        {members.map((m) => (
          <span key={m.id}>
            <i style={{ background: m.color }} />
            {m.name}
          </span>
        ))}
      </div>
    </div>
  )
}
