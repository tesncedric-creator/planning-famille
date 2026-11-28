import { useEffect, useState } from 'react'
import { subscribe, add, set } from '../db'
import { weekDates, dateStr, todayStr, dayLabel, shortDate } from '../utils'

const MEALS = [
  ['midi', 'Midi'],
  ['soir', 'Soir'],
]
const emptyMeal = () => ({ text: '', ingredients: '' })

export default function Menus({ me, courseItems }) {
  const isParent = me.role === 'parent'
  const [rows, setRows] = useState([])
  const [anchor, setAnchor] = useState(todayStr())
  const [draft, setDraft] = useState({})

  useEffect(() => subscribe('menus', setRows), [])

  const dates = weekDates(anchor)

  useEffect(() => {
    const next = {}
    dates.forEach((d) => {
      const row = rows.find((r) => r.date === d)
      next[d] = {
        midi: { ...emptyMeal(), ...(row && row.midi) },
        soir: { ...emptyMeal(), ...(row && row.soir) },
      }
    })
    setDraft(next)
  }, [rows, anchor])

  function changeWeek(delta) {
    const d = new Date(dates[0] + 'T00:00')
    d.setDate(d.getDate() + delta * 7)
    setAnchor(dateStr(d))
  }

  function updateDraft(date, meal, field, value) {
    setDraft((d) => ({ ...d, [date]: { ...d[date], [meal]: { ...d[date][meal], [field]: value } } }))
  }

  async function saveDay(date) {
    await set('menus', date, { date, midi: draft[date].midi, soir: draft[date].soir })
  }

  const parseIngredients = (text) => text.split(',').map((s) => s.trim()).filter(Boolean)

  async function addToCourses(list) {
    if (list.length === 0) return
    const existing = new Set(courseItems.filter((i) => i.status !== 'rejected').map((i) => i.name.trim().toLowerCase()))
    const toAdd = []
    list.forEach((n) => {
      const key = n.toLowerCase()
      if (existing.has(key)) return
      existing.add(key)
      toAdd.push(n)
    })
    await Promise.all(
      toAdd.map((n) => add('courses', { name: n, qty: '', addedBy: me.id, status: isParent ? 'approved' : 'proposed', bought: false }))
    )
  }

  const addMealIngredients = (date, meal) => addToCourses(parseIngredients(draft[date]?.[meal]?.ingredients || ''))

  const addAllWeek = () =>
    addToCourses(dates.flatMap((d) => MEALS.flatMap(([k]) => parseIngredients(draft[d]?.[k]?.ingredients || ''))))

  return (
    <div>
      <div className="cal-head">
        <button type="button" className="icon" onClick={() => changeWeek(-1)} aria-label="Semaine précédente">◀</button>
        <b>{shortDate(dates[0])} – {shortDate(dates[6])}</b>
        <button type="button" className="icon" onClick={() => changeWeek(1)} aria-label="Semaine suivante">▶</button>
      </div>

      <button type="button" className="link" onClick={() => setAnchor(todayStr())}>
        Revenir à aujourd’hui
      </button>

      <div className="menu-actions">
        <button className="primary" onClick={addAllWeek}>
          🛒 {isParent ? 'Tout ajouter' : 'Tout proposer'} pour la semaine
        </button>
      </div>

      <div className="grille">
      {dates.map((d) => (
        <div key={d} className="card">
          <h3 className="no-top">{dayLabel(d)}</h3>
          {MEALS.map(([key, label]) => {
            const meal = draft[d]?.[key] || emptyMeal()
            return (
              <div key={key} className="menu-meal">
                <div className="menu-meal-label">{label}</div>
                {isParent ? (
                  <input
                    placeholder="Repas…"
                    value={meal.text}
                    onChange={(e) => updateDraft(d, key, 'text', e.target.value)}
                    onBlur={() => saveDay(d)}
                  />
                ) : (
                  <div className="menu-text">{meal.text || <span className="muted">Pas encore prévu</span>}</div>
                )}
                {isParent ? (
                  <input
                    placeholder="Ingrédients séparés par des virgules — facultatif"
                    value={meal.ingredients}
                    onChange={(e) => updateDraft(d, key, 'ingredients', e.target.value)}
                    onBlur={() => saveDay(d)}
                  />
                ) : (
                  meal.ingredients && <div className="muted">Ingrédients : {meal.ingredients}</div>
                )}
                {meal.ingredients && (
                  <button type="button" className="small ghost" onClick={() => addMealIngredients(d, key)}>
                    {isParent ? 'Ajouter aux courses' : 'Proposer aux courses'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      ))}
      </div>
    </div>
  )
}
