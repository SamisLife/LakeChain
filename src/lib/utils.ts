import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { geoAlbers } from 'd3-geo'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function scoreColor(score: number): string {
  if (score >= 75) return '#00d97e'
  if (score >= 60) return '#f59e0b'
  return '#ef4444'
}

export function scoreLabel(score: number): string {
  if (score >= 90) return 'Exemplary'
  if (score >= 80) return 'Strong'
  if (score >= 70) return 'Adequate'
  if (score >= 60) return 'Marginal'
  return 'At Risk'
}

export function watershedRiskColor(risk: string): string {
  if (risk === 'low') return '#00d97e'
  if (risk === 'medium') return '#f59e0b'
  return '#ef4444'
}

// Haversine distance in miles
export function distanceMiles(
  [lng1, lat1]: [number, number],
  [lng2, lat2]: [number, number]
): number {
  const R = 3958.8
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Shared map projection — Michigan-centered geoAlbers
// translate shifted up 40px so Detroit has breathing room at the bottom
export function createMapProjection(width: number, height: number) {
  return geoAlbers()
    .rotate([86, 0, 0])
    .center([0, 44])
    .parallels([40, 48])
    .scale(4900)
    .translate([width / 2, height / 2 - 40])
}

export function toSvgPoint(
  coords: [number, number],
  projection: ReturnType<typeof createMapProjection>
): [number, number] {
  const pt = projection(coords)
  return pt ? [pt[0], pt[1]] : [0, 0]
}

export function buildArcPath(
  p1: [number, number],
  p2: [number, number],
  lift = 60
): string {
  const mx = (p1[0] + p2[0]) / 2
  const my = (p1[1] + p2[1]) / 2 - lift
  return `M${p1[0]},${p1[1]} Q${mx},${my} ${p2[0]},${p2[1]}`
}
