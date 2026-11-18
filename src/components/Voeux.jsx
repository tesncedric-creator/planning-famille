import { useEffect, useState } from 'react'
import { subscribe, add, update, remove } from '../db'

const OCCASIONS = [
  ['noel', '🎄 Noël'],
  ['anniversaire', '🎂 Anniversaire'],
]

export default function Voeux({ me, members }) {
  const isParent = me.role === 'parent'
  const [wishes, setWishes] = useState([])
  const [owner, setOwner] = useState(me.id)
  const [occ, setOcc] = useState('noel')
  const [title, setTitle] = useState('')
  const [link, setLink] = useState('')

  useEffect(() => subscribe('wishes', setWishes), [])

  const owner_ = members.find((m) => m.id === owner) || me
  const isOwnList = owner_.id === me.id
  const canEdit = isOwnList || isParent
  const nameOf = (id) => (members.find((m) => m.id === id) || {}).name || '?'

  const list = wishes
    .filter((w) => w.ownerId === owner_.id && w.occasion === occ)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))

  async function submit(e) {
    e.preventDefault()
    if (!title.trim()) return
    let l = link.trim()
    if (l && !/^https?:\/\//i.test(l)) l = 'https://' + l
    await add('wishes', { ownerId: owner_.id, occasion: occ, title: title.trim(), link: l, reservedBy: null })
    setTitle('')
    setLink('')
  }

  return (
    <div>
      <div className="chips pick tabs">
        {members.map((m) => (
          <button
            key={m.id}
            className={'chip' + (m.id === owner_.id ? ' on' : '')}
            style={m.id === owner_.id ? { background: m.color, color: '#fff' } : { borderColor: m.color }}
            onClick={() => setOwner(m.id)}
          >
            {m.id === me.id ? 'Moi' : m.name}
          </button>
        ))}
      </div>

      <div className="seg">
        {OCCASIONS.map(([k, label]) => (
          <button key={k} className={occ === k ? 'active' : ''} onClick={() => setOcc(k)}>
            {label}
          </button>
        ))}
      </div>

      <h2>
        {isOwnList ? 'Ma liste' : `Liste de ${owner_.name}`}
      </h2>

      {!isOwnList && (
        <p className="muted">
          Tu peux marquer « Je l’offre » : {owner_.name} ne verra jamais qui a réservé (la surprise reste entière).
        </p>
      )}

      {canEdit && (
        <form onSubmit={submit} className="card">
          <input placeholder="Une idée de cadeau…" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input placeholder="Lien (facultatif)" value={link} onChange={(e) => setLink(e.target.value)} />
          <button className="primary">Ajouter à la liste</button>
        </form>
      )}

      {list.length === 0 && <p className="muted center">Rien dans cette liste pour l’instant.</p>}

      {list.map((w) => (
        <div key={w.id} className="row">
          <div className="grow">
            <b>{w.title}</b>
            {w.link && (
              <div>
                <a href={w.link} target="_blank" rel="noreferrer">
                  Voir le lien ↗
                </a>
              </div>
            )}
            {/* La réservation n'est visible que par les autres, jamais par le propriétaire de la liste */}
            {!isOwnList && w.reservedBy && <div className="muted">🎁 Réservé par {w.reservedBy === me.id ? 'toi' : nameOf(w.reservedBy)}</div>}
          </div>
          {!isOwnList && !w.reservedBy && (
            <button className="small" onClick={() => update('wishes', w.id, { reservedBy: me.id })}>
              Je l’offre
            </button>
          )}
          {!isOwnList && w.reservedBy === me.id && (
            <button className="small ghost" onClick={() => update('wishes', w.id, { reservedBy: null })}>
              Annuler
            </button>
          )}
          {canEdit && (
            <button className="icon" title="Supprimer" onClick={() => window.confirm('Retirer cette idée ?') && remove('wishes', w.id)}>
              🗑️
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
