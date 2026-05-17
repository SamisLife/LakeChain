import { Manufacturer, ScenarioState, WatershedZone } from '@/types'
import { MICHIGAN_CITIES } from '@/data/manufacturers'
import { distanceMiles } from './utils'

export function parseScenario(text: string): ScenarioState['filters'] {
  const lower = text.toLowerCase()
  const filters: ScenarioState['filters'] = {}

  // Distance filter: "within X miles of [city]"
  const distMatch = lower.match(/within\s+(\d+)\s+miles?\s+of\s+([\w\s]+?)(?:\s|$|,)/)
  if (distMatch) {
    filters.maxDistanceMiles = parseInt(distMatch[1])
    const city = Object.keys(MICHIGAN_CITIES).find(
      c => c.toLowerCase().includes(distMatch[2].trim())
    )
    filters.distanceCenter = city || 'Detroit'
  }

  // Certification filters
  const certFilters: string[] = []
  if (lower.includes('egle')) certFilters.push('EGLE')
  if (lower.includes('iso 14001') || lower.includes('14001')) certFilters.push('ISO 14001')
  if (lower.includes('b corp')) certFilters.push('B Corp')
  if (lower.includes('fsc')) certFilters.push('FSC')
  if (lower.includes('iso 9001') || lower.includes('9001')) certFilters.push('ISO 9001')
  if (certFilters.length) filters.requiredCertifications = certFilters

  // Watershed zone filters
  const zones: WatershedZone[] = []
  if (lower.includes('superior')) zones.push('lake-superior')
  if (lower.includes('lake michigan') || lower.includes('michigan basin')) zones.push('lake-michigan')
  if (lower.includes('huron')) zones.push('lake-huron')
  if (lower.includes('erie')) zones.push('lake-erie')
  if (lower.includes('st. marys') || lower.includes('st marys')) zones.push('st-marys-river')
  if (zones.length) filters.watershedZones = zones

  // Score filter — handle many natural phrasings
  const scoreMatch =
    lower.match(/scores?\s+(?:above|over|>=?\s*|at\s+least\s+)(\d+)/) ??
    lower.match(/(?:above|over|minimum|min|at\s+least)\s+(?:scores?\s+)?(\d+)/) ??
    lower.match(/(\d+)\s*(?:\+|or\s+(?:above|higher|more))/)
  if (scoreMatch) filters.minScore = parseInt(scoreMatch[1])
  if (lower.includes('top tier') || lower.includes('exemplary')) filters.minScore = 90
  if (lower.includes('certified only') || lower.includes('only certified')) filters.minScore = 80

  // PFAS exclusion
  if (lower.includes('pfas') || lower.includes('forever chemical') || lower.includes('hide pfas') || lower.includes('exclude pfas') || lower.includes('no pfas')) {
    filters.hidePfas = true
  }

  // Tag filters
  const tagMap: Record<string, string> = {
    'aluminum': 'aluminum', 'metal': 'metals', 'timber': 'timber', 'wood': 'timber',
    'electronic': 'electronics', 'composite': 'composites', 'filter': 'filtration',
    'polymer': 'polymers', 'bio': 'biocomposites',
  }
  const tags: string[] = []
  for (const [key, tag] of Object.entries(tagMap)) {
    if (lower.includes(key)) tags.push(tag)
  }
  if (tags.length) filters.tags = tags

  return filters
}

export function applyScenario(
  manufacturers: Manufacturer[],
  scenario: ScenarioState
): Manufacturer[] {
  const { filters } = scenario
  if (!Object.keys(filters).length) return manufacturers

  return manufacturers.filter(m => {
    if (filters.maxDistanceMiles && filters.distanceCenter) {
      const centerCoords = MICHIGAN_CITIES[filters.distanceCenter] ||
        MICHIGAN_CITIES['Detroit']
      const dist = distanceMiles(centerCoords, m.coordinates)
      if (dist > filters.maxDistanceMiles) return false
    }

    if (filters.requiredCertifications?.length) {
      const hasCert = filters.requiredCertifications.every(req =>
        m.certifications.some(c => c.name.includes(req) || c.body.includes(req))
      )
      if (!hasCert) return false
    }

    if (filters.watershedZones?.length) {
      if (!filters.watershedZones.includes(m.watershedZone)) return false
    }

    if (filters.minScore !== undefined) {
      if (m.scores.overall < filters.minScore) return false
    }

    if (filters.tags?.length) {
      const hasTag = filters.tags.some(t => m.tags.includes(t))
      if (!hasTag) return false
    }

    if (filters.hidePfas && m.pfas?.detected) return false

    return true
  })
}

export const QUICK_SCENARIOS = [
  { label: 'No PFAS', text: 'Hide PFAS facilities' },
  { label: 'Within 150mi of Detroit', text: 'Show only suppliers within 150 miles of Detroit' },
  { label: 'EGLE Certified Only', text: 'Filter to EGLE-compliant manufacturers' },
  { label: 'Lake Michigan Basin', text: 'Show Lake Michigan basin suppliers only' },
  { label: 'Score ≥ 85', text: 'Score above 85 only' },
  { label: 'Reset', text: '' },
]
