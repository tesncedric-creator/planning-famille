import { dateStr, dayLabel } from '../utils'

export default function Semaine({ events, members }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return dateStr(d)
  })

  return (
    <div>
      {days.map((ds) => {
        const dayEvents = events
          .filter((e) => e.date === ds)
          .sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'))
        return (
          <div key={ds} className="card">
            <h2>{dayLabel(ds)}</h2>
            {dayEvents.length === 0 ? (
              <p className="muted">Rien de prévu.</p>
            ) : (
              dayEvents.map((ev) => (
                <div key={ev.occId} className="row event">
                  <div className="grow">
                    <b>
                      {ev.time && <span className="time">{ev.time}</span>} {ev.title}
                      {ev.recurring && <span className="recur"> ↻</span>}
                    </b>
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
                </div>
              ))
            )}
          </div>
        )
      })}
    </div>
  )
}
