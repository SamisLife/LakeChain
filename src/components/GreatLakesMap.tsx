'use client'

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import { geoPath } from 'd3-geo'
import { motion, AnimatePresence } from 'framer-motion'
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { Manufacturer } from '@/types'
import { scoreColor, buildArcPath, toSvgPoint, createMapProjection } from '@/lib/utils'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'
const MICHIGAN_FIPS = '26'
// Great Lakes states — slightly brighter than the rest of the US
const GREAT_LAKES_STATES = new Set(['26', '55', '17', '18', '39', '42', '36', '27', '19', '29'])

const LAKE_LABELS: [string, [number, number]][] = [
  ['L. SUPERIOR', [-87.2, 47.2]],
  ['L. MICHIGAN', [-86.8, 43.8]],
  ['L. HURON',    [-83.0, 44.8]],
  ['L. ERIE',     [-82.0, 42.0]],
]

interface WatershedProps {
  Name: string; HUC8: string; avgScore: number; riskLevel: string
  facilityCount: number; highRiskCount: number; topChemicals: string[]
}
interface WatershedFeature {
  type: 'Feature'; properties: WatershedProps; geometry: GeoJSON.Geometry
}
interface ArcParticle { mfrId: string; progress: number; speed: number }
interface ViewT { x: number; y: number; k: number }

interface Props {
  manufacturers: Manufacturer[]
  allManufacturers: Manufacturer[]
  activeId: string | null
  onSelect: (id: string) => void
  buyerCoordinates: [number, number]
  buyerCity: string
}

const MAP_W = 900
const MAP_H = 560
const DEFAULT_VIEW: ViewT = { x: 0, y: 0, k: 1 }

function wsColor(score: number) {
  if (score >= 70) return '#00d97e'
  if (score >= 50) return '#f59e0b'
  return '#ef4444'
}

// ── Transition mode controls the CSS transition on the transform group ────
type TMode = 'drag' | 'wheel' | 'button' | 'reset'
function transitionFor(mode: TMode) {
  if (mode === 'drag') return 'none'
  if (mode === 'reset') return 'transform 0.45s cubic-bezier(0.4,0,0.2,1)'
  if (mode === 'button') return 'transform 0.28s cubic-bezier(0.4,0,0.2,1)'
  return 'transform 0.10s ease-out' // wheel
}

export default function GreatLakesMap({
  manufacturers, allManufacturers, activeId, onSelect, buyerCoordinates, buyerCity,
}: Props) {
  const particleRefs = useRef<Map<string, SVGCircleElement>>(new Map())
  const pathRefs = useRef<Map<string, SVGPathElement>>(new Map())
  const animFrameRef = useRef<number>()
  const particlesRef = useRef<ArcParticle[]>([])

  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startX: number; startY: number; startV: ViewT } | null>(null)
  const tmodeRef = useRef<TMode>('wheel')

  const [view, setView] = useState<ViewT>(DEFAULT_VIEW)
  const [tmode, setTmode] = useState<TMode>('wheel')

  const [tooltipMfr, setTooltipMfr] = useState<Manufacturer | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [tooltipWs, setTooltipWs] = useState<WatershedProps | null>(null)
  const [mounted, setMounted] = useState(false)
  const [watershedFeatures, setWatershedFeatures] = useState<WatershedFeature[]>([])

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    fetch('/api/watersheds').then(r => r.json()).then(d => setWatershedFeatures(d.features ?? [])).catch(() => {})
  }, [])

  const projection = useMemo(() => createMapProjection(MAP_W, MAP_H), [])
  const pathGen = useMemo(() => geoPath(projection), [projection])
  const buyerSvg = useMemo(() => toSvgPoint(buyerCoordinates, projection), [buyerCoordinates, projection])

  const mfrPoints = useMemo(
    () => manufacturers.map(m => ({ ...m, svgPt: toSvgPoint(m.coordinates, projection) })),
    [manufacturers, projection]
  )
  const allMfrPoints = useMemo(
    () => allManufacturers.map(m => ({ ...m, svgPt: toSvgPoint(m.coordinates, projection) })),
    [allManufacturers, projection]
  )
  const watershedPaths = useMemo(
    () => watershedFeatures.map(f => ({
      ...f, d: pathGen(f as unknown as Parameters<typeof pathGen>[0]) ?? '',
    })),
    [watershedFeatures, pathGen]
  )
  const activeWatershed = useMemo(
    () => activeId ? manufacturers.find(m => m.id === activeId)?.watershed ?? null : null,
    [activeId, manufacturers]
  )

  // Inverse marker scale so markers stay constant screen size when zooming
  const ms = Math.max(0.18, Math.min(1.6, 1 / view.k))

  // ── Particle animation ────────────────────────────────────────────────────
  useEffect(() => {
    particlesRef.current = manufacturers.map((m, i) => ({
      mfrId: m.id, progress: i / manufacturers.length,
      speed: 0.003 + Math.random() * 0.002,
    }))
    const animate = () => {
      for (const p of particlesRef.current) {
        p.progress = (p.progress + p.speed) % 1
        const pathEl = pathRefs.current.get(p.mfrId)
        const circEl = particleRefs.current.get(p.mfrId)
        if (pathEl && circEl) {
          const len = pathEl.getTotalLength()
          const pt = pathEl.getPointAtLength(p.progress * len)
          circEl.setAttribute('cx', String(pt.x))
          circEl.setAttribute('cy', String(pt.y))
        }
      }
      animFrameRef.current = requestAnimationFrame(animate)
    }
    animFrameRef.current = requestAnimationFrame(animate)
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current) }
  }, [manufacturers])

  // ── Pan / zoom ────────────────────────────────────────────────────────────
  const svgScale = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { sx: 1, sy: 1, left: 0, top: 0 }
    return { sx: MAP_W / rect.width, sy: MAP_H / rect.height, left: rect.left, top: rect.top }
  }, [])

  // Stable wheel handler via ref to avoid re-registering event listeners
  const viewRef = useRef(DEFAULT_VIEW)
  viewRef.current = view

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const { sx, sy, left, top } = (() => {
        const rect = el.getBoundingClientRect()
        return { sx: MAP_W / rect.width, sy: MAP_H / rect.height, left: rect.left, top: rect.top }
      })()
      const mx = (e.clientX - left) * sx
      const my = (e.clientY - top) * sy
      // Normalize delta — different devices report very different deltaY magnitudes
      const raw = e.deltaY * (e.deltaMode === 0 ? 1 : e.deltaMode === 1 ? 20 : 300)
      const delta = Math.pow(0.999, raw)
      const prev = viewRef.current
      const newK = Math.max(0.5, Math.min(8, prev.k * delta))
      const ratio = newK / prev.k
      tmodeRef.current = 'wheel'
      setTmode('wheel')
      setView({ k: newK, x: mx - (mx - prev.x) * ratio, y: my - (my - prev.y) * ratio })
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, []) // stable — reads view via ref

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    tmodeRef.current = 'drag'
    setTmode('drag')
    dragRef.current = { startX: e.clientX, startY: e.clientY, startV: viewRef.current }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return
    const { sx, sy } = svgScale()
    const dx = (e.clientX - dragRef.current.startX) * sx
    const dy = (e.clientY - dragRef.current.startY) * sy
    setView({ ...dragRef.current.startV, x: dragRef.current.startV.x + dx, y: dragRef.current.startV.y + dy })
  }, [svgScale])

  const handleMouseUp = useCallback(() => {
    if (dragRef.current) {
      dragRef.current = null
      setTmode('wheel')
    }
  }, [])

  const changeZoom = useCallback((dir: 1 | -1) => {
    const factor = dir > 0 ? 1.6 : 0.625
    setTmode('button')
    setView(prev => ({ ...prev, k: Math.max(0.5, Math.min(8, prev.k * factor)) }))
  }, [])

  const resetView = useCallback(() => {
    setTmode('reset')
    setView(DEFAULT_VIEW)
  }, [])

  const projFn = projection as unknown as string
  if (!mounted) return <div className="w-full h-full bg-lc-waterDeep" />

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-lc-waterDeep overflow-hidden select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: dragRef.current ? 'grabbing' : 'grab' }}
    >
      {/* Scanline */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <div className="scan-line absolute w-full h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(0,217,126,0.08), transparent)' }} />
      </div>
      {/* Grid */}
      <div className="absolute inset-0 pointer-events-none z-10 opacity-20"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,217,126,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,217,126,0.05) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

      <ComposableMap projection={projFn as unknown as string} width={MAP_W} height={MAP_H}
        style={{ width: '100%', height: '100%' }}>
        <defs>
          <filter id="mapGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="nodeGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id="buyerGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#0e7bb5" stopOpacity="0.1" />
          </radialGradient>
        </defs>

        {/* Single pan/zoom group */}
        <g style={{
          transform: `translate(${view.x}px,${view.y}px) scale(${view.k})`,
          transformOrigin: '0 0',
          transition: transitionFor(tmode),
        }}>

          {/* All US states — no gap = no phantom "water" halves */}
          <Geographies geography={GEO_URL}>
            {({ geographies }: { geographies: Array<{ rsmKey: string; id: string }> }) =>
              geographies.map(geo => {
                const isMI = geo.id === MICHIGAN_FIPS
                const isGL = GREAT_LAKES_STATES.has(geo.id)
                return (
                  <Geography key={geo.rsmKey} geography={geo} style={{
                    default: {
                      fill: isMI ? '#0d2218' : isGL ? '#090f0c' : '#07100a',
                      stroke: '#0d1810',
                      strokeWidth: isMI ? 0.7 : 0.25,
                    },
                    hover: { fill: isMI ? '#0f2a1e' : isGL ? '#0a110d' : '#07100a' },
                    pressed: { fill: '#0d2218' },
                  }} />
                )
              })
            }
          </Geographies>

          {/* Watershed boundaries — strokes only, zero fill accumulation */}
          {watershedPaths.map(ws => {
            if (!ws.d || ws.properties.facilityCount === 0) return null
            const col = wsColor(ws.properties.avgScore)
            const isActive = ws.properties.Name === activeWatershed
            const isHigh = ws.properties.riskLevel === 'high'
            return (
              <g key={ws.properties.HUC8}>
                {/* Active watershed: subtle fill highlight */}
                {isActive && (
                  <path d={ws.d} fill={col} fillOpacity={0.10} stroke={col} strokeWidth={1.5} strokeOpacity={0.65} />
                )}
                {/* Stroke boundary (transparent fill for hover hit area) */}
                <path d={ws.d}
                  fill="transparent"
                  stroke={col}
                  strokeWidth={isActive ? 1.2 : isHigh ? 0.6 : 0.35}
                  strokeOpacity={isActive ? 0.0 : isHigh ? 0.4 : 0.2}
                  onMouseEnter={() => setTooltipWs(ws.properties)}
                  onMouseLeave={() => setTooltipWs(null)}
                  style={{ pointerEvents: 'all', cursor: 'default' }}
                />
              </g>
            )
          })}

          {/* Lake labels — inverse scaled to stay readable at any zoom */}
          {LAKE_LABELS.map(([label, coords]) => {
            const pt = toSvgPoint(coords as [number, number], projection)
            if (!pt) return null
            return (
              <text key={label} x={pt[0]} y={pt[1]} textAnchor="middle"
                fill="#1da6e035" fontSize={9 * ms}
                fontFamily="JetBrains Mono, monospace" fontWeight="500" letterSpacing={2 * ms}>
                {label}
              </text>
            )
          })}

          {/* Ghost arcs */}
          {allMfrPoints
            .filter(m => !manufacturers.find(f => f.id === m.id))
            .map(m => (
              <path key={`ghost-${m.id}`}
                d={buildArcPath(buyerSvg, m.svgPt, 55)}
                fill="none" stroke="#1c3a27"
                strokeWidth={0.5 * ms} strokeOpacity="0.35" strokeDasharray={`${4 * ms} ${6 * ms}`} />
            ))}

          {/* Active arcs */}
          {mfrPoints.map((m, i) => {
            const isActive = m.id === activeId
            const color = scoreColor(m.scores.overall)
            const d = buildArcPath(buyerSvg, m.svgPt, 55 + i * 3)
            const sw = (isActive ? 1.5 : 0.8) * ms
            return (
              <g key={m.id}>
                <path d={d} fill="none" stroke={color} strokeWidth={sw * 3} strokeOpacity={isActive ? 0.12 : 0.05} />
                <path ref={el => { if (el) pathRefs.current.set(m.id, el) }}
                  d={d} fill="none" stroke={color} strokeWidth={sw}
                  strokeOpacity={isActive ? 0.9 : 0.45}
                  className="arc-path" style={{ animationDelay: `${i * 0.12}s` }} />
                <path d={d} fill="none" stroke={color} strokeWidth={sw} strokeOpacity={isActive ? 0.45 : 0.18} className="arc-flow" />
                <circle
                  ref={el => { if (el) particleRefs.current.set(m.id, el) }}
                  r={(isActive ? 3 : 2) * ms} fill={color}
                  opacity={isActive ? 0.95 : 0.6} filter="url(#nodeGlow)" />
              </g>
            )
          })}

          {/* Buyer node */}
          <g>
            <circle cx={buyerSvg[0]} cy={buyerSvg[1]} r={28 * ms} fill="url(#buyerGrad)" />
            <circle cx={buyerSvg[0]} cy={buyerSvg[1]} r={14 * ms} fill="#071625" stroke="#1da6e0" strokeWidth={1.5 * ms} filter="url(#mapGlow)" />
            <circle cx={buyerSvg[0]} cy={buyerSvg[1]} r={18 * ms} fill="none" stroke="#1da6e0" strokeWidth={0.5 * ms} strokeOpacity="0.4" strokeDasharray={`${3 * ms} ${5 * ms}`} />
            <text x={buyerSvg[0]} y={buyerSvg[1] - 1} textAnchor="middle" dominantBaseline="middle"
              fill="#38bdf8" fontSize={6 * ms} fontFamily="JetBrains Mono, monospace" fontWeight="700">YOU</text>
            <text x={buyerSvg[0]} y={buyerSvg[1] + 22 * ms} textAnchor="middle"
              fill="#38bdf8" fontSize={7 * ms} fontFamily="JetBrains Mono, monospace">{buyerCity}</text>
          </g>

          {/* Manufacturer markers — inverse-scaled so they stay pin-sized at any zoom */}
          {mfrPoints.map(m => {
            const isActive = m.id === activeId
            const color = scoreColor(m.scores.overall)
            const [mx, my] = m.svgPt
            const wsCol = m.watershedRisk === 'high' ? '#ef4444' : m.watershedRisk === 'medium' ? '#f59e0b' : '#00d97e'
            const r = (isActive ? 6 : 4.5) * ms
            return (
              <g key={m.id}
                onClick={e => { e.stopPropagation(); onSelect(m.id) }}
                onMouseEnter={() => { setTooltipMfr(m); setTooltipPos({ x: mx, y: my }) }}
                onMouseLeave={() => setTooltipMfr(null)}
                style={{ cursor: 'pointer' }}>
                {isActive && <circle cx={mx} cy={my} className="pulse-ring" fill="none" stroke={color} strokeWidth={ms} r={r * 1.3} />}
                <circle cx={mx} cy={my} r={r * 2.2} fill={`${wsCol}10`} stroke={wsCol} strokeWidth={0.4 * ms} strokeOpacity={isActive ? 0.5 : 0.2} />
                <circle cx={mx} cy={my} r={r} fill={isActive ? `${color}35` : '#0c1710'} stroke={color} strokeWidth={(isActive ? 1.4 : 0.9) * ms} filter={isActive ? 'url(#nodeGlow)' : undefined} />
                <circle cx={mx} cy={my} r={r * 0.42} fill={color} />
                <text x={mx} y={my - (14 * ms)} textAnchor="middle"
                  fill={isActive ? '#e2f0e8' : '#4a7a5e'}
                  fontSize={(isActive ? 8.5 : 6.5) * ms}
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight={isActive ? '600' : '400'}>
                  {m.city}
                </text>
                {isActive && (
                  <text x={mx} y={my + 20 * ms} textAnchor="middle" fill={color}
                    fontSize={8 * ms} fontFamily="JetBrains Mono, monospace" fontWeight="700">
                    {m.scores.overall}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </ComposableMap>

      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-1 pointer-events-auto">
        {([['in', ZoomIn, 1], ['out', ZoomOut, -1]] as const).map(([key, Icon, dir]) => (
          <button key={key} onClick={() => changeZoom(dir as 1 | -1)}
            className="w-7 h-7 flex items-center justify-center bg-lc-surface border border-lc-border rounded text-lc-textMuted hover:text-lc-green hover:border-lc-green transition-colors">
            <Icon className="w-3.5 h-3.5" />
          </button>
        ))}
        <button onClick={resetView}
          className="w-7 h-7 flex items-center justify-center bg-lc-surface border border-lc-border rounded text-lc-textMuted hover:text-lc-green hover:border-lc-green transition-colors">
          <RotateCcw className="w-3 h-3" />
        </button>
      </div>

      {/* Manufacturer tooltip */}
      <AnimatePresence>
        {tooltipMfr && !tooltipWs && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            className="absolute pointer-events-none z-30 bg-lc-surface border border-lc-border rounded-lg p-3 shadow-xl"
            style={{
              left: `${((tooltipPos.x * view.k + view.x) / MAP_W) * 100}%`,
              top: `${((tooltipPos.y * view.k + view.y) / MAP_H) * 100}%`,
              transform: 'translate(-50%, -130%)', maxWidth: 220,
            }}>
            <div className="font-semibold text-xs text-lc-text mb-1">{tooltipMfr.name}</div>
            <div className="text-[10px] text-lc-textMuted">{tooltipMfr.watershed}</div>
            <div className="mt-1.5 flex gap-2">
              {(['overall', 'watershed', 'transport'] as const).map(key => (
                <div key={key} className="text-center">
                  <div className="font-mono text-[10px]" style={{ color: scoreColor(tooltipMfr.scores[key]) }}>{tooltipMfr.scores[key]}</div>
                  <div className="text-[8px] text-lc-textFaint capitalize">{key}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Watershed tooltip */}
      <AnimatePresence>
        {tooltipWs && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute bottom-12 left-1/2 -translate-x-1/2 z-30 bg-lc-surface border border-lc-border rounded-lg px-4 py-3 shadow-xl"
            style={{ maxWidth: 320 }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: wsColor(tooltipWs.avgScore), boxShadow: `0 0 6px ${wsColor(tooltipWs.avgScore)}` }} />
              <span className="font-mono text-xs font-bold text-lc-text">{tooltipWs.Name} Watershed</span>
              <span className="ml-auto font-mono text-[10px]" style={{ color: wsColor(tooltipWs.avgScore) }}>Score {tooltipWs.avgScore}</span>
            </div>
            <div className="text-[10px] text-lc-textMuted">{tooltipWs.facilityCount} facilities · {tooltipWs.highRiskCount} high-risk</div>
            {tooltipWs.topChemicals.length > 0 && (
              <div className="mt-1 text-[9px] text-lc-textFaint">{tooltipWs.topChemicals.slice(0, 2).map(c => c.split(' (')[0]).join(' · ')}</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-1.5 text-[9px] font-mono pointer-events-none">
        <div className="text-lc-textFaint uppercase tracking-wider mb-0.5">Watershed Score</div>
        {([['≥ 70 Lower Risk', '#00d97e'], ['50–69 Moderate', '#f59e0b'], ['< 50 High Risk', '#ef4444']] as const).map(([lbl, col]) => (
          <div key={lbl} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: col }} />
            <span style={{ color: col }}>{lbl}</span>
          </div>
        ))}
        <div className="mt-1 pt-1 border-t border-lc-border text-lc-textFaint">EPA TRI 2024 · EGLE</div>
      </div>

      {/* Header */}
      <div className="absolute top-2 left-3 z-20 text-[9px] font-mono text-lc-textFaint uppercase tracking-widest pointer-events-none">
        Great Lakes Basin · {watershedFeatures.length > 0 ? `${watershedFeatures.length} Watersheds` : 'Michigan Watershed Intelligence'}
        {view.k !== 1 && <span className="ml-2 text-lc-green">{Math.round(view.k * 100)}%</span>}
      </div>
    </div>
  )
}
