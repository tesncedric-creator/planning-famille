import { getMessaging, getToken, isSupported } from 'firebase/messaging'
import { app, useFirebase, update } from './db'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

export function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

// Sur iPhone/iPad, les notifications web ne marchent que si l'app a été ajoutée à l'écran d'accueil
// (Safari ouvert normalement dans un onglet ne peut pas recevoir de notifications push).
export function isStandalone() {
  return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches
}

// result.ok === true -> activé. Sinon result.reason explique pourquoi :
// 'unsupported' | 'need-home-screen' | 'denied' | 'no-vapid-key' | 'no-token' | 'error'
export async function enableNotifications(me) {
  if (!useFirebase) return { ok: false, reason: 'unsupported' }
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return { ok: false, reason: 'unsupported' }
  if (isIos() && !isStandalone()) return { ok: false, reason: 'need-home-screen' }
  if (!VAPID_KEY) return { ok: false, reason: 'no-vapid-key' }

  try {
    const supported = await isSupported()
    if (!supported) return { ok: false, reason: 'unsupported' }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return { ok: false, reason: 'denied' }

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    const messaging = getMessaging(app)
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration })
    if (!token) return { ok: false, reason: 'no-token' }

    const tokens = new Set(me.fcmTokens || [])
    if (!tokens.has(token)) {
      await update('members', me.id, { fcmTokens: [...tokens, token] })
    }
    return { ok: true }
  } catch (e) {
    console.error('Activation des notifications', e)
    return { ok: false, reason: 'error' }
  }
}
