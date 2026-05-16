'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import { geoAlbers } from 'd3-geo'
import { motion, AnimatePresence } from 'framer-motion'
import { Manufacturer } from '@/types'
import { scoreColor, buildArcPath, toSvgPoint, createMapProjection } from '@/lib/utils'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'

const MICHIGAN_FIPS = '26'

// Great Lakes region states to show
const VISIBLE_STATES = new Set(['26', '55', '17', '18', '39', '42', '36', '27'])

const LAKE_LABELS: [string, [number, number]][] = [
  ['L. SUPERIOR', [-87.2, 47.2]],
  ['L. MICHIGAN', [-86.8, 43.8]],
  ['L. HURON',    [-83.0, 44.8]],
  ['L. ERIE',     [-82.0, 42.0]],
]

const WATERSHED_COLORS: Record<string, string> = {
  'lake-superior': '#0e7bb5',
  'lake-michigan': '#1da6e0',
  'lake-huron':    '#38bdf8',
  'lake-erie':     '#7dd3fc',
  'st-marys-river':'#0369a1',
}

interface ArcParticle {
  mfrId: string
  progress: number
  speed: number
}

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

export default function GreatLakesMap({
  manufacturers,
  allManufacturers,
  activeId,
  onSelect,
  buyerCoordinates,
  buyerCity,
}: Props) {
  const particleRefs = useRef<Map<string, SVGCircleElement>>(new Map())
  const pathRefs = useRef<Map<string, SVGPathElement>>(new Map())
  const animFrameRef = useRef<number>()
  const particlesRef = useRef<ArcParticle[]>([])
  const [tooltipMfr, setTooltipMfr] = useState<Manufacturer | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const projection = useMemo(
    () => createMapProjection(MAP_W, MAP_H),
    []
  )

  const buyerSvg = useMemo(
    () => toSvgPoint(buyerCoordinates, projection),
    [buyerCoordinates, projection]
  )

  const mfrPoints = useMemo(
    () =>
      manufacturers.map(m => ({
        ...m,
        svgPt: toSvgPoint(m.coordinates, projection),
      })),
    [manufacturers, projection]
  )

  const allMfrPoints = useMemo(
    () =>
      allManufacturers.map(m => ({
        ...m,
        svgPt: toSvgPoint(m.coordinates, projection),
      })),
    [allManufacturers, projection]
  )

  // Particles animation
  useEffect(() => {
    particlesRef.current = manufacturers.map((m, i) => ({
      mfrId: m.id,
      progress: i / manufacturers.length,
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
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [manufacturers])

  // pass the configured projection instance directly — react-simple-maps
  // uses a function value as the d3 projection directly (not as a factory)
  const projectionFn = projection as unknown as string

  if (!mounted) return <div className="w-full h-full bg-lc-waterDeep" />

  return (
    <div className="relative w-full h-full bg-lc-waterDeep overflow-hidden">
      {/* Scanline effect */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <div
          className="scan-line absolute w-full h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(0,217,126,0.08), transparent)' }}
        />
      </div>

      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-10 opacity-20"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,217,126,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,217,126,0.05) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <ComposableMap
        projection={projectionFn as unknown as string}
        width={MAP_W}
        height={MAP_H}
        style={{ width: '100%', height: '100%' }}
      >
        <defs>
          <filter id="mapGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="nodeGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="buyerGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#0e7bb5" stopOpacity="0.1" />
          </radialGradient>
        </defs>

        {/* States */}
        <Geographies geography={GEO_URL}>
          {({ geographies }: { geographies: Array<{ rsmKey: string; id: string }> }) =>
            geographies
              .filter((geo) => VISIBLE_STATES.has(geo.id))
              .map((geo) => {
                const isMichigan = geo.id === MICHIGAN_FIPS
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    style={{
                      default: {
                        fill: isMichigan ? '#0d2218' : '#080f0c',
                        stroke: isMichigan ? '#1c3a27' : '#0f1a14',
                        strokeWidth: isMichigan ? 0.8 : 0.4,
                      },
                      hover: { fill: isMichigan ? '#0f2a1e' : '#080f0c' },
                      pressed: { fill: '#0d2218' },
                    }}
                  />
                )
              })
          }
        </Geographies>

        {/* Lake labels */}
        {LAKE_LABELS.map(([label, coords]) => {
          const pt = toSvgPoint(coords as [number, number], projection)
          if (!pt) return null
          return (
            <text
              key={label}
              x={pt[0]}
              y={pt[1]}
              textAnchor="middle"
              fill="#1da6e040"
              fontSize="9"
              fontFamily="JetBrains Mono, monospace"
              fontWeight="500"
              letterSpacing="2"
            >
              {label}
            </text>
          )
        })}

        {/* SVG arc overlay */}
        <g>
          {/* Ghost arcs for filtered-out manufacturers */}
          {allMfrPoints
            .filter(m => !manufacturers.find(f => f.id === m.id))
            .map(m => {
              const d = buildArcPath(buyerSvg, m.svgPt, 55)
              return (
                <path
                  key={`ghost-${m.id}`}
                  d={d}
                  fill="none"
                  stroke="#1c3a27"
                  strokeWidth="0.5"
                  strokeOpacity="0.4"
                  strokeDasharray="4 6"
                />
              )
            })}

          {/* Active arcs */}
          {mfrPoints.map((m, i) => {
            const isActive = m.id === activeId
            const color = scoreColor(m.scores.overall)
            const d = buildArcPath(buyerSvg, m.svgPt, 55 + i * 3)
            return (
              <g key={m.id}>
                {/* Arc glow */}
                <path
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeWidth={isActive ? 3 : 1.5}
                  strokeOpacity={isActive ? 0.15 : 0.06}
                />
                {/* Main arc */}
                <path
                  ref={el => { if (el) pathRefs.current.set(m.id, el) }}
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeWidth={isActive ? 1.5 : 0.8}
                  strokeOpacity={isActive ? 0.9 : 0.5}
                  className="arc-path"
                  style={{ animationDelay: `${i * 0.12}s`, animationDuration: '1s' }}
                />
                {/* Flow overlay */}
                <path
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeWidth={isActive ? 1.5 : 0.8}
                  strokeOpacity={isActive ? 0.5 : 0.2}
                  className="arc-flow"
                />
                {/* Moving particle */}
                <circle
                  ref={el => { if (el) particleRefs.current.set(m.id, el) }}
                  r={isActive ? 3 : 2}
                  fill={color}
                  opacity={isActive ? 0.95 : 0.6}
                  filter="url(#nodeGlow)"
                />
              </g>
            )
          })}

          {/* Buyer node */}
          <g>
            <circle
              cx={buyerSvg[0]} cy={buyerSvg[1]}
              r={28}
              fill="url(#buyerGrad)"
            />
            <circle
              cx={buyerSvg[0]} cy={buyerSvg[1]}
              r={14}
              fill="#071625"
              stroke="#1da6e0"
              strokeWidth="1.5"
              filter="url(#mapGlow)"
            />
            <circle
              cx={buyerSvg[0]} cy={buyerSvg[1]}
              r={18}
              fill="none"
              stroke="#1da6e0"
              strokeWidth="0.5"
              strokeOpacity="0.4"
              strokeDasharray="3 5"
            />
            <text
              x={buyerSvg[0]} y={buyerSvg[1] - 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#38bdf8"
              fontSize="6"
              fontFamily="JetBrains Mono, monospace"
              fontWeight="700"
            >
              YOU
            </text>
            <text
              x={buyerSvg[0]} y={buyerSvg[1] + 22}
              textAnchor="middle"
              fill="#38bdf8"
              fontSize="7"
              fontFamily="JetBrains Mono, monospace"
            >
              {buyerCity}
            </text>
          </g>

          {/* Manufacturer markers */}
          {mfrPoints.map(m => {
            const isActive = m.id === activeId
            const color = scoreColor(m.scores.overall)
            const [mx, my] = m.svgPt
            const wColor = WATERSHED_COLORS[m.watershedZone] || '#1da6e0'

            return (
              <g
                key={m.id}
                onClick={() => onSelect(m.id)}
                onMouseEnter={() => {
                  setTooltipMfr(m)
                  setTooltipPos({ x: mx, y: my })
                }}
                onMouseLeave={() => setTooltipMfr(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Outer pulse ring */}
                {isActive && (
                  <circle
                    cx={mx} cy={my}
                    className="pulse-ring"
                    fill="none"
                    stroke={color}
                    strokeWidth="1"
                    r="8"
                  />
                )}
                {/* Watershed zone indicator */}
                <circle
                  cx={mx} cy={my}
                  r={isActive ? 14 : 10}
                  fill={`${wColor}12`}
                  stroke={wColor}
                  strokeWidth="0.5"
                  strokeOpacity={isActive ? 0.6 : 0.25}
                />
                {/* Main node */}
                <circle
                  cx={mx} cy={my}
                  r={isActive ? 7 : 5}
                  fill={isActive ? `${color}30` : '#0c1710'}
                  stroke={color}
                  strokeWidth={isActive ? 1.5 : 1}
                  filter={isActive ? 'url(#nodeGlow)' : undefined}
                />
                {/* Inner dot */}
                <circle cx={mx} cy={my} r={isActive ? 3 : 2} fill={color} />

                {/* City label */}
                <text
                  x={mx} y={my - 14}
                  textAnchor="middle"
                  fill={isActive ? '#e2f0e8' : '#4a7a5e'}
                  fontSize={isActive ? 9 : 7}
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight={isActive ? '600' : '400'}
                >
                  {m.city}
                </text>
                {/* Score badge */}
                {isActive && (
                  <text
                    x={mx} y={my + 22}
                    textAnchor="middle"
                    fill={color}
                    fontSize="9"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight="700"
                  >
                    {m.scores.overall}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </ComposableMap>

      {/* Tooltip */}
      <AnimatePresence>
        {tooltipMfr && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute pointer-events-none z-30 bg-lc-surface border border-lc-border rounded-lg p-3 shadow-xl"
            style={{
              left: `${(tooltipPos.x / MAP_W) * 100}%`,
              top: `${(tooltipPos.y / MAP_H) * 100}%`,
              transform: 'translate(-50%, -120%)',
              maxWidth: 220,
            }}
          >
            <div className="font-semibold text-xs text-lc-text mb-1">{tooltipMfr.name}</div>
            <div className="text-[10px] text-lc-textMuted">{tooltipMfr.watershed}</div>
            <div className="mt-1.5 flex gap-2">
              {(['overall', 'watershed', 'economic'] as const).map(key => (
                <div key={key} className="text-center">
                  <div className="font-mono text-[10px]" style={{ color: scoreColor(tooltipMfr.scores[key]) }}>
                    {tooltipMfr.scores[key]}
                  </div>
                  <div className="text-[8px] text-lc-textFaint capitalize">{key}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-1.5 text-[9px] font-mono">
        <div className="text-lc-textFaint uppercase tracking-wider mb-0.5">Score</div>
        {([['≥ 85 Exemplary', '#00d97e'], ['70–84 Adequate', '#f59e0b'], ['< 70 At Risk', '#ef4444']] as const).map(([lbl, col]) => (
          <div key={lbl} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: col }} />
            <span style={{ color: col }}>{lbl}</span>
          </div>
        ))}
        <div className="mt-1 pt-1 border-t border-lc-border text-lc-textFaint">EGLE Monitoring Active</div>
      </div>

      {/* Header overlay */}
      <div className="absolute top-2 left-3 z-20 text-[9px] font-mono text-lc-textFaint uppercase tracking-widest">
        Great Lakes Basin · Michigan Watershed Intelligence
      </div>
    </div>
  )
}
