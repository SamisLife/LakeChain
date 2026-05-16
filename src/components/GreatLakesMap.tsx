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
const VISIBLE_STATES = new Set(['26', '55', '17', '18', '39', '42', '36', '27'])

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
interface ViewTransform { x: number; y: number; k: number }

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
const DEFAULT_VIEW: ViewTransform = { x: 0, y: 0, k: 1 }

function wsColor(score: number) {
  if (score >= 70) return '#00d97e'
  if (score >= 50) return '#f59e0b'
  return '#ef4444'
}

export default function GreatLakesMap({
  manufacturers, allManufacturers, activeId, onSelect, buyerCoordinates, buyerCity,
}: Props) {
  const particleRefs = useRef<Map<string, SVGCircleElement>>(new Map())
  const pathRefs = useRef<Map<string, SVGPathElement>>(new Map())
  const animFrameRef = useRef<number>()
  const particlesRef = useRef<ArcParticle[]>([])

  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startX: number; startY: number; startV: ViewTransform } | null>(null)
  const [view, setView] = useState<ViewTransform>(DEFAULT_VIEW)
  const [isResetting, setIsResetting] = useState(false)

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
  const pathGenerator = useMemo(() => geoPath(projection), [projection])
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
      ...f,
      d: pathGenerator(f as unknown as Parameters<typeof pathGenerator>[0]) ?? '',
    })),
    [watershedFeatures, pathGenerator]
  )

  const activeWatershed = useMemo(() => {
    if (!activeId) return null
    return manufacturers.find(m => m.id === activeId)?.watershed ?? null
  }, [activeId, manufacturers])

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

  // ── Pan / zoom handlers ───────────────────────────────────────────────────
  const svgCoordsFromEvent = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { mx: 0, my: 0 }
    return {
      mx: (clientX - rect.left) * (MAP_W / rect.width),
      my: (clientY - rect.top) * (MAP_H / rect.height),
    }
  }, [])

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const { mx, my } = svgCoordsFromEvent(e.clientX, e.clientY)
    const delta = e.deltaY < 0 ? 1.18 : 0.847
    setView(prev => {
      const newK = Math.max(0.5, Math.min(8, prev.k * delta))
      const ratio = newK / prev.k
      return { k: newK, x: mx - (mx - prev.x) * ratio, y: my - (my - prev.y) * ratio }
    })
  }, [svgCoordsFromEvent])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    dragRef.current = { startX: e.clientX, startY: e.clientY, startV: view }
  }, [view])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return
    const dx = (e.clientX - dragRef.current.startX) * (MAP_W / (containerRef.current?.getBoundingClientRect().width ?? MAP_W))
    const dy = (e.clientY - dragRef.current.startY) * (MAP_H / (containerRef.current?.getBoundingClientRect().height ?? MAP_H))
    setView({ ...dragRef.current.startV, x: dragRef.current.startV.x + dx, y: dragRef.current.startV.y + dy })
  }, [])

  const handleMouseUp = useCallback(() => { dragRef.current = null }, [])

  const resetView = useCallback(() => {
    setIsResetting(true)
    setView(DEFAULT_VIEW)
    setTimeout(() => setIsResetting(false), 420)
  }, [])

  const zoom = useCallback((dir: 1 | -1) => {
    const delta = dir > 0 ? 1.4 : 0.71
    setView(prev => {
      const newK = Math.max(0.5, Math.min(8, prev.k * delta))
      return { ...prev, k: newK }
    })
  }, [])

  const projectionFn = projection as unknown as string

  if (!mounted) return <div className="w-full h-full bg-lc-waterDeep" />

  const transformStr = `translate(${view.x}px, ${view.y}px) scale(${view.k})`
  const isDragging = dragRef.current !== null

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-lc-waterDeep overflow-hidden select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      {/* Scanline */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <div className="scan-line absolute w-full h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(0,217,126,0.08), transparent)' }} />
      </div>
      {/* Grid overlay */}
      <div className="absolute inset-0 pointer-events-none z-10 opacity-20"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,217,126,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,217,126,0.05) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

      <ComposableMap
        projection={projectionFn as unknown as string}
        width={MAP_W} height={MAP_H}
        style={{ width: '100%', height: '100%' }}
      >
        <defs>
          <filter id="mapGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="nodeGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="wsGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id="buyerGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#0e7bb5" stopOpacity="0.1" />
          </radialGradient>
        </defs>

        {/* Single transformed group — pan/zoom applied here */}
        <g style={{
          transform: transformStr,
          transformOrigin: '0 0',
          transition: isResetting ? 'transform 0.4s cubic-bezier(0.4,0,0.2,1)' : 'none',
        }}>
          {/* States */}
          <Geographies geography={GEO_URL}>
            {({ geographies }: { geographies: Array<{ rsmKey: string; id: string }> }) =>
              geographies.filter(geo => VISIBLE_STATES.has(geo.id)).map(geo => {
                const isMI = geo.id === MICHIGAN_FIPS
                return (
                  <Geography key={geo.rsmKey} geography={geo} style={{
                    default: { fill: isMI ? '#0d2218' : '#080f0c', stroke: isMI ? '#1c3a27' : '#0f1a14', strokeWidth: isMI ? 0.8 : 0.4 },
                    hover:   { fill: isMI ? '#0f2a1e' : '#080f0c' },
                    pressed: { fill: '#0d2218' },
                  }} />
                )
              })
            }
          </Geographies>

          {/* Watershed boundaries — strokes only (no fill accumulation = no orange) */}
          {watershedPaths.map(ws => {
            if (!ws.d || ws.properties.facilityCount === 0) return null
            const col = wsColor(ws.properties.avgScore)
            const isHigh = ws.properties.riskLevel === 'high'
            const isActive = ws.properties.Name === activeWatershed
            return (
              <g key={ws.properties.HUC8}>
                {/* Glow layer for active or high-risk only */}
                {(isActive || isHigh) && (
                  <path d={ws.d}
                    fill={col} fillOpacity={isActive ? 0.12 : 0.04}
                    stroke={col} strokeWidth={isActive ? 1.8 : 1}
                    strokeOpacity={isActive ? 0.7 : 0.3}
                    filter={isHigh ? 'url(#wsGlow)' : undefined}
                    className={isHigh && !isActive ? 'ws-pulse' : undefined}
                  />
                )}
                {/* Boundary stroke */}
                <path d={ws.d}
                  fill="transparent"
                  stroke={col}
                  strokeWidth={isActive ? 1.2 : 0.5}
                  strokeOpacity={isActive ? 0.9 : 0.3}
                  onMouseEnter={() => setTooltipWs(ws.properties)}
                  onMouseLeave={() => setTooltipWs(null)}
                  style={{ cursor: 'default', pointerEvents: 'all' }}
                />
              </g>
            )
          })}

          {/* Lake labels */}
          {LAKE_LABELS.map(([label, coords]) => {
            const pt = toSvgPoint(coords as [number, number], projection)
            if (!pt) return null
            return (
              <text key={label} x={pt[0]} y={pt[1]} textAnchor="middle"
                fill="#1da6e040" fontSize="9"
                fontFamily="JetBrains Mono, monospace" fontWeight="500" letterSpacing="2">
                {label}
              </text>
            )
          })}

          {/* Ghost arcs */}
          {allMfrPoints.filter(m => !manufacturers.find(f => f.id === m.id)).map(m => (
            <path key={`ghost-${m.id}`}
              d={buildArcPath(buyerSvg, m.svgPt, 55)}
              fill="none" stroke="#1c3a27" strokeWidth="0.5" strokeOpacity="0.4" strokeDasharray="4 6" />
          ))}

          {/* Active arcs */}
          {mfrPoints.map((m, i) => {
            const isActive = m.id === activeId
            const color = scoreColor(m.scores.overall)
            const d = buildArcPath(buyerSvg, m.svgPt, 55 + i * 3)
            return (
              <g key={m.id}>
                <path d={d} fill="none" stroke={color} strokeWidth={isActive ? 3 : 1.5} strokeOpacity={isActive ? 0.15 : 0.06} />
                <path ref={el => { if (el) pathRefs.current.set(m.id, el) }}
                  d={d} fill="none" stroke={color}
                  strokeWidth={isActive ? 1.5 : 0.8} strokeOpacity={isActive ? 0.9 : 0.5}
                  className="arc-path" style={{ animationDelay: `${i * 0.12}s` }} />
                <path d={d} fill="none" stroke={color}
                  strokeWidth={isActive ? 1.5 : 0.8} strokeOpacity={isActive ? 0.5 : 0.2}
                  className="arc-flow" />
                <circle ref={el => { if (el) particleRefs.current.set(m.id, el) }}
                  r={isActive ? 3 : 2} fill={color} opacity={isActive ? 0.95 : 0.6} filter="url(#nodeGlow)" />
              </g>
            )
          })}

          {/* Buyer node */}
          <g>
            <circle cx={buyerSvg[0]} cy={buyerSvg[1]} r={28} fill="url(#buyerGrad)" />
            <circle cx={buyerSvg[0]} cy={buyerSvg[1]} r={14} fill="#071625" stroke="#1da6e0" strokeWidth="1.5" filter="url(#mapGlow)" />
            <circle cx={buyerSvg[0]} cy={buyerSvg[1]} r={18} fill="none" stroke="#1da6e0" strokeWidth="0.5" strokeOpacity="0.4" strokeDasharray="3 5" />
            <text x={buyerSvg[0]} y={buyerSvg[1] - 1} textAnchor="middle" dominantBaseline="middle" fill="#38bdf8" fontSize="6" fontFamily="JetBrains Mono, monospace" fontWeight="700">YOU</text>
            <text x={buyerSvg[0]} y={buyerSvg[1] + 22} textAnchor="middle" fill="#38bdf8" fontSize="7" fontFamily="JetBrains Mono, monospace">{buyerCity}</text>
          </g>

          {/* Manufacturer markers */}
          {mfrPoints.map(m => {
            const isActive = m.id === activeId
            const color = scoreColor(m.scores.overall)
            const [mx, my] = m.svgPt
            const wsCol = m.watershedRisk === 'high' ? '#ef4444' : m.watershedRisk === 'medium' ? '#f59e0b' : '#00d97e'
            return (
              <g key={m.id}
                onClick={e => { e.stopPropagation(); onSelect(m.id) }}
                onMouseEnter={() => { setTooltipMfr(m); setTooltipPos({ x: mx, y: my }) }}
                onMouseLeave={() => setTooltipMfr(null)}
                style={{ cursor: 'pointer' }}>
                {isActive && <circle cx={mx} cy={my} className="pulse-ring" fill="none" stroke={color} strokeWidth="1" r="8" />}
                <circle cx={mx} cy={my} r={isActive ? 14 : 10} fill={`${wsCol}12`} stroke={wsCol} strokeWidth="0.5" strokeOpacity={isActive ? 0.6 : 0.25} />
                <circle cx={mx} cy={my} r={isActive ? 7 : 5} fill={isActive ? `${color}30` : '#0c1710'} stroke={color} strokeWidth={isActive ? 1.5 : 1} filter={isActive ? 'url(#nodeGlow)' : undefined} />
                <circle cx={mx} cy={my} r={isActive ? 3 : 2} fill={color} />
                <text x={mx} y={my - 14} textAnchor="middle" fill={isActive ? '#e2f0e8' : '#4a7a5e'} fontSize={isActive ? 9 : 7} fontFamily="JetBrains Mono, monospace" fontWeight={isActive ? '600' : '400'}>
                  {m.city}
                </text>
                {isActive && (
                  <text x={mx} y={my + 22} textAnchor="middle" fill={color} fontSize="9" fontFamily="JetBrains Mono, monospace" fontWeight="700">
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
        <button onClick={() => zoom(1)} className="w-7 h-7 flex items-center justify-center bg-lc-surface border border-lc-border rounded text-lc-textMuted hover:text-lc-green hover:border-lc-green transition-colors">
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => zoom(-1)} className="w-7 h-7 flex items-center justify-center bg-lc-surface border border-lc-border rounded text-lc-textMuted hover:text-lc-green hover:border-lc-green transition-colors">
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button onClick={resetView} title="Reset view" className="w-7 h-7 flex items-center justify-center bg-lc-surface border border-lc-border rounded text-lc-textMuted hover:text-lc-green hover:border-lc-green transition-colors">
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
            className="absolute bottom-12 left-1/2 -translate-x-1/2 z-30 bg-lc-surface border border-lc-border rounded-lg px-4 py-3 shadow-xl">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full" style={{ background: wsColor(tooltipWs.avgScore), boxShadow: `0 0 6px ${wsColor(tooltipWs.avgScore)}` }} />
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
