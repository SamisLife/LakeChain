export interface Certification {
  name: string
  body: string
  type: 'environmental' | 'quality' | 'social'
  year: number
}

export interface ManufacturerScores {
  overall: number
  watershed: number
  economic: number
  transport: number
  certifications: number
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
