import { useState } from 'react'
import { dateStr } from '../utils'

const GRIS = '#9ca3af'
const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

export default function Annee({ events, members, selected, onPick }) {
  const [year, setYear] = useState(() => Number((selected || dateStr(new Date())).slice(0, 4)))
  const today = dateStr(new Date())

  // date -> couleurs des personnes concernées
  const byDay = {}
  const birthdayDays = new Set()
  events.forEach((ev) => {
    const ids = ev.who && ev.who.length ? ev.who : ['_']
    byDay[ev.date] = byDay[ev.date] || []
    ids.forEach((id) => {
      if (!byDay[ev.date].includes(id)) byDay[ev.date].push(id)
    })
    if (ev.isBirthday) birthdayDays.add(ev.date)
  })
  const colorOf = (id) => (members.find((m) => m.id === id) || {}).color || GRIS

  function bg(colors) {
    if (colors.length === 1) return colors[0]
    const step = 100 / colors.length
    const parts = colors.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`)
    return `linear-gradient(135deg, ${parts.join(', ')})`
  }

  return (
    <div className="card">
      <div className="cal-head">
        <button className="icon" onClick={() => setYear(year - 1)} aria-label="Année précédente">
          ◀
        </button>
        <b>{year}</b>
        <button className="icon" onClick={() => setYear(year + 1)} aria-label="Année suivante">
          ▶
        </button>
      </div>

      <div className="year-grid">
        {MOIS.map((nom, m) => {
          const offset = (new Date(year, m, 1).getDay() + 6) % 7
          const nbDays = new Date(year, m + 1, 0).getDate()
          const cells = []
          for (let i = 0; i < offset; i++) cells.push(<span key={'v' + i} />)
          for (let d = 1; d <= nbDays; d++) {
            const ds = dateStr(new Date(year, m, d))
            const ids = byDay[ds]
            const colored = ids && ids.length > 0
            const hasBirthday = birthdayDays.has(ds)
            cells.push(
              <button
                key={ds}
                className={'y-day' + (colored ? ' has' : '') + (ds === today ? ' today' : '') + (hasBirthday ? ' bday' : '')}
                style={colored && !hasBirthday ? { background: bg(ids.map(colorOf)) } : undefined}
                title={hasBirthday ? '🎂 Anniversaire' : undefined}
                onClick={() => onPick(ds)}
              >
                {hasBirthday ? '🎂' : d}
              </button>
            )
          }
          return (
            <div key={m} className="y-month">
              <button className="y-title" onClick={() => onPick(dateStr(new Date(year, m, 1)))}>
                {nom}
              </button>
              <div className="y-cells">{cells}</div>
            </div>
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
