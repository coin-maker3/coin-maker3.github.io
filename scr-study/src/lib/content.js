import modulesJson from '../content/modules.json'

// Auto-index every JSON file dropped into the content folders.
// Adding a new case/sheet file requires zero code changes.
const caseFiles = import.meta.glob('../content/cases/*.json', { eager: true })
const sheetFiles = import.meta.glob('../content/sheets/*.json', { eager: true })

export const modules = modulesJson // [{ code: "M1", label: "Cariology & endodontics" }, ...]

const moduleOrder = Object.fromEntries(modules.map((m, i) => [m.code, i]))

export const cases = Object.values(caseFiles)
  .map((f) => f.default ?? f)
  .sort((a, b) => {
    const mo = (moduleOrder[a.module] ?? 99) - (moduleOrder[b.module] ?? 99)
    return mo !== 0 ? mo : a.id.localeCompare(b.id)
  })

export const sheets = Object.values(sheetFiles)
  .map((f) => f.default ?? f)
  .sort((a, b) => a.title.localeCompare(b.title))

export function getCase(id) {
  return cases.find((c) => c.id === id)
}

export function getSheet(id) {
  return sheets.find((s) => s.id === id)
}

export function moduleLabel(code) {
  return modules.find((m) => m.code === code)?.label ?? code
}

export function caseIndex(id) {
  return cases.findIndex((c) => c.id === id)
}

export const DIFFICULTIES = ['Straightforward', 'Moderate', 'Complex']
