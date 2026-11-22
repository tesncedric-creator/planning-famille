// Envoie les rappels (rendez-vous, résumé du matin, anniversaires) par notification push (FCM),
// sans jamais envoyer deux fois. Lancé toutes les 15 minutes par .github/workflows/rappels.yml
// (gratuit : pas de Cloud Functions).
//
// Variable d'environnement requise : FIREBASE_SERVICE_ACCOUNT (le JSON complet de la clé de compte
// de service Firebase, jamais stocké dans le dépôt).
import admin from 'firebase-admin'
import { DateTime } from 'luxon'

const TZ = 'America/Miquelon'
const WINDOW_MINUTES = 15
const CATCH_UP_HOURS = 2 // tolère un run GitHub Actions en retard sans perdre le rappel

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT
if (!serviceAccountJson) {
  console.error('FIREBASE_SERVICE_ACCOUNT manquant (clé de compte de service JSON).')
  process.exit(1)
}

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(serviceAccountJson)),
})
const db = admin.firestore()
const messaging = admin.messaging()

// ---------- Même logique de répétition que src/utils.js ----------
// (dupliquée ici : ce script Node tourne hors du bundle Vite et ne peut pas importer le code de l'app)
const STEP_BY_REPEAT = {
  weekly: (d) => d.plus({ days: 7 }),
  biweekly: (d) => d.plus({ days: 14 }),
  monthly: (d) => d.plus({ months: 1 }),
  yearly: (d) => d.plus({ years: 1 }),
}

function occurrenceDates(ev, rangeStart, rangeEnd) {
  const excluded = new Set(ev.excludedDates || [])
  const step = ev.repeat && STEP_BY_REPEAT[ev.repeat]
  if (!step) {
    return ev.date >= rangeStart && ev.date <= rangeEnd && !excluded.has(ev.date) ? [ev.date] : []
  }
  const until = ev.repeatUntil || null
  let cur = DateTime.fromISO(ev.date, { zone: TZ })
  let guard = 0
  while (cur.toISODate() < rangeStart && (!until || cur.toISODate() <= until) && guard < 2000) {
    cur = step(cur)
    guard++
  }
  const out = []
  guard = 0
  while (cur.toISODate() <= rangeEnd && (!until || cur.toISODate() <= until) && guard < 2000) {
    const ds = cur.toISODate()
    if (ds >= rangeStart && !excluded.has(ds)) out.push(ds)
    cur = step(cur)
    guard++
  }
  return out
}

// ---------- Même logique de tour de rôle que src/utils.js (corvées) ----------
const CHORE_WEEK0 = DateTime.fromObject({ year: 2024, month: 1, day: 1 }, { zone: TZ })
function choreWeekIndex(dateIso) {
  return Math.floor(DateTime.fromISO(dateIso, { zone: TZ }).diff(CHORE_WEEK0, 'days').days / 7)
}
function choreAssignee(chore, dateIso) {
  if (chore.assignMode === 'rotation') {
    const ids = chore.rotationIds || []
    if (ids.length === 0) return null
    const i = choreWeekIndex(dateIso) % ids.length
    return ids[i < 0 ? i + ids.length : i]
  }
  return chore.assigneeId || null
}

// ---------- Même logique d'anniversaire que src/utils.js ----------
function birthdayDateForYear(member, year) {
  if (!member.birthDay || !member.birthMonth) return null
  const d = DateTime.fromObject({ year, month: member.birthMonth, day: 1 }, { zone: TZ }).endOf('month')
  const day = Math.min(member.birthDay, d.day) // 29 février une année non bissextile, etc.
  return DateTime.fromObject({ year, month: member.birthMonth, day }, { zone: TZ }).toISODate()
}

async function main() {
  const now = DateTime.now().setZone(TZ)
  const windowEnd = now.plus({ minutes: WINDOW_MINUTES })
  const catchUpSince = now.minus({ hours: CATCH_UP_HOURS })

  const rangeStart = now.toISODate()
  const rangeEnd = now.plus({ days: 2 }).toISODate()

  const [eventsSnap, membersSnap, corveesSnap] = await Promise.all([
    db.collection('events').get(),
    db.collection('members').get(),
    db.collection('corvees').get(),
  ])
  const events = eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const members = membersSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const corvees = corveesSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const memberById = Object.fromEntries(members.map((m) => [m.id, m]))

  const sentRef = db.collection('rappelsEnvoyes')
  const invalidTokens = new Set()
  let sentCount = 0

  async function sendPush(tokens, title, body) {
    if (tokens.length === 0) return
    const res = await messaging.sendEachForMulticast({ tokens, notification: { title, body } })
    res.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error && r.error.code
        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
          invalidTokens.add(tokens[i])
        }
      }
    })
    console.log(`Envoyé : ${title} (${tokens.length} appareil(s))`)
    sentCount++
  }

  // Qui doit recevoir un type de rappel donné pour un rendez-vous donné :
  // - les personnes listées dans "who" qui ont activé ce type de rappel ;
  // - en plus, les parents qui ont coché "Recevoir aussi les rappels des enfants", si au moins un
  //   enfant est concerné par ce rendez-vous et que ce parent a aussi activé ce type de rappel.
  function recipientsFor(who, field) {
    const recipients = new Set()
    for (const id of who) {
      const m = memberById[id]
      if (m && m[field]) recipients.add(id)
    }
    const hasChild = who.some((id) => memberById[id] && memberById[id].role === 'enfant')
    if (hasChild) {
      for (const m of members) {
        if (m.role === 'parent' && m.remindChildren && m[field]) recipients.add(m.id)
      }
    }
    return [...recipients]
  }

  // --- 1) Rendez-vous : la veille à 18h, et 1h avant ---
  const dueReminders = []
  for (const ev of events) {
    const who = ev.who || []
    if (who.length === 0) continue // personne de précisément concerné : pas de rappel ciblé

    for (const date of occurrenceDates(ev, rangeStart, rangeEnd)) {
      const candidates = [
        ['eve', DateTime.fromISO(date, { zone: TZ }).minus({ days: 1 }).set({ hour: 18, minute: 0, second: 0, millisecond: 0 })],
      ]
      if (ev.time) {
        const [hh, mm] = ev.time.split(':').map(Number)
        candidates.push([
          'hour',
          DateTime.fromISO(date, { zone: TZ }).set({ hour: hh, minute: mm, second: 0, millisecond: 0 }).minus({ hours: 1 }),
        ])
      }

      for (const [kind, triggerAt] of candidates) {
        if (triggerAt < catchUpSince || triggerAt >= windowEnd) continue
        const field = kind === 'eve' ? 'remindEve' : 'remindHour'
        const recipientIds = recipientsFor(who, field)
        if (recipientIds.length === 0) continue
        dueReminders.push({ occId: `${ev.id}@${date}`, kind, ev, recipientIds })
      }
    }
  }

  for (const reminder of dueReminders) {
    const sentId = `${reminder.occId}__${reminder.kind}`
    const already = await sentRef.doc(sentId).get()
    if (already.exists) continue

    const tokens = []
    for (const id of reminder.recipientIds) {
      for (const t of memberById[id].fcmTokens || []) tokens.push(t)
    }

    const title = reminder.kind === 'eve' ? `Demain : ${reminder.ev.title}` : `Dans 1h : ${reminder.ev.title}`
    const bodyParts = []
    if (reminder.ev.time) bodyParts.push(`À ${reminder.ev.time}`)
    if (reminder.ev.note) bodyParts.push(reminder.ev.note)
    await sendPush(tokens, title, bodyParts.join(' · '))

    // Noté comme traité même sans jeton (personne n'a encore activé les notifications) pour ne pas re-calculer sans fin
    await sentRef.doc(sentId).set({
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      kind: reminder.kind,
      eventId: reminder.ev.id,
      date: reminder.occId.split('@')[1],
      tokens: tokens.length,
    })
  }

  // --- 2) Résumé du matin : rendez-vous du jour (répétitions comprises) + corvées du jour ---
  const todayIso = now.toISODate()
  for (const m of members) {
    if (!m.remindMorning) continue
    const [hh, mm] = (m.remindMorningTime || '07:00').split(':').map(Number)
    const triggerAt = now.set({ hour: hh, minute: mm, second: 0, millisecond: 0 })
    if (triggerAt < catchUpSince || triggerAt >= windowEnd) continue

    const sentId = `morning__${todayIso}__${m.id}`
    const already = await sentRef.doc(sentId).get()
    if (already.exists) continue

    const memberIds = [m.id, ...(m.role === 'parent' && m.remindChildren ? members.filter((x) => x.role === 'enfant').map((x) => x.id) : [])]
    const todaysEvents = events
      .filter((ev) => occurrenceDates(ev, todayIso, todayIso).length > 0)
      .filter((ev) => !ev.who || ev.who.length === 0 || ev.who.some((id) => memberIds.includes(id)))
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    const todaysChores = corvees.filter((c) => choreAssignee(c, todayIso) === m.id)

    if (todaysEvents.length === 0 && todaysChores.length === 0) continue

    const lines = [
      ...todaysEvents.map((e) => `${e.time ? e.time + ' ' : ''}${e.title}`),
      ...todaysChores.map((c) => `🧹 ${c.title}`),
    ]
    const tokens = m.fcmTokens || []
    await sendPush(tokens, `Ta journée, ${m.name}`, lines.join(' · '))

    await sentRef.doc(sentId).set({
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      kind: 'morning',
      date: todayIso,
      tokens: tokens.length,
    })
  }

  // --- 3) Anniversaires : rappel la veille à 18h, pour les parents ---
  const tomorrowIso = now.plus({ days: 1 }).toISODate()
  const tomorrowYear = DateTime.fromISO(tomorrowIso, { zone: TZ }).year
  const birthdayMembers = members.filter((m) => birthdayDateForYear(m, tomorrowYear) === tomorrowIso)

  if (birthdayMembers.length > 0) {
    const triggerAt = now.set({ hour: 18, minute: 0, second: 0, millisecond: 0 })
    if (!(triggerAt < catchUpSince || triggerAt >= windowEnd)) {
      for (const parent of members.filter((m) => m.role === 'parent' && m.remindEve)) {
        const sentId = `anniv__${tomorrowIso}__${parent.id}`
        const already = await sentRef.doc(sentId).get()
        if (already.exists) continue

        const names = birthdayMembers.map((b) => {
          const age = b.birthYear ? tomorrowYear - b.birthYear : null
          return `${b.name}${age != null ? ` (${age} ans)` : ''}`
        })
        const tokens = parent.fcmTokens || []
        await sendPush(tokens, '🎂 Anniversaire demain', names.join(', '))

        await sentRef.doc(sentId).set({
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          kind: 'anniv',
          date: tomorrowIso,
          tokens: tokens.length,
        })
      }
    }
  }

  if (invalidTokens.size > 0) {
    for (const m of members) {
      const kept = (m.fcmTokens || []).filter((t) => !invalidTokens.has(t))
      if (kept.length !== (m.fcmTokens || []).length) {
        await db.collection('members').doc(m.id).update({ fcmTokens: kept })
        console.log(`Jeton(s) invalide(s) retiré(s) pour ${m.name}`)
      }
    }
  }

  console.log(`${sentCount} rappel(s) envoyé(s), ${invalidTokens.size} jeton(s) invalide(s) nettoyé(s).`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
