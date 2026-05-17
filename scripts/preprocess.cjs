// Pre-processing script: parses TRI CSV + watershed GeoJSON, computes scores,
// writes processed JSON outputs for the API routes and frontend.
// Run: node scripts/preprocess.cjs

const { parse: parseSync } = require('csv-parse/sync')
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs')
const { join } = require('path')
const turf = require('@turf/turf')

const ROOT = join(__dirname, '..')
const CSV_PATH  = join(ROOT, 'data', '76e2ae87-0769-4d1b-aab2-82ad2255d1df.csv')
const GEO_PATH  = join(ROOT, 'data', 'Watershed_Boundary_-_8_Digit.geojson')
const OUT_DIR   = join(ROOT, 'src', 'data', 'processed')
const PUB_DIR   = join(ROOT, 'public', 'data')

for (const d of [OUT_DIR, PUB_DIR]) {
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
}

// ─── Watershed sensitivity (0=pristine, 1=critical) ─────────────────────────
const SENSITIVITY = {
  'Tittabawassee': 0.95,  // Dow Chemical contamination
  'Flint':         0.90,  // Flint water crisis legacy
  'Detroit':       0.85,  // Heavy industrialization, AOC status
  'Kalamazoo':     0.85,  // PCB contamination (Allied Paper / Enbridge)
  'Raisin':        0.75,  // River Raisin — agricultural + industrial
  'Saginaw':       0.75,  // Saginaw Bay impairments
  'Clinton':       0.70,  // suburban/industrial corridor
  'Lake Erie':     0.70,  // Harmful algal blooms, nutrient loading
  'Black-Macatawa':0.65,  // Macatawa: worst HBI scores in MI
  'St. Clair':     0.65,
  'Lake St. Clair':0.60,
  'Cedar-Ford':    0.60,
  'Cass':          0.60,
  'Kankakee':      0.58,
  'Kawkawlin-Pine':0.55,
  'Shiawassee':    0.55,
  'Huron':         0.55,  // Ann Arbor corridor
  'Lower Grand':   0.52,
  'St. Marys':     0.52,  // International shipping / Soo Locks
  'St. Joseph':    0.50,
  'Muskegon':      0.50,
  'Thornapple':    0.48,
  'Upper Grand':   0.45,
  'Ottawa-Stony':  0.45,
  'Black':         0.45,
  'Maple':         0.45,
  'Thunder Bay':   0.42,
  'Au Gres-Rifle': 0.40,
  'Pine':          0.40,
  'Cheboygan':     0.40,
  'Carp-Pine':     0.38,
  'Lake Michigan': 0.35,
  'Lake Huron':    0.35,
  'Manistee':      0.35,
  'Dead-Kelsey':   0.35,
  'Boardman-Charlevoix': 0.32,
  'Black-Presque Isle':  0.35,
  'Lone Lake-Ocqueoc':   0.32,
  'Betsie-Platte': 0.30,
  'Escanaba':      0.30,
  'Menominee':     0.35,
  'Ontonagon':     0.32,
  'Keweenaw Peninsula':  0.35,
  'Michigamme':    0.30,
  'Sturgeon':      0.30,
  'Pigeon-Wiscoggin':    0.32,
  'Brevoort-Millecoquins': 0.28,
  'Fishdam-Sturgeon':    0.28,
  'Bad-Montreal':  0.32,
  'Birch-Willow':  0.30,
  'Waiska':        0.25,
  'Tacoosh-Whitefish':   0.28,
  'Betsy-Chocolay':0.30,
  'Lake Superior': 0.22,
  'Tahquamenon':   0.18,  // Wild & Scenic quality
  'Pere Marquette-White': 0.22,  // Federally designated Wild & Scenic
  'Au Sable':      0.25,  // Classic trout water, highly protected
  'Manistique':    0.28,
  'Upper Wisconsin':0.22,
  'Brule':         0.25,
  'Flambeau':      0.25,
}

// ─── PFAS detection ─────────────────────────────────────────────────────────
// EPA TRI-reported PFAS compounds found in Michigan facilities
const PFAS_CHEMICALS = {
  'Perfluorooctanoic acid (335-67-1)':          'PFOA',
  'Perfluorooctane sulfonic acid (1763-23-1)':  'PFOS',
  'Perfluorononanoic acid (375-95-1)':          'PFNA',
  'Perfluorodecanoic acid (335-76-2)':          'PFDA',
  'Perfluorododecanoic acid (307-55-1)':        'PFDoA',
  // Broader PFAS family — catch-all for any new additions in future TRI data
  'Perfluorobutanoic acid (375-22-4)':          'PFBA',
  'Perfluorohexanoic acid (307-24-4)':          'PFHxA',
  'Perfluoroheptanoic acid (375-85-9)':         'PFHpA',
  'Perfluorobutane sulfonic acid (375-73-5)':   'PFBS',
  'Perfluorohexane sulfonic acid (355-46-4)':   'PFHxS',
  'Perfluorooctane sulfonamide (754-91-6)':     'PFOSA',
}

function isPfas(chemName) {
  if (PFAS_CHEMICALS[chemName]) return true
  const lower = chemName.toLowerCase()
  return (
    lower.includes('perfluoro') ||
    lower.includes('polyfluoroalkyl') ||
    lower.includes('fluorotelomer') ||
    lower.includes('hfpo-da') ||
    (lower.includes('sulfonamide') && lower.includes('fluoro'))
  )
}

function pfasShortName(chemName) {
  return PFAS_CHEMICALS[chemName] ?? chemName.split(' ')[0]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseNum(str) {
  if (!str || str.trim() === '') return 0
  return parseFloat(str.replace(/,/g, '')) || 0
}

function formatLbs(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M lb`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K lb`
  return `${n.toFixed(0)} lb`
}

function formatRsei(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return n.toFixed(0)
}

function getBinIndex(value, sortedArr) {
  let lo = 0, hi = sortedArr.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sortedArr[mid] <= value) lo = mid + 1
    else hi = mid
  }
  return sortedArr.length === 0 ? 0.5 : lo / sortedArr.length
}

// ─── Step 1: Parse CSV and aggregate per facility ───────────────────────────

console.log('⚙  Parsing TRI CSV...')
const csvRaw = readFileSync(CSV_PATH, 'utf-8')
const rows = parseSync(csvRaw, { columns: true, skip_empty_lines: true })
console.log(`   ${rows.length} rows read`)

const facilityMap = new Map()

for (const row of rows) {
  const fid = row['TRI Facility ID']
  if (!fid) continue

  if (!facilityMap.has(fid)) {
    const lat = parseFloat(row['Latitude'])
    const lng = parseFloat(row['Longitude'])
    facilityMap.set(fid, {
      id: fid,
      name: (row['TRI Facility Name'] || '').trim(),
      parentCompany: (row['Parent Company'] || '').trim(),
      address: (row['Street Address'] || '').trim(),
      city: (row['City'] || '').replace(/,\s*MI.*$/, '').trim(),
      county: (row['County'] || '').replace(/,\s*MI.*$/, '').trim(),
      zipCode: (row['ZIP Code'] || '').trim(),
      coordinates: [lng, lat],
      naicsCode: (row['NAICS Code'] || '').trim(),
      naics2Digit: (row['NAICS Code'] || '').slice(0, 2),
      industrySector: (row['Industry Sector'] || '').trim(),
      chemicals: [],
      pfasChemicals: [],   // { name, shortName, releaseLbs }
      pfasReleases: 0,
      totalRsei: 0,
      totalReleases: 0,
      waterReleases: 0,
      airReleases: 0,
      landReleases: 0,
      offSiteReleases: 0,
      wasteManaged: 0,
      sourceReductionActivities: 0,
      unemploymentPercentile: parseNum(row['Unemployment Rate Percentile'] || '0'),
      under5Percentile: parseNum(row['Under Age 5 Percentile'] || '0'),
      watershed: null,
      watershedHUC8: null,
    })
  }

  const f = facilityMap.get(fid)
  const chem = (row['Chemical'] || '').trim()
  if (chem && !f.chemicals.includes(chem)) f.chemicals.push(chem)

  // PFAS per-row tracking (accumulate release lbs per compound)
  if (chem && isPfas(chem)) {
    const relLbs = parseNum(row['Releases (lb)'])
    const existing = f.pfasChemicals.find(p => p.name === chem)
    if (existing) {
      existing.releaseLbs += relLbs
    } else {
      f.pfasChemicals.push({ name: chem, shortName: pfasShortName(chem), releaseLbs: relLbs })
    }
    f.pfasReleases += relLbs
  }

  f.totalRsei     += parseNum(row['RSEI Hazard'])
  f.totalReleases += parseNum(row['Releases (lb)'])
  f.waterReleases += parseNum(row['Water Releases (lb)'])
  f.airReleases   += parseNum(row['Air Releases (lb)'])
  f.landReleases  += parseNum(row['Land Releases (lb)'])
  f.offSiteReleases += parseNum(row['Off-Site Releases (lb)'])
  f.wasteManaged  += parseNum(row['Waste Managed (lb)'])
  f.sourceReductionActivities = Math.max(
    f.sourceReductionActivities,
    parseInt(row['Number of Source Reduction Activities'] || '0', 10)
  )
}

const facilities = Array.from(facilityMap.values())
console.log(`   ${facilities.length} unique facilities aggregated`)

// ─── Step 2: Watershed assignment via point-in-polygon ──────────────────────

console.log('🗺  Loading watershed GeoJSON (44 MB)...')
const watershedGeo = JSON.parse(readFileSync(GEO_PATH, 'utf-8'))
console.log(`   ${watershedGeo.features.length} watershed polygons loaded`)

console.log('   Assigning facilities to watersheds...')
let assigned = 0
for (const f of facilities) {
  if (isNaN(f.coordinates[0]) || isNaN(f.coordinates[1])) continue
  const pt = turf.point(f.coordinates)
  for (const feat of watershedGeo.features) {
    try {
      if (turf.booleanPointInPolygon(pt, feat)) {
        f.watershed = feat.properties.Name
        f.watershedHUC8 = feat.properties.HUC8
        assigned++
        break
      }
    } catch (_) { /* skip malformed geometries */ }
  }
}
console.log(`   ${assigned} / ${facilities.length} facilities assigned to watersheds`)

// ─── Step 3: Sector-normalized scoring ──────────────────────────────────────

console.log('📊 Computing scores...')

// Build sorted log-RSEI arrays per 2-digit NAICS sector
const sectorRsei = new Map()
for (const f of facilities) {
  const key = f.naics2Digit || 'XX'
  if (!sectorRsei.has(key)) sectorRsei.set(key, [])
  sectorRsei.get(key).push(Math.log1p(f.totalRsei))
}
for (const arr of sectorRsei.values()) arr.sort((a, b) => a - b)

// Also build sorted overall release log-values
const allReleaseLog = facilities.map(f => Math.log1p(f.totalReleases)).sort((a, b) => a - b)
const maxWasteLog = Math.log1p(Math.max(...facilities.map(f => f.wasteManaged)))

function computeScores(f) {
  // Component 1: RSEI hazard (0–35), lower RSEI → higher score
  const rseiLog = Math.log1p(f.totalRsei)
  const sectorArr = sectorRsei.get(f.naics2Digit || 'XX') || allReleaseLog
  const rseiPct = getBinIndex(rseiLog, sectorArr)           // 0 = lowest, 1 = highest risk
  const rseiScore = Math.round(35 * (1 - rseiPct))

  // Component 2: Water release pathway (0–30)
  const waterPct = f.totalReleases > 0 ? f.waterReleases / f.totalReleases : 0
  const relPct = getBinIndex(Math.log1p(f.totalReleases), allReleaseLog)
  const relScore = Math.round(30 * Math.max(0, 1 - waterPct * 0.6 - relPct * 0.4))

  // Component 3: Watershed sensitivity (0–20)
  const sensitivity = SENSITIVITY[f.watershed] ?? 0.50
  const wsScore = Math.round(20 * (1 - sensitivity))

  // Component 4: Source reduction (0–15)
  const srcScore = f.sourceReductionActivities >= 2 ? 15
                 : f.sourceReductionActivities === 1 ? 8 : 0

  // PFAS persistence penalty (-25): "forever chemicals" don't biodegrade —
  // any release, regardless of volume, represents permanent bioaccumulation risk.
  const pfasFlag = (f.pfasChemicals || []).length > 0
  const pfasPenalty = pfasFlag ? 25 : 0

  const overall = Math.max(5, Math.min(99, rseiScore + relScore + wsScore + srcScore - pfasPenalty))
  return { overall, rsei: rseiScore, releases: relScore, watershed: wsScore, sourceReduction: srcScore, pfas: pfasPenalty }
}

function generateExplanations(f, scores) {
  const sector  = f.industrySector || 'this sector'
  const rseiPct = Math.round((1 - scores.rsei / 35) * 100)
  const waterPct = f.totalReleases > 0
    ? Math.round((f.waterReleases / f.totalReleases) * 100) : 0
  const sensitivity = SENSITIVITY[f.watershed] ?? 0.50

  // RSEI explanation
  let rseiExp
  if (rseiPct < 10)      rseiExp = `RSEI hazard in the lowest 10% of the ${sector} sector — exceptional environmental performance. Risk-weighted hazard index: ${formatRsei(f.totalRsei)}.`
  else if (rseiPct < 25) rseiExp = `Lower-quartile hazard profile within ${sector} (${rseiPct}th percentile). Total RSEI: ${formatRsei(f.totalRsei)} — well-managed relative to peers.`
  else if (rseiPct < 50) rseiExp = `Below median hazard for ${sector} (${rseiPct}th percentile). Total RSEI: ${formatRsei(f.totalRsei)}.`
  else if (rseiPct < 75) rseiExp = `Above-median hazard profile for ${sector} (${rseiPct}th percentile). Total RSEI: ${formatRsei(f.totalRsei)} — warrants due diligence.`
  else if (rseiPct < 90) rseiExp = `Upper-quartile hazard in ${sector} (${rseiPct}th percentile). Total RSEI: ${formatRsei(f.totalRsei)} — elevated environmental risk relative to peers.`
  else                   rseiExp = `Among the highest-risk facilities in ${sector} (${rseiPct}th percentile). Total RSEI: ${formatRsei(f.totalRsei)} — requires environmental scrutiny.`

  // Releases explanation
  let relExp
  if (waterPct === 0)   relExp = `No water-pathway releases. All ${formatLbs(f.totalReleases)} managed via air (${Math.round((f.airReleases/(f.totalReleases||1))*100)}%), land, or off-site channels.`
  else if (waterPct < 5)  relExp = `Minimal water releases — ${waterPct}% of total (${formatLbs(f.waterReleases)}) enters surface water. Total releases: ${formatLbs(f.totalReleases)}.`
  else if (waterPct < 20) relExp = `${waterPct}% of releases (${formatLbs(f.waterReleases)}) routed to water pathways from ${formatLbs(f.totalReleases)} total — moderate water-pathway risk.`
  else                    relExp = `${waterPct}% of total releases (${formatLbs(f.waterReleases)} of ${formatLbs(f.totalReleases)}) reach surface water — elevated water-pathway concern.`

  // Watershed explanation
  const wsName = f.watershed || 'an uncharted watershed'
  let wsExp
  if (sensitivity <= 0.25)      wsExp = `Operating within the ${wsName} watershed — one of Michigan's more pristine basins, with comparatively low baseline ecological stress.`
  else if (sensitivity <= 0.45) wsExp = `Located in the ${wsName} watershed. Standard EGLE monitoring applies; basin carries moderate industrial history.`
  else if (sensitivity <= 0.65) wsExp = `This facility sits within the ${wsName} watershed, which carries elevated sensitivity due to historical industrial activity and Great Lakes proximity.`
  else if (sensitivity <= 0.80) wsExp = `Operating in the ${wsName} watershed — a historically stressed system under enhanced EGLE monitoring. Additional due diligence warranted.`
  else                          wsExp = `The ${wsName} watershed is among Michigan's most ecologically sensitive, with documented contamination history. Sourcing here requires elevated environmental review.`

  // Source reduction explanation
  let srcExp
  if (f.sourceReductionActivities === 0)      srcExp = 'No source reduction activities reported to EPA in 2024. Absence of proactive pollution prevention programs noted.'
  else if (f.sourceReductionActivities === 1) srcExp = 'One EPA-reported source reduction activity in 2024 — demonstrates baseline commitment to pollution prevention beyond compliance.'
  else                                         srcExp = 'Two source reduction activities reported — the maximum logged. Strong indicator of proactive environmental management culture.'

  let pfasExp = null
  if (f.pfasChemicals && f.pfasChemicals.length > 0) {
    const names = f.pfasChemicals.map(c => c.shortName).join(', ')
    const lbs = formatLbs(f.pfasReleases || 0)
    pfasExp = `${names} confirmed in EPA TRI 2024 reporting. ${lbs} released. These "forever chemicals" do not biodegrade under any natural process and bioaccumulate up the Great Lakes food web — fish tissue, fish-eating wildlife, and ultimately human health via drinking water intakes serving 40M+ people. Michigan EGLE has documented 11,000+ PFAS-impacted sites statewide. -25 pts applied to sustainability score; PFAS releases are categorically non-comparable to conventional pollutants of equivalent mass.`
  }

  return { rsei: rseiExp, releases: relExp, watershed: wsExp, sourceReduction: srcExp, pfas: pfasExp }
}

// Apply scores to all facilities
for (const f of facilities) {
  f.scores = computeScores(f)
  f.scoreExplanations = generateExplanations(f, f.scores)
}

// ─── Step 4: Build watershed risk summary ───────────────────────────────────

const watershedStats = {}
for (const f of facilities) {
  const name = f.watershed || '__unassigned__'
  if (!watershedStats[name]) {
    watershedStats[name] = {
      name,
      huc8: f.watershedHUC8,
      facilityCount: 0,
      scoreSum: 0,
      highRiskCount: 0,
      totalRsei: 0,
      chemicals: new Set(),
      sensitivity: SENSITIVITY[name] ?? 0.50,
    }
  }
  const s = watershedStats[name]
  s.facilityCount++
  s.scoreSum += f.scores.overall
  if (f.scores.overall < 45) s.highRiskCount++
  s.totalRsei += f.totalRsei
  f.chemicals.forEach(c => s.chemicals.add(c))
}

for (const s of Object.values(watershedStats)) {
  s.avgScore = Math.round(s.scoreSum / s.facilityCount)
  s.riskLevel = s.avgScore >= 65 ? 'low' : s.avgScore >= 45 ? 'moderate' : 'high'
  s.topChemicals = Array.from(s.chemicals).slice(0, 6)
  delete s.scoreSum
  delete s.chemicals
}

// ─── Step 5: Simplify GeoJSON ───────────────────────────────────────────────

console.log('🔧 Simplifying watershed GeoJSON (tolerance 0.008°)...')
const simplified = turf.simplify(turf.featureCollection(
  watershedGeo.features.map(feat => {
    // Embed risk stats into the simplified feature's properties
    const stats = watershedStats[feat.properties.Name]
    return {
      ...feat,
      properties: {
        ...feat.properties,
        avgScore:      stats?.avgScore ?? 70,
        riskLevel:     stats?.riskLevel ?? 'moderate',
        facilityCount: stats?.facilityCount ?? 0,
        highRiskCount: stats?.highRiskCount ?? 0,
        totalRsei:     stats?.totalRsei ?? 0,
        topChemicals:  stats?.topChemicals ?? [],
        sensitivity:   SENSITIVITY[feat.properties.Name] ?? 0.50,
      }
    }
  })
), { tolerance: 0.008, highQuality: false, mutate: false })

const beforeSize = JSON.stringify(watershedGeo).length
const afterSize  = JSON.stringify(simplified).length
console.log(`   Reduced: ${(beforeSize/1e6).toFixed(1)}MB → ${(afterSize/1e6).toFixed(1)}MB`)

// ─── Step 6: Write outputs ───────────────────────────────────────────────────

console.log('💾 Writing outputs...')

writeFileSync(
  join(OUT_DIR, 'facilities.json'),
  JSON.stringify(facilities)
)
console.log(`   ✓ src/data/processed/facilities.json (${facilities.length} facilities)`)

writeFileSync(
  join(OUT_DIR, 'watershed-risk.json'),
  JSON.stringify(watershedStats, null, 2)
)
console.log(`   ✓ src/data/processed/watershed-risk.json`)

writeFileSync(
  join(PUB_DIR, 'watersheds-simple.geojson'),
  JSON.stringify(simplified)
)
console.log(`   ✓ public/data/watersheds-simple.geojson`)

// Summary stats
const scores = facilities.map(f => f.scores.overall).sort((a,b)=>a-b)
const median = scores[Math.floor(scores.length/2)]
const assigned2 = facilities.filter(f => f.watershed).length
console.log(`\n✅ Done. Score range: ${scores[0]}–${scores[scores.length-1]}, median ${median}`)
console.log(`   Watershed coverage: ${assigned2}/${facilities.length} facilities`)
console.log(`   Watersheds with data: ${Object.keys(watershedStats).filter(k=>k!=='__unassigned__').length}`)
