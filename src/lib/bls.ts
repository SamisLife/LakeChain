/**
 * BLS Local Area Unemployment Statistics (LAU) — Michigan county data
 *
 * Series format: LAUCN26{county_fips_3digit}0000000003
 *   LAUCN  = Local Area Unemployment, County
 *   26     = Michigan state FIPS
 *   XXX    = 3-digit county FIPS code
 *   0000000003 = unemployment rate (measure code 3)
 *
 * Cached at module level — fetched once per server process lifetime,
 * never per-request. Fails gracefully to hardcoded fallback values.
 */

// Michigan FIPS state code
const MI_FIPS = '26'

// Michigan state average unemployment rate (% — updated periodically)
export const MI_STATE_AVG_UNEMPLOYMENT = 4.2

// County name (as it appears in TRI data, uppercase) → 3-digit county FIPS
// Covers all 67 counties that appear in our TRI dataset + the full 83-county map
export const MICHIGAN_COUNTY_FIPS: Record<string, string> = {
  'ALCONA': '001', 'ALGER': '003', 'ALLEGAN': '005', 'ALPENA': '007',
  'ANTRIM': '009', 'ARENAC': '011', 'BARAGA': '013', 'BARRY': '015',
  'BAY': '017', 'BENZIE': '019', 'BERRIEN': '021', 'BRANCH': '023',
  'CALHOUN': '025', 'CASS': '027', 'CHARLEVOIX': '029', 'CHEBOYGAN': '031',
  'CHIPPEWA': '033', 'CLARE': '035', 'CLINTON': '037', 'CRAWFORD': '039',
  'DELTA': '041', 'DICKINSON': '043', 'EATON': '045', 'EMMET': '047',
  'GENESEE': '049', 'GLADWIN': '051', 'GOGEBIC': '053', 'GRAND TRAVERSE': '055',
  'GRATIOT': '057', 'HILLSDALE': '059', 'HOUGHTON': '061', 'HURON': '063',
  'INGHAM': '065', 'IONIA': '067', 'IOSCO': '069', 'IRON': '071',
  'ISABELLA': '073', 'JACKSON': '075', 'KALAMAZOO': '077', 'KALKASKA': '079',
  'KENT': '081', 'KEWEENAW': '083', 'LAKE': '085', 'LAPEER': '087',
  'LEELANAU': '089', 'LENAWEE': '091', 'LIVINGSTON': '093', 'LUCE': '095',
  'MACKINAC': '097', 'MACOMB': '099', 'MANISTEE': '101', 'MARQUETTE': '103',
  'MASON': '105', 'MECOSTA': '107', 'MENOMINEE': '109', 'MIDLAND': '111',
  'MISSAUKEE': '113', 'MONROE': '115', 'MONTCALM': '117', 'MONTMORENCY': '119',
  'MUSKEGON': '121', 'NEWAYGO': '123', 'OAKLAND': '125', 'OCEANA': '127',
  'OGEMAW': '129', 'ONTONAGON': '131', 'OSCEOLA': '133', 'OSCODA': '135',
  'OTSEGO': '137', 'OTTAWA': '139', 'PRESQUE ISLE': '141', 'ROSCOMMON': '143',
  'SAGINAW': '145', 'ST CLAIR': '147', 'ST. CLAIR': '147',
  'ST JOSEPH': '149', 'ST. JOSEPH': '149',
  'SANILAC': '151', 'SCHOOLCRAFT': '153', 'SHIAWASSEE': '155',
  'TUSCOLA': '157', 'VAN BUREN': '159', 'WASHTENAW': '161',
  'WAYNE': '163', 'WEXFORD': '165',
}

// Fallback unemployment rates (%) — sourced from BLS 2024 annual averages.
// Used when the live API is unavailable. Ordered by labor market stress (desc).
const FALLBACK_RATES: Record<string, number> = {
  'GENESEE': 7.8,    // Flint — persistent post-auto deindustrialization
  'LUCE': 7.2,       // Upper Peninsula rural distress
  'SCHOOLCRAFT': 7.0,
  'BARAGA': 6.9,     // Upper Peninsula copper belt
  'GOGEBIC': 6.8,
  'ONTONAGON': 6.6,
  'ALCONA': 6.5,
  'OSCODA': 6.4,
  'MONTMORENCY': 6.3,
  'SAGINAW': 6.1,    // Saginaw Bay — manufacturing contraction
  'MUSKEGON': 5.9,
  'BAY': 5.7,
  'WAYNE': 5.5,      // Detroit — recovering but still elevated
  'MACKINAC': 5.5,
  'CHIPPEWA': 5.4,
  'IRON': 5.3,
  'DELTA': 5.2,
  'JACKSON': 5.2,
  'MENOMINEE': 5.1,
  'OGEMAW': 5.1,
  'GRATIOT': 5.0,
  'ROSCOMMON': 5.0,
  'HOUGHTON': 4.9,
  'ISABELLA': 4.9,
  'NEWAYGO': 4.9,
  'ALPENA': 4.8,
  'ARENAC': 4.8,
  'MONTCALM': 4.8,
  'MONROE': 4.8,
  'TUSCOLA': 4.7,
  'IOSCO': 4.7,
  'CRAWFORD': 4.6,
  'SANILAC': 4.6,
  'CLARE': 4.5,
  'CALHOUN': 4.5,
  'HURON': 4.5,
  'BRANCH': 4.4,
  'SHIAWASSEE': 4.4,
  'LAPEER': 4.3,
  'MECOSTA': 4.3,
  'CASS': 4.3,
  'HILLSDALE': 4.3,
  'LENAWEE': 4.2,
  'MANISTEE': 4.2,
  'MARQUETTE': 4.1,
  'ALGER': 4.1,
  'KALKASKA': 4.1,
  'OSCEOLA': 4.0,
  'OTSEGO': 4.0,
  'MASON': 4.0,
  'OCEANA': 3.9,
  'WEXFORD': 3.9,
  'IONIA': 3.9,
  'GLADWIN': 3.9,
  'MISSAUKEE': 3.8,
  'MACOMB': 3.8,
  'VAN BUREN': 3.8,
  'EATON': 3.7,
  'BENZIE': 3.7,
  'ALLEGAN': 3.7,
  'ANTRIM': 3.7,
  'INGHAM': 3.7,     // Lansing — state government anchor
  'BARRY': 3.6,
  'KALAMAZOO': 3.6,
  'ST JOSEPH': 3.6,
  'CHARLEVOIX': 3.5,
  'EMMET': 3.5,
  'MIDLAND': 3.5,
  'CLINTON': 3.5,
  'GRAND TRAVERSE': 3.4,
  'OAKLAND': 3.4,    // Metro Detroit suburbs — strong professional sector
  'KENT': 3.4,       // Grand Rapids — diversified economy
  'ST. CLAIR': 3.4,
  'LEELANAU': 3.3,
  'OTTAWA': 3.3,
  'LIVINGSTON': 3.1,
  'WASHTENAW': 2.9,  // Ann Arbor — university + tech hub, very tight
}

function buildSeriesId(countyFips: string): string {
  return `LAUCN${MI_FIPS}${countyFips}0000000003`
}

function normalizeName(raw: string): string {
  return raw.toUpperCase().replace(/\.$/, '').trim()
}

// ── Module-level cache ────────────────────────────────────────────────────────
let rateCache: Record<string, number> | null = null
let fetchPromise: Promise<Record<string, number>> | null = null

async function fetchBLSBatch(seriesIds: string[]): Promise<Record<string, number>> {
  const result: Record<string, number> = {}
  // BLS public API: 25 series max per request without registration key
  const BATCH = 25
  for (let i = 0; i < seriesIds.length; i += BATCH) {
    const batch = seriesIds.slice(i, i + BATCH)
    try {
      const res = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seriesid: batch,
          startyear: '2024',
          endyear: '2024',
        }),
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) continue
      const data = await res.json() as {
        Results?: { series?: { seriesID: string; data?: { value: string }[] }[] }
      }
      for (const s of (data?.Results?.series ?? [])) {
        const val = parseFloat(s.data?.[0]?.value ?? '')
        if (!isNaN(val)) result[s.seriesID] = val
      }
    } catch {
      // Silently continue — individual batch failures are non-fatal
    }
  }
  return result
}

async function loadBLSData(): Promise<Record<string, number>> {
  // Build the series list for all known Michigan counties
  const countyMap: Record<string, string> = {} // seriesId → county name
  for (const [name, fips] of Object.entries(MICHIGAN_COUNTY_FIPS)) {
    const sid = buildSeriesId(fips)
    countyMap[sid] = name
  }

  const blsResult = await fetchBLSBatch(Object.keys(countyMap))

  // Build county-name → unemployment-rate map, falling back gracefully
  const rates: Record<string, number> = { ...FALLBACK_RATES }
  for (const [sid, rate] of Object.entries(blsResult)) {
    const countyName = countyMap[sid]
    if (countyName) rates[countyName] = rate
  }

  const liveCount = Object.keys(blsResult).length
  console.log(`[bls] Loaded ${liveCount} live rates, ${Object.keys(rates).length - liveCount} from fallback`)
  return rates
}

export async function getCountyUnemploymentRates(): Promise<Record<string, number>> {
  if (rateCache) return rateCache
  if (!fetchPromise) fetchPromise = loadBLSData()
  rateCache = await fetchPromise
  return rateCache
}

/** Look up unemployment rate for a county name as it appears in TRI data. */
export function lookupRate(
  countyRaw: string,
  rates: Record<string, number>
): number {
  const key = normalizeName(countyRaw)
  return rates[key] ?? rates[countyRaw] ?? MI_STATE_AVG_UNEMPLOYMENT
}

// ── Economic Multiplier formula ───────────────────────────────────────────────
//
// Rationale: procurement dollars directed to high-unemployment counties deliver
// greater community impact per dollar. A county at 8% unemployment has fewer
// alternative opportunities for its workforce, so winning a manufacturing
// contract has higher marginal social value than the same contract in a 3% county.
//
// Base score: 50 (state average, ~4.2%)
//
// Unemployment premium above base:
//   ≥ 9%:  +38 pts  — acute labor market distress (UP copper belt, Flint)
//   ≥ 7%:  +28 pts  — significantly elevated
//   ≥ 5.5%: +16 pts — above state average, real need
//   ≥ 4.5%: +8 pts  — slightly above average
//   < 3.5%: -10 pts — very tight market; marginal community benefit
//   < 2.5%: -15 pts — near full employment; no community impact premium
//
// Facility scale bonus (proxy for local job count):
//   wasteManaged > 10M lb: +8 pts  — large industrial operation
//   wasteManaged > 1M lb:  +4 pts  — mid-size operation
//
// Source reduction activities: proxy for operational investment/stability
//   Each activity: +2 pts (capped at +8)
//
// Total range: ~17 – 99 (capped at 99, floored at 5)
export function computeEconScore(
  countyUnemp: number,
  wasteManaged: number,
  sourceReductionActivities: number,
): number {
  let score = 50

  // Unemployment premium
  if (countyUnemp >= 9)        score += 38
  else if (countyUnemp >= 7)   score += 28
  else if (countyUnemp >= 5.5) score += 16
  else if (countyUnemp >= 4.5) score += 8
  else if (countyUnemp < 2.5)  score -= 15
  else if (countyUnemp < 3.5)  score -= 10

  // Facility scale
  if (wasteManaged > 1e7)      score += 8
  else if (wasteManaged > 1e6) score += 4

  // Operational investment
  score += Math.min(8, sourceReductionActivities * 2)

  return Math.max(5, Math.min(99, Math.round(score)))
}

// ── County impact narrative ───────────────────────────────────────────────────
export function countyImpactLine(
  countyName: string,
  unemp: number,
): string {
  const pct = unemp.toFixed(1)
  const county = countyName
    .split(' ')
    .map(w => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ')

  if (unemp >= 9)   return `${pct}% of ${county} County residents are seeking work — this is one of Michigan's hardest-pressed labor markets. Procurement here is direct community investment.`
  if (unemp >= 7)   return `${county} County faces elevated unemployment at ${pct}%. Sourcing here puts manufacturing dollars where they're needed most.`
  if (unemp >= 5.5) return `With ${pct}% unemployment, ${county} County is above the state average. Directing supply chain dollars here has measurable community impact.`
  if (unemp >= 4.5) return `Sourcing from this facility supports manufacturing employment in ${county} County, where ${pct}% of residents are seeking work.`
  if (unemp < 3)    return `${county} County's labor market is among Michigan's tightest at ${pct}%. Strong industrial anchor — procurement here builds long-term regional capacity.`
  return `${county} County unemployment stands at ${pct}%, near the state average. A stable, functioning labor market for manufacturing.`
}
