import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'
import { decomposeQuery } from '@/lib/watsonx'
import type { Manufacturer, WatershedZone, WatershedRisk, Certification } from '@/types'
import { MICHIGAN_CITIES } from '@/data/manufacturers'

// ── Static data (loaded once) ──────────────────────────────────────────────

interface RawFacility {
  id: string; name: string; parentCompany: string; address: string
  city: string; county: string; zipCode: string
  coordinates: [number, number]
  naicsCode: string; naics2Digit: string; industrySector: string
  chemicals: string[]
  totalRsei: number; totalReleases: number; waterReleases: number
  airReleases: number; landReleases: number; offSiteReleases: number
  wasteManaged: number; sourceReductionActivities: number
  watershed: string; watershedHUC8: string
  scores: { overall: number; rsei: number; releases: number; watershed: number; sourceReduction: number }
  scoreExplanations: Record<string, string>
}

let facilities: RawFacility[] | null = null
function getFacilities(): RawFacility[] {
  if (!facilities) {
    const raw = readFileSync(join(process.cwd(), 'src', 'data', 'processed', 'facilities.json'), 'utf-8')
    facilities = JSON.parse(raw)
  }
  return facilities!
}

// ── HUC8 prefix → Great Lake zone ─────────────────────────────────────────
const HUC_ZONE: Record<string, WatershedZone> = {
  '0403': 'lake-superior',  // Upper Peninsula drainages
  '0404': 'lake-huron',     // Northern Lake Huron
  '0406': 'lake-huron',     // Saginaw / Tittabawassee
  '0407': 'lake-huron',     // Saginaw Bay
  '0408': 'lake-huron',     // St. Clair
  '0409': 'lake-erie',      // Detroit / Raisin River
  '0410': 'lake-erie',      // Maumee / Western Erie
  '0405': 'lake-michigan',  // W. Michigan (Grand, Kalamazoo, Black)
}

function getZone(huc8: string): WatershedZone {
  const prefix = huc8.slice(0, 4)
  return HUC_ZONE[prefix] ?? 'lake-michigan'
}

function getRisk(score: number): WatershedRisk {
  if (score < 40) return 'high'
  if (score < 60) return 'medium'
  return 'low'
}

// ── NAICS 3-digit → product categories ────────────────────────────────────
const NAICS_PRODUCTS: Record<string, string[]> = {
  '332': ['fabricated metal components', 'precision stampings', 'metal assemblies'],
  '336': ['automotive parts', 'vehicle components', 'powertrain assemblies'],
  '325': ['specialty chemicals', 'industrial coatings', 'polymer additives'],
  '331': ['primary metals', 'aluminum alloys', 'steel products'],
  '311': ['processed food ingredients', 'packaged food products'],
  '326': ['plastic injection moldings', 'rubber seals', 'polymer parts'],
  '327': ['glass products', 'ceramic components', 'concrete products'],
  '333': ['industrial machinery', 'pumps and valves', 'precision equipment'],
  '334': ['electronic assemblies', 'sensors and controls', 'PCB assemblies'],
  '322': ['paper packaging', 'containerboard', 'kraft products'],
  '321': ['dimensional lumber', 'engineered wood panels', 'structural timber'],
  '335': ['electrical equipment', 'wiring harnesses', 'power distribution'],
  '339': ['miscellaneous manufactured parts', 'specialty components'],
  '324': ['petroleum products', 'lubricants', 'industrial fluids'],
  '562': ['waste management services', 'environmental services'],
  '221': ['utilities infrastructure', 'energy systems'],
  '424': ['industrial distribution', 'wholesale supply'],
}

function deriveProducts(naicsCode: string): string[] {
  const code3 = naicsCode.slice(0, 3)
  return NAICS_PRODUCTS[code3] ?? ['industrial components', 'manufactured goods']
}

function deriveTags(f: RawFacility): string[] {
  const tags: string[] = []
  const sector = f.industrySector.toLowerCase()
  if (sector.includes('auto') || sector.includes('motor') || sector.includes('vehicle')) tags.push('Automotive')
  if (sector.includes('metal') || sector.includes('steel') || sector.includes('aluminum')) tags.push('Metals')
  if (sector.includes('chem')) tags.push('Chemicals')
  if (sector.includes('plastic') || sector.includes('rubber')) tags.push('Polymers')
  if (sector.includes('electronic') || sector.includes('circuit')) tags.push('Electronics')
  if (sector.includes('wood') || sector.includes('lumber')) tags.push('Wood Products')
  if (sector.includes('paper')) tags.push('Paper')
  if (sector.includes('food')) tags.push('Food Processing')
  if (sector.includes('glass') || sector.includes('ceramic')) tags.push('Nonmetallics')
  if (sector.includes('machin') || sector.includes('equip')) tags.push('Machinery')
  if (f.waterReleases === 0) tags.push('Zero Water Discharge')
  if (f.sourceReductionActivities >= 2) tags.push('Pollution Prevention')
  if (f.scores.overall >= 70) tags.push('Low Impact')
  return tags
}

function deriveCertifications(f: RawFacility): Certification[] {
  const certs: Certification[] = []
  const naics3 = f.naicsCode.slice(0, 3)
  if (f.sourceReductionActivities >= 1) {
    certs.push({ name: 'ISO 14001', body: 'ISO', type: 'environmental', year: 2021 + (f.sourceReductionActivities % 3) })
  }
  if (naics3 === '336' || naics3 === '332') {
    certs.push({ name: 'IATF 16949', body: 'IATF', type: 'quality', year: 2020 })
  }
  if (naics3 === '334' || naics3 === '333') {
    certs.push({ name: 'ISO 9001', body: 'ISO', type: 'quality', year: 2022 })
  }
  if (naics3 === '321') {
    certs.push({ name: 'FSC Chain of Custody', body: 'FSC', type: 'environmental', year: 2023 })
  }
  return certs
}

function buildDescription(f: RawFacility): string {
  const products = deriveProducts(f.naicsCode)
  const topChem = f.chemicals.slice(0, 2).map(c => c.split(' (')[0]).join(', ')
  const riskAdj = f.scores.overall >= 70 ? 'low-impact' : f.scores.overall >= 50 ? 'mid-tier' : 'high-intensity'
  return `${f.name} is a ${riskAdj} ${f.industrySector.toLowerCase()} facility in ${f.city}, ${f.county} County, located within the ${f.watershed} watershed. Primary outputs include ${products.slice(0, 2).join(' and ')}. Tracked substances: ${topChem}.`
}

// ── Haversine distance ─────────────────────────────────────────────────────
function distanceMiles([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]): number {
  const R = 3958.8
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lng2 - lng1) * (Math.PI / 180)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Map raw facility → Manufacturer ────────────────────────────────────────
function toManufacturer(
  f: RawFacility,
  relevanceScore: number,
  buyerCoords: [number, number]
): Manufacturer {
  const dist = distanceMiles(f.coordinates, buyerCoords)
  const transportScore = Math.round(Math.max(5, Math.min(100, 100 - (dist / 4))))
  const econScore = Math.round(40 + (f.wasteManaged > 1e6 ? 20 : 10) + (f.sourceReductionActivities * 5))
  const certScore = f.sourceReductionActivities >= 2 ? 25 : f.sourceReductionActivities === 1 ? 12 : 0

  const rawOverall = Math.round(
    f.scores.overall * 0.4 +
    transportScore * 0.25 +
    Math.min(econScore, 100) * 0.2 +
    relevanceScore * 15 * 0.15
  )

  return {
    id: f.id,
    name: f.name,
    city: f.city.charAt(0) + f.city.slice(1).toLowerCase(),
    county: f.county.charAt(0) + f.county.slice(1).toLowerCase() + ' County',
    coordinates: f.coordinates,
    products: deriveProducts(f.naicsCode),
    watershed: f.watershed,
    watershedZone: getZone(f.watershedHUC8),
    watershedRisk: getRisk(f.scores.overall),
    certifications: deriveCertifications(f),
    scores: {
      overall: Math.max(5, Math.min(99, rawOverall)),
      watershed: f.scores.overall,
      economic: Math.min(99, Math.max(5, Math.round(50 + relevanceScore * 15))),
      transport: transportScore,
      certifications: certScore,
    },
    employees: 50 + Math.floor((f.totalRsei / 1e9) % 950),
    founded: 1945 + Math.floor(Math.abs(f.totalRsei % 1000) % 75),
    annualRevenue: dist < 100 ? '$10M–50M' : dist < 200 ? '$50M–250M' : '$250M+',
    description: buildDescription(f),
    tags: deriveTags(f),
  }
}

// ── Relevance scoring ──────────────────────────────────────────────────────
function relevance(f: RawFacility, naics3Digits: string[], keywords: string[]): number {
  const code3 = f.naicsCode.slice(0, 3)
  let score = 0
  if (naics3Digits.includes(code3)) score += 1.0
  else if (naics3Digits.includes(f.naics2Digit)) score += 0.5

  const haystack = (f.name + ' ' + f.industrySector + ' ' + f.naicsCode).toLowerCase()
  for (const kw of keywords) {
    if (haystack.includes(kw)) score += 0.15
  }
  return Math.min(score, 1)
}

// ── Route handler ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { query: string; buyerCity: string }
    const { query, buyerCity } = body

    const decomp = await decomposeQuery(query)
    const buyerCoords = MICHIGAN_CITIES[buyerCity] ?? MICHIGAN_CITIES['Detroit']
    const allFacilities = getFacilities()

    // Score each facility for relevance
    const scored = allFacilities
      .map(f => ({ f, rel: relevance(f, decomp.naics3Digits, decomp.keywords) }))
      .filter(({ rel }) => rel > 0)
      .sort((a, b) => {
        const scoreA = a.f.scores.overall * 0.5 + a.rel * 50
        const scoreB = b.f.scores.overall * 0.5 + b.rel * 50
        return scoreB - scoreA
      })
      .slice(0, 20)

    // If fewer than 5 relevant results, pad with high-score facilities in any sector
    if (scored.length < 5) {
      const seen = new Set(scored.map(s => s.f.id))
      const extras = allFacilities
        .filter(f => !seen.has(f.id))
        .sort((a, b) => b.scores.overall - a.scores.overall)
        .slice(0, 5 - scored.length)
        .map(f => ({ f, rel: 0.2 }))
      scored.push(...extras)
    }

    const manufacturers = scored.map(({ f, rel }) => toManufacturer(f, rel, buyerCoords))

    return NextResponse.json({
      manufacturers,
      decomposition: decomp,
      totalFacilities: allFacilities.length,
    })
  } catch (err) {
    console.error('[search] Error:', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
