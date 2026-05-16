export interface QueryDecomposition {
  naics3Digits: string[]
  keywords: string[]
  certificationHints: string[]
  sectorLabel: string
}

// Keyword → 3-digit NAICS code mapping (fallback when watsonx unavailable)
const KEYWORD_RULES: { terms: string[]; codes: string[] }[] = [
  { terms: ['aluminum', 'aluminium', 'cast', 'foundry', 'alloy'], codes: ['331', '332'] },
  { terms: ['steel', 'iron', 'metal', 'fabricat', 'stamp', 'forg', 'sheet'], codes: ['331', '332'] },
  { terms: ['automotive', 'auto', 'vehicle', 'car', 'truck', 'powertrain', 'transmission', 'body'], codes: ['336', '332'] },
  { terms: ['aerospace', 'aircraft', 'aviation', 'defense'], codes: ['336', '332', '334'] },
  { terms: ['cnc', 'machining', 'precision', 'machined', 'turning', 'milling'], codes: ['332', '333'] },
  { terms: ['chemical', 'polymer', 'resin', 'adhesive', 'coating', 'paint', 'solvent'], codes: ['325', '326'] },
  { terms: ['plastic', 'rubber', 'injection', 'mold', 'thermoplastic'], codes: ['326', '325'] },
  { terms: ['electronic', 'sensor', 'circuit', 'semiconductor', 'pcb', 'component'], codes: ['334', '335'] },
  { terms: ['ev', 'electric vehicle', 'battery', 'charging', 'wiring', 'harness'], codes: ['334', '335', '336'] },
  { terms: ['lumber', 'wood', 'timber', 'fsc', 'forest', 'plywood', 'structural'], codes: ['321'] },
  { terms: ['paper', 'packaging', 'cardboard', 'corrugat', 'containerboard'], codes: ['322'] },
  { terms: ['food', 'beverage', 'grain', 'dairy', 'agricultural', 'food-grade'], codes: ['311'] },
  { terms: ['filtration', 'filter', 'water treatment', 'membrane', 'purifi'], codes: ['333', '335'] },
  { terms: ['glass', 'ceramic', 'concrete', 'mineral', 'aggregate'], codes: ['327'] },
  { terms: ['machinery', 'equipment', 'pump', 'valve', 'industrial'], codes: ['333'] },
  { terms: ['composite', 'carbon fiber', 'fiberglass', 'bio-based', 'biocomposite'], codes: ['326', '325'] },
  { terms: ['electrical', 'transformer', 'switchgear', 'motor', 'generator'], codes: ['335', '334'] },
]

const CERT_TERMS: Record<string, string[]> = {
  'ISO 14001': ['sustainab', 'environmental', 'eco', 'green'],
  'FSC': ['timber', 'lumber', 'wood', 'forest', 'fsc'],
  'ISO 9001': ['quality', 'iso 9001', 'certified'],
  'AS9100': ['aerospace', 'aviation', 'as9100'],
  'IATF 16949': ['automotive', 'iatf', 'auto'],
}

function keywordFallback(query: string): QueryDecomposition {
  const lower = query.toLowerCase()
  const matchedCodes = new Set<string>()
  const matchedTerms: string[] = []

  for (const rule of KEYWORD_RULES) {
    for (const term of rule.terms) {
      if (lower.includes(term)) {
        rule.codes.forEach(c => matchedCodes.add(c))
        matchedTerms.push(term)
        break
      }
    }
  }

  // Default to broad manufacturing if no match
  if (matchedCodes.size === 0) {
    matchedCodes.add('332')
    matchedCodes.add('336')
    matchedCodes.add('333')
  }

  const certHints: string[] = []
  for (const [cert, terms] of Object.entries(CERT_TERMS)) {
    if (terms.some(t => lower.includes(t))) certHints.push(cert)
  }

  const codes = Array.from(matchedCodes)
  const sectorLabels: Record<string, string> = {
    '331': 'Primary Metals', '332': 'Fabricated Metals', '333': 'Machinery',
    '334': 'Electronics', '335': 'Electrical Equipment', '336': 'Transportation Equipment',
    '325': 'Chemicals', '326': 'Plastics & Rubber', '321': 'Wood Products',
    '322': 'Paper', '311': 'Food Manufacturing', '327': 'Nonmetallic Minerals',
  }

  return {
    naics3Digits: codes,
    keywords: matchedTerms,
    certificationHints: certHints,
    sectorLabel: sectorLabels[codes[0]] ?? 'Manufacturing',
  }
}

// Native HTTPS wrapper with rejectUnauthorized:false for Windows SSL inspection proxies
function ibmFetch(url: string, init: RequestInit): Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }> {
  return new Promise((resolve, reject) => {
    const https = require('https') as typeof import('https')
    const { URL } = require('url') as typeof import('url')
    const parsed = new URL(url)
    const body = init.body as string | undefined
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: init.method ?? 'GET',
      headers: {
        ...(init.headers as Record<string, string>),
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
      },
      rejectUnauthorized: false,
    }
    const req = https.request(options, res => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf-8')
        resolve({
          ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
          status: res.statusCode ?? 0,
          json: () => Promise.resolve(JSON.parse(text)),
        })
      })
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

async function getIBMToken(apiKey: string): Promise<string> {
  const res = await ibmFetch('https://iam.cloud.ibm.com/identity/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${encodeURIComponent(apiKey)}`,
  })
  if (!res.ok) throw new Error(`IAM token error: ${res.status}`)
  const data = await res.json() as { access_token: string }
  return data.access_token
}

export async function decomposeQuery(query: string): Promise<QueryDecomposition> {
  const apiKey = process.env.WATSONX_API_KEY
  const projectId = process.env.WATSONX_PROJECT_ID
  const watsonxUrl = process.env.WATSONX_URL ?? 'https://us-south.ml.cloud.ibm.com'

  if (!apiKey || !projectId) {
    return keywordFallback(query)
  }

  try {
    const token = await getIBMToken(apiKey)
    const prompt = `You are a supply chain analyst. Given this sourcing query, extract the most relevant 3-digit NAICS manufacturing codes (from: 311,321,322,325,326,327,331,332,333,334,335,336) and key product keywords.

Query: "${query}"

Respond ONLY with a JSON object:
{"naics3Digits":["332","336"],"keywords":["aluminum","automotive"],"certificationHints":[],"sectorLabel":"Fabricated Metals"}`

    const res = await ibmFetch(
      `${watsonxUrl}/ml/v1/text/generation?version=2023-05-29`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_id: 'ibm/granite-3-8b-instruct',
          project_id: projectId,
          input: prompt,
          parameters: { max_new_tokens: 120, temperature: 0.1 },
        }),
      }
    )

    if (!res.ok) throw new Error(`Watsonx error: ${res.status}`)
    const data = await res.json() as { results?: { generated_text?: string }[] }
    const text: string = data?.results?.[0]?.generated_text ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as QueryDecomposition
      if (Array.isArray(parsed.naics3Digits) && parsed.naics3Digits.length > 0) {
        return parsed
      }
    }
  } catch {
    // fall through to keyword fallback
  }

  return keywordFallback(query)
}
