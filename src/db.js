// Couche données : Firebase (Firestore) si la config est remplie, sinon mode test local.
import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  getDocs,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  doc,
} from 'firebase/firestore'

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const useFirebase = Boolean(cfg.apiKey && cfg.projectId)

// Exporté pour src/messaging.js (notifications push), qui a besoin de la même instance d'app Firebase
export let app = null
let fs = null
let ready = Promise.resolve()
if (useFirebase) {
  app = initializeApp(cfg)
  try {
    // Cache local persistant (IndexedDB) : l'agenda, les courses et les vœux restent lisibles hors-ligne,
    // et les écritures faites hors-ligne repartent toutes seules au retour du réseau.
    fs = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  } catch (e) {
    console.error('Persistance Firestore indisponible, repli sans cache local', e)
    fs = getFirestore(app)
  }
  // Connexion anonyme : les règles Firestore peuvent ainsi refuser les gens qui n'ont pas l'app.
  ready = signInAnonymously(getAuth(app)).catch((e) => console.error('Auth anonyme', e))
}

// ---------- Mode test (localStorage) ----------
const LS = 'planning-famille:data:'
const listeners = {}
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
const readLocal = (col) => {
  try {
    return JSON.parse(localStorage.getItem(LS + col)) || []
  } catch {
    return []
  }
}
const writeLocal = (col, rows) => {
  localStorage.setItem(LS + col, JSON.stringify(rows))
  ;(listeners[col] || []).forEach((f) => f(rows))
}

// ---------- API ----------
export function subscribe(col, cb, onError) {
  if (useFirebase) {
    let unsub = () => {}
    let cancelled = false
    ready.then(() => {
      if (cancelled) return
      unsub = onSnapshot(
        collection(fs, col),
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => {
          console.error(err)
          onError && onError(err)
        }
      )
    })
    return () => {
      cancelled = true
      unsub()
    }
  }
  listeners[col] = listeners[col] || []
  listeners[col].push(cb)
  cb(readLocal(col))
  return () => {
    listeners[col] = listeners[col].filter((f) => f !== cb)
  }
}

export async function add(col, data) {
  const row = { ...data, createdAt: Date.now() }
  if (useFirebase) {
    await ready
    const ref = await addDoc(collection(fs, col), row)
    return ref.id
  }
  const id = newId()
  writeLocal(col, [...readLocal(col), { ...row, id }])
  return id
}

export async function update(col, id, data) {
  if (useFirebase) {
    await ready
    return updateDoc(doc(fs, col, id), data)
  }
  writeLocal(
    col,
    readLocal(col).map((r) => (r.id === id ? { ...r, ...data } : r))
  )
}

// Pour un document à id fixe (un seul par app, ex. menus/<date>) : crée ou met à jour.
export async function set(col, id, data) {
  if (useFirebase) {
    await ready
    return setDoc(doc(fs, col, id), data, { merge: true })
  }
  const rows = readLocal(col)
  const exists = rows.some((r) => r.id === id)
  writeLocal(
    col,
    exists ? rows.map((r) => (r.id === id ? { ...r, ...data } : r)) : [...rows, { ...data, id }]
  )
}

// Lecture ponctuelle (pas d'abonnement temps réel) — pour la sauvegarde JSON.
export async function getAll(col) {
  if (useFirebase) {
    await ready
    const snap = await getDocs(collection(fs, col))
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  }
  return readLocal(col)
}

export async function remove(col, id) {
  if (useFirebase) {
    await ready
    return deleteDoc(doc(fs, col, id))
  }
  writeLocal(
    col,
    readLocal(col).filter((r) => r.id !== id)
  )
}
