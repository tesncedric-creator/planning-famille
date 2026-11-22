export const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

async function sha256(input) {
  if (globalThis.crypto && globalThis.crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
    return 'a' + [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  // Repli (page en http sur le réseau local) : moins solide, mais suffisant pour tester
  let h = 5381
  for (const c of input) h = ((h << 5) + h + c.charCodeAt(0)) | 0
  return 'b' + h
}

// Code lié à un identifiant stable (jamais au prénom, qui peut changer depuis « Modifier le prénom »)
export async function hashPin(salt, pin) {
  return sha256(`pf:${salt}:${pin}`)
}

// Avant l'ajout du bouton « Modifier le prénom », le code était calculé à partir du prénom.
// Gardé uniquement pour que les comptes créés avant cette mise à jour continuent de fonctionner.
async function hashPinLegacy(name, pin) {
  return sha256(`pf:${name.trim().toLowerCase()}:${pin}`)
}

export function newSalt() {
  return globalThis.crypto && globalThis.crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

// Vérifie le code d'un membre, en tenant compte des comptes créés avant l'ajout de pinSalt
export async function hashPinFor(member, pin) {
  return member.pinSalt ? hashPin(member.pinSalt, pin) : hashPinLegacy(member.pinHashName || member.name, pin)
}

export const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

// Première couleur de la palette pas déjà prise par un autre membre
export function firstFreeColor(members) {
  const used = new Set(members.map((m) => m.color))
  return COLORS.find((c) => !used.has(c)) || COLORS[members.length % COLORS.length]
}

export const dateStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const todayStr = () => dateStr(new Date())

export function dayLabel(date) {
  const now = new Date()
  const tomorrow = new Date()
  tomorrow.setDate(now.getDate() + 1)
  if (date === dateStr(now)) return "Aujourd'hui"
  if (date === dateStr(tomorrow)) return 'Demain'
  const s = new Date(date + 'T00:00').toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ---------- Rendez-vous qui se répètent ----------
export const REPEAT_LABELS = {
  none: 'Jamais',
  weekly: 'Chaque semaine',
  biweekly: 'Toutes les 2 semaines',
  monthly: 'Chaque mois',
  yearly: 'Chaque année',
}

function addDays(d, n) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}
function addMonths(d, n) {
  const r = new Date(d)
  r.setMonth(r.getMonth() + n)
  return r
}
function addYears(d, n) {
  const r = new Date(d)
  r.setFullYear(r.getFullYear() + n)
  return r
}

const STEP_BY_REPEAT = {
  weekly: (d) => addDays(d, 7),
  biweekly: (d) => addDays(d, 14),
  monthly: (d) => addMonths(d, 1),
  yearly: (d) => addYears(d, 1),
}

// Dates (incluses) où un évènement, éventuellement répété, tombe dans [rangeStart, rangeEnd]
function occurrenceDates(ev, rangeStart, rangeEnd) {
  const step = ev.repeat && STEP_BY_REPEAT[ev.repeat]
  if (!step) return ev.date >= rangeStart && ev.date <= rangeEnd ? [ev.date] : []

  const until = ev.repeatUntil || null
  const excluded = new Set(ev.excludedDates || [])
  let cur = new Date(ev.date + 'T00:00')
  let curStr = dateStr(cur)

  let guard = 0
  while (curStr < rangeStart && (!until || curStr <= until) && guard < 1000) {
    cur = step(cur)
    curStr = dateStr(cur)
    guard++
  }

  const out = []
  guard = 0
  while (curStr <= rangeEnd && (!until || curStr <= until) && guard < 1000) {
    if (curStr >= rangeStart && !excluded.has(curStr)) out.push(curStr)
    cur = step(cur)
    curStr = dateStr(cur)
    guard++
  }
  return out
}

// Étale les évènements (séries comprises) en occurrences datées dans [rangeStart, rangeEnd], triées par date+heure.
// `excludedDates` (sur le document de la série) permet de retirer une occurrence précise sans toucher au reste.
export function expandEvents(events, rangeStart, rangeEnd) {
  const out = []
  events.forEach((ev) => {
    occurrenceDates(ev, rangeStart, rangeEnd).forEach((date) => {
      out.push({
        ...ev,
        date,
        anchorDate: ev.date, // date d'origine de la série, utile pour modifier "toute la série"
        occId: ev.id + '@' + date,
        recurring: !!(ev.repeat && ev.repeat !== 'none'),
      })
    })
  })
  const key = (e) => e.date + ' ' + (e.time || '00:00')
  return out.sort((a, b) => key(a).localeCompare(key(b)))
}

// ---------- Corvées : périodes et tour de rôle, calculés à la volée (pas de copie stockée par semaine) ----------
const WEEK0 = new Date(2024, 0, 1) // lundi 1er janvier 2024 : semaine de référence n°0

export function weekIndexOf(date) {
  const d = new Date(date + 'T00:00')
  return Math.floor((d - WEEK0) / (7 * 86400000))
}

// Jour de la semaine en commençant à lundi = 1 … dimanche = 7
function isoWeekday(date) {
  return ((new Date(date + 'T00:00').getDay() + 6) % 7) + 1
}

// Clé de période pour une corvée donnée (jour, semaine, ou "une seule fois")
export function chorePeriod(chore, date) {
  if (chore.frequency === 'daily') return date
  if (chore.frequency === 'weekly') return 'W' + weekIndexOf(date)
  return 'once'
}

// Qui est de service pour cette corvée à cette date (tour de rôle = numéro de semaine modulo le nombre de personnes)
export function choreAssignee(chore, date) {
  if (chore.assignMode === 'rotation') {
    const ids = chore.rotationIds || []
    if (ids.length === 0) return null
    const i = weekIndexOf(date) % ids.length
    return ids[i < 0 ? i + ids.length : i]
  }
  return chore.assigneeId || null
}

// Dates du lundi à aujourd'hui (inclus), pour le résumé hebdomadaire
export function weekDatesSoFar(date) {
  const n = isoWeekday(date)
  const d = new Date(date + 'T00:00')
  const dates = []
  for (let i = 0; i < n; i++) {
    const dd = new Date(d)
    dd.setDate(d.getDate() - (n - 1 - i))
    dates.push(dateStr(dd))
  }
  return dates
}

export const shortDate = (d) => new Date(d + 'T00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

// Les 7 dates (lundi à dimanche) de la semaine contenant cette date — pour les menus de la semaine
export function weekDates(date) {
  const n = isoWeekday(date)
  const d = new Date(date + 'T00:00')
  const dates = []
  for (let i = 1; i <= 7; i++) {
    const dd = new Date(d)
    dd.setDate(d.getDate() - (n - i))
    dates.push(dateStr(dd))
  }
  return dates
}

// ---------- Anniversaires : calculés à l'affichage, jamais stockés comme rendez-vous ----------
export function birthdayDateForYear(member, year) {
  if (!member.birthDay || !member.birthMonth) return null
  const d = new Date(year, member.birthMonth - 1, member.birthDay)
  if (d.getMonth() !== member.birthMonth - 1) {
    // Date qui déborde (29 février une année non bissextile, etc.) : dernier jour du mois visé
    return dateStr(new Date(year, member.birthMonth, 0))
  }
  return dateStr(d)
}

export const birthdayAge = (member, year) => (member.birthYear ? year - member.birthYear : null)

// Prochaine occurrence (aujourd'hui compris) de l'anniversaire d'un membre
export function nextBirthday(member, today) {
  if (!member.birthDay || !member.birthMonth) return null
  const year = parseInt(today.slice(0, 4), 10)
  let d = birthdayDateForYear(member, year)
  if (d < today) d = birthdayDateForYear(member, year + 1)
  return d
}

export const pad2 = (n) => String(n).padStart(2, '0')

// "Aujourd'hui" dans un fuseau horaire donné (ex. celui réglé dans Famille) ; repli sur l'horloge
// locale de l'appareil si le fuseau est invalide ou vide.
export function todayInTz(timezone) {
  if (!timezone) return todayStr()
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date())
    const get = (t) => parts.find((p) => p.type === t).value
    return `${get('year')}-${get('month')}-${get('day')}`
  } catch {
    return todayStr()
  }
}

// Nombre de jours (entier) entre deux dates "AAAA-MM-JJ"
export function daysUntil(date, today) {
  const [y1, m1, d1] = today.split('-').map(Number)
  const [y2, m2, d2] = date.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000)
}

// Prochaine occurrence (aujourd'hui compris) d'une date annuelle fixe (ex. Noël, 25/12)
export function nextAnnualDate(month, day, today) {
  const year = parseInt(today.slice(0, 4), 10)
  let d = `${year}-${pad2(month)}-${pad2(day)}`
  if (d < today) d = `${year + 1}-${pad2(month)}-${pad2(day)}`
  return d
}

// Anniversaires dans une plage de dates (bornes incluses)
export function birthdaysInRange(members, rangeStart, rangeEnd) {
  const fromYear = parseInt(rangeStart.slice(0, 4), 10)
  const toYear = parseInt(rangeEnd.slice(0, 4), 10)
  const out = []
  members.forEach((m) => {
    for (let y = fromYear; y <= toYear; y++) {
      const d = birthdayDateForYear(m, y)
      if (d && d >= rangeStart && d <= rangeEnd) out.push({ member: m, date: d, age: birthdayAge(m, y) })
    }
  })
  return out
}
