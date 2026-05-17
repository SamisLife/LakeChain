export interface PfasChemical {
  name: string          // full EPA TRI name
  shortName: string     // PFOA, PFOS, PFNA, etc.
  releaseLbs: number
  releaseFormatted: string
}

export interface PfasDetection {
  detected: boolean
  chemicals: PfasChemical[]
  totalReleaseLbs: number
  warningText: string   // Great Lakes–specific health context
}

export interface Certification {
  name: string
  body: string
  type: 'environmental' | 'quality' | 'social'
  year: number
}

export interface ManufacturerScores {
  overall: number
  watershed: number    // 0–99: EPA RSEI + water-pathway + watershed sensitivity
  economic: number     // 0–99: BLS unemployment-weighted community impact multiplier
  transport: number    // 0–99: haversine distance penalty (closer = lower emissions)
  pfasPenalty: number  // 0 or 25: PFAS persistence deduction (shown as −25)
}

export type WatershedZone =
  | 'lake-superior'
  | 'lake-michigan'
  | 'lake-huron'
  | 'lake-erie'
  | 'st-marys-river'

export type WatershedRisk = 'low' | 'medium' | 'high'

export interface Manufacturer {
  id: string
  name: string
  city: string
  county: string
  coordinates: [number, number] // [lng, lat]
  products: string[]
  watershed: string
  watershedZone: WatershedZone
  watershedRisk: WatershedRisk
  certifications: Certification[]
  scores: ManufacturerScores
  employees: number
  founded: number
  annualRevenue: string
  description: string
  tags: string[]
  pfas: PfasDetection
  countyUnemploymentRate: number   // BLS % for this facility's county
  stateAvgUnemployment: number     // Michigan state average (for delta comparison)
}

export interface ScenarioState {
  text: string
  filters: {
    maxDistanceMiles?: number
    distanceCenter?: string
    requiredCertifications?: string[]
    watershedZones?: WatershedZone[]
    minScore?: number
    tags?: string[]
    hidePfas?: boolean
  }
}

export interface AppState {
  view: 'discovery' | 'dashboard'
  query: string
  scenario: ScenarioState
  activeManufacturerId: string | null
  buyerCoordinates: [number, number]
  buyerCity: string
}
