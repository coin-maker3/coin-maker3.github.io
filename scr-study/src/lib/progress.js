// All progress lives in localStorage under a single versioned key.
// Shape: {
//   attempts: [{ caseId, score, date, spf: ["P1.1", ...] }],
//     - every self-score ever saved, in order
//     - spf = SPF codes ticked as "demonstrated out loud" (absent on old attempts)
//   lastCaseId: "m3-001" | null            // continue-where-left-off
// }

const KEY = 'scr-study-progress-v1'

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const data = JSON.parse(raw)
      if (data && Array.isArray(data.attempts)) return data
    }
  } catch {
    // corrupt storage — start fresh
  }
  return { attempts: [], lastCaseId: null }
}

function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // storage full/unavailable — progress just won't persist
  }
}

export function getProgress() {
  return load()
}

export function saveScore(caseId, score, spfTicked = []) {
  const data = load()
  data.attempts.push({ caseId, score, date: new Date().toISOString(), spf: spfTicked })
  save(data)
  return data
}

export function setLastCase(caseId) {
  const data = load()
  data.lastCaseId = caseId
  save(data)
}

export function getLastCase() {
  return load().lastCaseId
}

// Latest attempt per case (a case counts as "done" once it has any attempt).
export function latestScores() {
  const map = {}
  for (const a of load().attempts) map[a.caseId] = a
  return map
}

export function attemptsFor(caseId) {
  return load().attempts.filter((a) => a.caseId === caseId)
}

export function allAttempts() {
  return load().attempts
}

export function resetProgress() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
