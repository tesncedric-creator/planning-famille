import { useEffect, useState } from 'react'
import { subscribe, add, update, remove } from '../db'
import Menus from './Menus'

const STATUS = {
  proposed: '⏳ En attente',
  approved: '✅ Validé',
  rejected: '❌ Refusé',
}

export default function Courses({ me, members }) {
  const isParent = me.role === 'parent'
  const [items, setItems] = useState([])
  const [habits, setHabits] = useState([])
  const [name, setName] = useState('')
  const [qty, setQty] = useState('')
  const [sub, setSub] = useState('liste')

  useEffect(() => subscribe('courses', setItems), [])
  useEffect(() => subscribe('habits', setHabits), [])

  const nameOf = (id) => (members.find((m) => m.id === id) || {}).name || '?'
  const byDate = (a, b) => (a.createdAt || 0) - (b.createdAt || 0)
  const byName = (a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })

  const proposed = items.filter((i) => i.status === 'proposed').sort(byName)
  // Les articles cochés (achetés) descendent en bas de la liste, triés alphabétiquement entre eux
  const approved = items
    .filter((i) => i.status === 'approved')
    .sort((a, b) => (!!a.bought === !!b.bought ? byName(a, b) : a.bought ? 1 : -1))
  const rejected = items.filter((i) => i.status === 'rejected').sort(byDate)
  const mine = items.filter((i) => i.addedBy === me.id && i.status !== 'approved').sort(byDate)
  const topHabits = [...habits].sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 8)

  async function addCourseItem(n, q) {
    // Un parent ajoute directement à la liste ; un enfant fait une proposition à valider
    await add('courses', { name: n, qty: q || '', addedBy: me.id, status: isParent ? 'approved' : 'proposed', bought: false })
  }

  async function submit(e) {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    await addCourseItem(n, qty.trim())
    setName('')
    setQty('')
  }

  async function quickAdd(n) {
    await addCourseItem(n, '')
  }

  async function bumpHabit(itemName) {
    const key = itemName.trim().toLowerCase()
    if (!key) return
    const existing = habits.find((h) => h.key === key)
    if (existing) await update('habits', existing.id, { count: (existing.count || 0) + 1, name: itemName.trim() })
    else await add('habits', { key, name: itemName.trim(), count: 1 })
  }

  async function toggleBought(i) {
    const nowBought = !i.bought
    await update('courses', i.id, { bought: nowBought })
    if (nowBought) await bumpHabit(i.name)
  }

  async function clearBought() {
    const toDelete = approved.filter((i) => i.bought)
    if (toDelete.length === 0) return
    if (!window.confirm(`Vider ${toDelete.length} article(s) acheté(s) ?`)) return
    await Promise.all(toDelete.map((i) => remove('courses', i.id)))
  }

  async function clearRejected() {
    if (rejected.length === 0) return
    if (!window.confirm(`Supprimer ${rejected.length} article(s) refusé(s) ?`)) return
    await Promise.all(rejected.map((i) => remove('courses', i.id)))
  }

  return (
    <div>
      <div className="seg">
        <button className={sub === 'liste' ? 'active' : ''} onClick={() => setSub('liste')}>
          Liste
        </button>
        <button className={sub === 'menus' ? 'active' : ''} onClick={() => setSub('menus')}>
          Menus
        </button>
      </div>

      {sub === 'menus' ? (
        <Menus me={me} courseItems={items} />
      ) : (
      <>
      <form onSubmit={submit} className="card">
        <h2>{isParent ? 'Ajouter aux courses' : 'Je voudrais aux courses…'}</h2>
        <input
          placeholder={isParent ? 'Lait, pain, pommes…' : 'Ce que j’aimerais bien…'}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="two">
          <input className="grow" placeholder="Quantité (ex. 2, 1 kg) — facultatif" value={qty} onChange={(e) => setQty(e.target.value)} />
          <button className="primary">{isParent ? 'Ajouter' : 'Proposer'}</button>
        </div>
        {!isParent && <p className="muted">Ta demande sera vue par un parent, qui dira oui ou non.</p>}
      </form>

      {topHabits.length > 0 && (
        <div className="card">
          <h3 className="no-top">Souvent achetés</h3>
          <div className="chips">
            {topHabits.map((h) => (
              <button key={h.id} type="button" className="chip add" onClick={() => quickAdd(h.name)}>
                {h.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {isParent && proposed.length > 0 && (
        <section>
          <h3>À valider ({proposed.length})</h3>
          {proposed.map((i) => (
            <div key={i.id} className="row">
              <div className="grow">
                <b>
                  {i.name}
                  {i.qty && <span className="muted"> · {i.qty}</span>}
                </b>
                <div className="muted">demandé par {nameOf(i.addedBy)}</div>
              </div>
              <button className="icon ok" title="Valider" onClick={() => update('courses', i.id, { status: 'approved' })}>
                ✅
              </button>
              <button className="icon" title="Refuser" onClick={() => update('courses', i.id, { status: 'rejected' })}>
                ❌
              </button>
            </div>
          ))}
        </section>
      )}

      <section>
        <h3>Liste de courses ({approved.filter((i) => !i.bought).length})</h3>
        {approved.length === 0 && <p className="muted">Rien pour l’instant.</p>}
        {approved.map((i) => (
          <div key={i.id} className={'row' + (i.bought ? ' done' : '')}>
            <label className="grow check">
              <input type="checkbox" checked={!!i.bought} onChange={() => toggleBought(i)} />
              <span>
                {i.name}
                {i.qty && <span className="muted"> · {i.qty}</span>}
                {i.addedBy !== me.id && <span className="muted"> · {nameOf(i.addedBy)}</span>}
              </span>
            </label>
            {isParent && (
              <button className="icon" title="Supprimer" onClick={() => remove('courses', i.id)}>
                🗑️
              </button>
            )}
          </div>
        ))}
        {isParent && approved.some((i) => i.bought) && (
          <button className="link" onClick={clearBought}>
            Vider ce qui est acheté
          </button>
        )}
        {isParent && rejected.length > 0 && (
          <button className="link" onClick={clearRejected}>
            Supprimer les refusés ({rejected.length})
          </button>
        )}
      </section>

      {!isParent && mine.length > 0 && (
        <section>
          <h3>Mes demandes</h3>
          {mine.map((i) => (
            <div key={i.id} className="row">
              <div className="grow">
                <b>
                  {i.name}
                  {i.qty && <span className="muted"> · {i.qty}</span>}
                </b>
                <div className="muted">{STATUS[i.status]}</div>
              </div>
              <button className="icon" title="Retirer" onClick={() => remove('courses', i.id)}>
                🗑️
              </button>
            </div>
          ))}
        </section>
      )}
      </>
      )}
    </div>
  )
}
