import { useState } from 'react'
import { update } from '../db'
import { enableNotifications, isIos, isStandalone } from '../messaging'

const REASONS = {
  unsupported: "Ce téléphone ou ce navigateur ne gère pas les notifications web.",
  'need-home-screen': "Sur iPhone, ajoute d'abord l'app à l'écran d'accueil (bouton Partager → « Sur l'écran d'accueil »), puis ouvre-la depuis cette icône avant de réessayer.",
  denied: "Permission refusée. Va dans les réglages de notifications de ton téléphone pour l'autoriser, puis réessaie.",
  'no-vapid-key': "Les notifications ne sont pas encore configurées pour cette app (clé manquante).",
  'no-token': "Impossible de récupérer un identifiant de notification. Réessaie dans un instant.",
  error: "Une erreur est survenue. Réessaie dans un instant.",
}

export default function Notifications({ me, onDone }) {
  const [status, setStatus] = useState(null) // 'loading' | 'ok' | 'ko'
  const [reason, setReason] = useState('')
  const showIosHint = isIos() && !isStandalone()

  async function activate() {
    setStatus('loading')
    const res = await enableNotifications(me)
    if (res.ok) {
      setStatus('ok')
    } else {
      setStatus('ko')
      setReason(res.reason)
    }
  }

  return (
    <div className="card">
      <h2>Notifications</h2>
      <p className="muted">
        Reçois un rappel avant tes rendez-vous. Sur iPhone, ajoute d'abord « Planning famille » à l'écran d'accueil
        (Safari → Partager → « Sur l'écran d'accueil »), puis ouvre l'app depuis cette icône pour activer les
        notifications.
      </p>

      {showIosHint && <p className="error">{REASONS['need-home-screen']}</p>}

      <button className="primary" onClick={activate} disabled={status === 'loading'}>
        {status === 'loading' ? 'Activation…' : 'Activer les notifications'}
      </button>
      {status === 'ok' && <p className="muted">✅ Notifications activées sur cet appareil.</p>}
      {status === 'ko' && <p className="error">{REASONS[reason] || "Impossible d'activer les notifications."}</p>}

      <h3 className="no-top">Mes rappels</h3>
      <label className="check">
        <input
          type="checkbox"
          checked={!!me.remindEve}
          onChange={(e) => update('members', me.id, { remindEve: e.target.checked })}
        />
        <span>La veille à 18h</span>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={!!me.remindHour}
          onChange={(e) => update('members', me.id, { remindHour: e.target.checked })}
        />
        <span>1h avant</span>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={!!me.remindMorning}
          onChange={(e) => update('members', me.id, { remindMorning: e.target.checked })}
        />
        <span>Résumé du matin (rendez-vous + corvées du jour)</span>
      </label>
      {!!me.remindMorning && (
        <input
          type="time"
          value={me.remindMorningTime || '07:00'}
          onChange={(e) => update('members', me.id, { remindMorningTime: e.target.value })}
        />
      )}

      {me.role === 'parent' && (
        <label className="check">
          <input
            type="checkbox"
            checked={!!me.remindChildren}
            onChange={(e) => update('members', me.id, { remindChildren: e.target.checked })}
          />
          <span>Recevoir aussi les rappels des enfants</span>
        </label>
      )}

      <button type="button" className="link" onClick={onDone}>
        Fermer
      </button>
    </div>
  )
}
