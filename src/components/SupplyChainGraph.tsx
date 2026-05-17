'use client'

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, ArrowLeftRight, Bookmark, BookmarkX, TriangleAlert } from 'lucide-react'
import { Manufacturer } from '@/types'
import { scoreColor } from '@/lib/utils'

// ── Zone config ────────────────────────────────────────────────────────────────
const ZONE_COLORS: Record<string, string> = {
  'lake-superior':  '#60a5fa',
  'lake-michigan':  '#1da6e0',
  'st-marys-river': '#f59e0b',
  'lake-huron':     '#2dd4bf',
  'lake-erie':      '#a78bfa',
}
const ZONE_LABELS: Record<string, string> = {
  'lake-superior':  'Superior',
  'lake-michigan':  'Michigan',
  'st-marys-river': 'St. Marys',
  'lake-huron':     'Huron',
  'lake-erie':      'Erie',
}
const ZONE_ORDER = ['lake-superior', 'lake-michigan', 'st-marys-river', 'lake-huron', 'lake-erie']

// ── Types ──────────────────────────────────────────────────────────────────────
interface PhysNode {
  id: string
  x: number; y: number
  vx: number; vy: number
  tx: number; ty: number
  r: number
}

interface TooltipState {
  mfr: Manufacturer
  px: number; py: number
}

interface Sector {
  startAngle: number
  endAngle: number
}

interface Props {
  manufacturers: Manufacturer[]
  activeId: string | null
  onSelect: (id: string) => void
  buyerCity: string
  query?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const nodeRadius = (m: Manufacturer) => 5 + (1 - m.scores.watershed / 100) * 14

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const x1 = cx + Math.cos(a0) * r, y1 = cy + Math.sin(a0) * r
  const x2 = cx + Math.cos(a1) * r, y2 = cy + Math.sin(a1) * r
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`
}

function computeLayout(manufacturers: Manufacturer[], w: number, h: number) {
  const cx = w / 2, cy = h / 2
  const orbitR = Math.min(w * 0.39, h * 0.38, 165)

  const counts: Record<string, number> = {}
  for (const m of manufacturers) counts[m.watershedZone] = (counts[m.watershedZone] || 0) + 1

  const activeZones = ZONE_ORDER.filter(z => counts[z] > 0)
  const total = activeZones.reduce((s, z) => s + (counts[z] || 0), 0)
  const GAP = activeZones.length > 1 ? 0.18 : 0
  const avail = 2 * Math.PI - GAP * activeZones.length

  const sectors: Record<string, Sector> = {}
  let angle = -Math.PI / 2
  for (const z of activeZones) {
    const span = Math.max(0.28, ((counts[z] || 0) / total) * avail)
    sectors[z] = { startAngle: angle, endAngle: angle + span }
    angle += span + GAP
  }

  const byZone: Record<string, Manufacturer[]> = {}
  for (const m of manufacturers) {
    if (!byZone[m.watershedZone]) byZone[m.watershedZone] = []
    byZone[m.watershedZone].push(m)
  }

  const targets = new Map<string, { x: number; y: number }>()
  for (const [zone, mfrs] of Object.entries(byZone)) {
    const sec = sectors[zone]
    if (!sec) continue
    for (let i = 0; i < mfrs.length; i++) {
      const t = mfrs.length === 1 ? 0.5 : i / (mfrs.length - 1)
      const a = sec.startAngle + t * (sec.endAngle - sec.startAngle)
      targets.set(mfrs[i].id, { x: cx + Math.cos(a) * orbitR, y: cy + Math.sin(a) * orbitR })
    }
  }

  return { cx, cy, orbitR, sectors, targets, activeZones }
}

// ── NodeTooltip ────────────────────────────────────────────────────────────────
function NodeTooltip({ mfr, px, py, isPinned, onPin, onEnter, onLeave, containerRef }: {
  mfr: Manufacturer; px: number; py: number
  isPinned: boolean; onPin: () => void
  onEnter: () => void; onLeave: () => void
  containerRef: React.RefObject<HTMLDivElement>
}) {
  const rect = containerRef.current?.getBoundingClientRect()
  if (!rect) return null

  const W = 192, H_EST = 130
  let lx = px - rect.left + 14
  let ly = py - rect.top - 14
  if (lx + W > rect.width) lx = px - rect.left - W - 6
  if (ly + H_EST > rect.height) ly = py - rect.top - H_EST - 6
  if (ly < 0) ly = 4

  const col = mfr.pfas.detected ? '#ef4444' : scoreColor(mfr.scores.overall)
  const delta = mfr.countyUnemploymentRate - mfr.stateAvgUnemployment

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.1 }}
      className="absolute z-30 bg-lc-surface border border-lc-border rounded shadow-xl p-2 w-48"
      style={{ left: lx, top: ly, pointerEvents: 'auto' }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {mfr.pfas.detected && (
        <div className="flex items-center gap-1 mb-1.5 text-red-400">
          <TriangleAlert className="w-2.5 h-2.5 shrink-0" />
          <span className="text-[8px] font-mono uppercase">PFAS · Forever chemical</span>
        </div>
      )}
      <div className="text-[10px] font-semibold text-lc-text leading-tight">{mfr.name}</div>
      <div className="text-[9px] font-mono text-lc-waterDim mt-0.5 truncate">⬡ {mfr.watershed}</div>

      <div className="mt-1.5 flex items-center gap-2">
        <span className="text-[9px] font-mono shrink-0" style={{ color: col }}>
          Score {mfr.scores.overall}
        </span>
        <div className="flex-1 h-1 bg-lc-border rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${mfr.scores.overall}%`, background: col }} />
        </div>
      </div>

      <div className="mt-1 text-[8px] font-mono text-lc-textFaint">
        {mfr.county} · {mfr.countyUnemploymentRate.toFixed(1)}% unemp
        {Math.abs(delta) > 0.4 && (
          <span className={delta > 0 ? ' text-red-400' : ' text-green-400'}>
            {' '}{delta > 0 ? '▲' : '▼'}{Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>

      <button
        onClick={e => { e.stopPropagation(); onPin() }}
        className={`mt-1.5 flex items-center gap-1 text-[8px] font-mono transition-colors ${
          isPinned ? 'text-amber-400' : 'text-lc-textFaint hover:text-amber-400'
        }`}
      >
        {isPinned ? <BookmarkX className="w-2.5 h-2.5" /> : <Bookmark className="w-2.5 h-2.5" />}
        {isPinned ? 'Unpin' : 'Pin to compare'}
      </button>
    </motion.div>
  )
}

// ── FacilityDuelCard ───────────────────────────────────────────────────────────
function FacilityDuelCard({ mfr, side }: { mfr: Manufacturer; side: 'left' | 'right' }) {
  const col = mfr.pfas.detected ? '#ef4444' : scoreColor(mfr.scores.overall)
  const delta = mfr.countyUnemploymentRate - mfr.stateAvgUnemployment
  return (
    <div className={`w-28 shrink-0 space-y-0.5 ${side === 'right' ? 'text-right' : 'text-left'}`}>
      <div className="text-[10px] font-semibold text-lc-text leading-tight">{mfr.name}</div>
      <div className="text-[9px] font-mono text-lc-textMuted">{mfr.city}, MI</div>
      <div className="text-[9px] font-mono" style={{ color: col }}>Score {mfr.scores.overall}</div>
      {mfr.pfas.detected && (
        <div className={`flex items-center gap-0.5 text-red-400 ${side === 'right' ? 'justify-end' : 'justify-start'}`}>
          <TriangleAlert className="w-2 h-2" />
          <span className="text-[8px] font-mono">PFAS</span>
        </div>
      )}
      <div className="text-[8px] font-mono text-lc-textFaint">
        {mfr.countyUnemploymentRate.toFixed(1)}% unemp
        {Math.abs(delta) > 0.4 && (
          <span className={delta > 0 ? ' text-red-400' : ' text-green-400'}>
            {' '}{delta > 0 ? '▲' : '▼'}{Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="text-[8px] font-mono text-lc-waterDim truncate">
        {mfr.watershed.split('/')[0].trim()}
      </div>
      <div className="text-[8px] font-mono text-lc-textFaint">
        {mfr.employees.toLocaleString()} employees
      </div>
    </div>
  )
}

// ── DuelView ───────────────────────────────────────────────────────────────────
const DUEL_METRICS: { key: keyof Manufacturer['scores']; label: string }[] = [
  { key: 'overall',   label: 'Overall'   },
  { key: 'watershed', label: 'Watershed' },
  { key: 'economic',  label: 'Economic'  },
  { key: 'transport', label: 'Transport' },
]

function DuelView({ a, b, onClose }: { a: Manufacturer; b: Manufacturer; onClose: () => void }) {
  const aTotal = a.scores.overall - a.scores.pfasPenalty
  const bTotal = b.scores.overall - b.scores.pfasPenalty
  const gap = Math.abs(aTotal - bTotal)
  const winner = aTotal > bTotal ? a : aTotal < bTotal ? b : null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 bg-lc-bg/95 backdrop-blur-sm flex flex-col z-20"
    >
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-lc-border shrink-0">
        <div className="flex items-center gap-1.5">
          <ArrowLeftRight className="w-3 h-3 text-lc-textFaint" />
          <span className="text-[9px] font-mono text-lc-textFaint uppercase tracking-widest">
            Facility Duel
          </span>
        </div>
        <button onClick={onClose} className="text-lc-textFaint hover:text-lc-text transition-colors">
          <X className="w-3 h-3" />
        </button>
      </div>

      <div className="flex-1 flex items-center px-3 py-2 gap-3 min-h-0 overflow-hidden">
        <FacilityDuelCard mfr={a} side="left" />

        <div className="flex-1 min-w-0 space-y-2">
          {DUEL_METRICS.map(({ key, label }) => {
            const aVal = a.scores[key] as number
            const bVal = b.scores[key] as number
            const aWins = aVal >= bVal
            const aCol = scoreColor(aVal), bCol = scoreColor(bVal)
            return (
              <div key={key}>
                <div className="text-[8px] font-mono text-lc-textFaint text-center mb-0.5 uppercase">
                  {label}
                </div>
                <div className="flex items-center gap-1">
                  <div className="flex-1 flex justify-end overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${aVal}%` }}
                      transition={{ duration: 0.55, ease: 'easeOut' }}
                      className="h-1.5 rounded-l shrink-0"
                      style={{ background: aCol, opacity: aWins ? 1 : 0.32, maxWidth: '100%' }}
                    />
                  </div>
                  <div className="flex gap-0.5 shrink-0 text-[7px] font-mono">
                    <span style={{ color: aCol }}>{aVal}</span>
                    <span className="text-lc-border">|</span>
                    <span style={{ color: bCol }}>{bVal}</span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${bVal}%` }}
                      transition={{ duration: 0.55, ease: 'easeOut', delay: 0.05 }}
                      className="h-1.5 rounded-r shrink-0"
                      style={{ background: bCol, opacity: aWins ? 0.32 : 1, maxWidth: '100%' }}
                    />
                  </div>
                </div>
              </div>
            )
          })}

          <div>
            <div className="text-[8px] font-mono text-lc-textFaint text-center mb-0.5">PFAS Status</div>
            <div className="flex justify-center items-center gap-4">
              <span className={`text-[8px] font-mono ${a.pfas.detected ? 'text-red-400' : 'text-lc-green'}`}>
                {a.pfas.detected ? '⚠ Detected' : '✓ Clean'}
              </span>
              <span className="text-[8px] text-lc-textFaint">vs</span>
              <span className={`text-[8px] font-mono ${b.pfas.detected ? 'text-red-400' : 'text-lc-green'}`}>
                {b.pfas.detected ? '⚠ Detected' : '✓ Clean'}
              </span>
            </div>
          </div>

          <div className="text-[8px] font-mono text-center">
            {gap < 3 ? (
              <span className="text-lc-textFaint">Comparable overall performance</span>
            ) : (
              <span>
                <span style={{ color: scoreColor(winner!.scores.overall) }}>
                  {winner!.name.split(' ').slice(0, 2).join(' ')}
                </span>
                <span className="text-lc-textFaint"> leads by {gap} pts</span>
              </span>
            )}
          </div>
        </div>

        <FacilityDuelCard mfr={b} side="right" />
      </div>
    </motion.div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function SupplyChainGraph({ manufacturers, activeId, onSelect, buyerCity, query }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const simRef = useRef<{ nodes: PhysNode[]; raf: number | null; frozen: boolean }>({
    nodes: [], raf: null, frozen: false,
  })
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const [dims, setDims] = useState({ w: 600, h: 240 })
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [pinned, setPinned] = useState<string[]>([])
  const [compared, setCompared] = useState<string[]>([])
  const [showDuel, setShowDuel] = useState(false)

  // Resize observer
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(([e]) => {
      setDims({ w: e.contentRect.width, h: e.contentRect.height })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const layout = useMemo(
    () => computeLayout(manufacturers, dims.w, dims.h),
    [manufacturers, dims],
  )
  const { cx, cy, orbitR, sectors, targets, activeZones } = layout

  // Physics simulation
  useEffect(() => {
    if (!manufacturers.length) return

    const prevMap = new Map(simRef.current.nodes.map(n => [n.id, n]))
    simRef.current.nodes = manufacturers.map(m => {
      const t = targets.get(m.id) ?? { x: cx, y: cy }
      const prev = prevMap.get(m.id)
      return {
        id: m.id,
        x: prev?.x ?? (t.x + (Math.random() - 0.5) * 28),
        y: prev?.y ?? (t.y + (Math.random() - 0.5) * 28),
        vx: prev?.vx ?? 0,
        vy: prev?.vy ?? 0,
        tx: t.x,
        ty: t.y,
        r: nodeRadius(m),
      }
    })

    if (simRef.current.raf !== null) cancelAnimationFrame(simRef.current.raf)

    const tick = () => {
      if (!simRef.current.frozen) {
        const ns = simRef.current.nodes

        for (const n of ns) {
          n.vx += (n.tx - n.x) * 0.055 + (Math.random() - 0.5) * 0.12
          n.vy += (n.ty - n.y) * 0.055 + (Math.random() - 0.5) * 0.12
        }

        for (let i = 0; i < ns.length; i++) {
          for (let j = i + 1; j < ns.length; j++) {
            const a = ns[i], b = ns[j]
            const dx = b.x - a.x, dy = b.y - a.y
            const d = Math.sqrt(dx * dx + dy * dy) || 1
            const minD = a.r + b.r + 3
            if (d < minD) {
              const push = (minD - d) / 2
              const nx = dx / d, ny = dy / d
              a.x -= nx * push; a.y -= ny * push
              b.x += nx * push; b.y += ny * push
            }
          }
        }

        for (const n of ns) {
          n.vx *= 0.82; n.vy *= 0.82
          n.x = Math.max(n.r + 2, Math.min(dims.w - n.r - 2, n.x + n.vx))
          n.y = Math.max(n.r + 2, Math.min(dims.h - n.r - 2, n.y + n.vy))
        }

        const svg = svgRef.current
        if (svg) {
          for (const n of ns) {
            const el = svg.querySelector<SVGGElement>(`[data-nid="${n.id}"]`)
            el?.setAttribute('transform', `translate(${n.x.toFixed(1)},${n.y.toFixed(1)})`)
            const line = svg.querySelector<SVGLineElement>(`[data-line="${n.id}"]`)
            if (line) {
              line.setAttribute('x2', n.x.toFixed(1))
              line.setAttribute('y2', n.y.toFixed(1))
            }
          }
        }
      }
      simRef.current.raf = requestAnimationFrame(tick)
    }

    simRef.current.raf = requestAnimationFrame(tick)
    return () => { if (simRef.current.raf !== null) cancelAnimationFrame(simRef.current.raf) }
  }, [manufacturers, targets, cx, cy, dims])

  useEffect(() => { simRef.current.frozen = showDuel }, [showDuel])

  const togglePin = useCallback((id: string) => {
    setPinned(prev =>
      prev.includes(id)
        ? prev.filter(p => p !== id)
        : prev.length >= 2 ? [prev[1], id] : [...prev, id]
    )
  }, [])

  const mfrMap = useMemo(() => new Map(manufacturers.map(m => [m.id, m])), [manufacturers])
  const duelMfrs = useMemo(
    () => pinned.map(id => mfrMap.get(id)).filter(Boolean) as Manufacturer[],
    [pinned, mfrMap],
  )

  const handleEnter = useCallback((m: Manufacturer, e: React.MouseEvent) => {
    clearTimeout(hideTimerRef.current)
    setTooltip({ mfr: m, px: e.clientX, py: e.clientY })
  }, [])
  const handleMove = useCallback((m: Manufacturer, e: React.MouseEvent) => {
    setTooltip(prev => prev?.mfr.id === m.id ? { ...prev, px: e.clientX, py: e.clientY } : prev)
  }, [])
  const handleLeave = useCallback(() => {
    hideTimerRef.current = setTimeout(() => setTooltip(null), 200)
  }, [])

  if (!dims.w) return <div ref={containerRef} className="w-full h-full" />

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      {/* SVG radial layer */}
      <svg
        ref={svgRef}
        width={dims.w}
        height={dims.h}
        className="absolute inset-0"
        style={{ opacity: showDuel ? 0.08 : 1, transition: 'opacity 0.4s ease' }}
      >
        <defs>
          <filter id="scg-glow">
            <feGaussianBlur stdDeviation="2.5" result="c" />
            <feMerge>
              <feMergeNode in="c" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Watershed sector arcs + labels */}
        {activeZones.map(zone => {
          const sec = sectors[zone]
          if (!sec) return null
          const col = ZONE_COLORS[zone]
          const midA = (sec.startAngle + sec.endAngle) / 2
          const lr = orbitR + (orbitR > 80 ? 20 : 13)
          return (
            <g key={zone}>
              <path
                d={arcPath(cx, cy, orbitR + 7, sec.startAngle, sec.endAngle)}
                fill="none"
                stroke={col}
                strokeWidth="1.5"
                strokeOpacity="0.2"
                strokeLinecap="round"
              />
              {orbitR > 70 && (
                <text
                  x={cx + Math.cos(midA) * lr}
                  y={cy + Math.sin(midA) * lr}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={col}
                  fillOpacity={0.38}
                  fontSize={7}
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight="600"
                  letterSpacing="0.06em"
                >
                  {ZONE_LABELS[zone].toUpperCase()}
                </text>
              )}
            </g>
          )
        })}

        {/* Spoke lines — positions updated by RAF */}
        {manufacturers.map(m => {
          const t = targets.get(m.id) ?? { x: cx, y: cy }
          const col = m.pfas.detected ? '#ef4444' : scoreColor(m.scores.overall)
          const isActive = m.id === activeId
          return (
            <line
              key={m.id}
              data-line={m.id}
              x1={cx} y1={cy}
              x2={t.x.toFixed(1)} y2={t.y.toFixed(1)}
              stroke={col}
              strokeWidth={isActive ? 1.2 : 0.6}
              strokeOpacity={isActive ? 0.65 : m.pfas.detected ? 0.28 : 0.16}
              strokeDasharray={m.pfas.detected ? '3 3' : undefined}
            />
          )
        })}

        {/* Facility nodes — transforms updated by RAF */}
        {manufacturers.map(m => {
          const t = targets.get(m.id) ?? { x: cx, y: cy }
          const nr = nodeRadius(m)
          const col = m.pfas.detected ? '#ef4444' : scoreColor(m.scores.overall)
          const isActive = m.id === activeId
          const isPinned = pinned.includes(m.id)
          const wasCompared = compared.includes(m.id) && !isPinned
          return (
            <g
              key={m.id}
              data-nid={m.id}
              transform={`translate(${t.x.toFixed(1)},${t.y.toFixed(1)})`}
              style={{ cursor: 'pointer' }}
              onClick={() => onSelect(m.id)}
              onMouseEnter={e => handleEnter(m, e)}
              onMouseMove={e => handleMove(m, e)}
              onMouseLeave={handleLeave}
            >
              {/* PFAS pulsing ring */}
              {m.pfas.detected && (
                <circle
                  r={nr + 6}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="1"
                  className="pfas-ring-slow"
                />
              )}
              {/* Previously compared — purple dashed ring */}
              {wasCompared && (
                <circle
                  r={nr + 7}
                  fill="none"
                  stroke="#a78bfa"
                  strokeWidth="1"
                  strokeDasharray="3 2"
                  opacity={0.55}
                />
              )}
              {/* Pinned — amber ring */}
              {isPinned && (
                <circle r={nr + 4} fill="none" stroke="#f59e0b" strokeWidth="1.5" opacity={0.9} />
              )}
              {/* Active — breathing ring */}
              {isActive && (
                <circle
                  r={nr + 3}
                  fill="none"
                  stroke={col}
                  strokeWidth="0.8"
                  opacity={0.5}
                  style={{ animation: 'pfasRingSlow 1.8s ease-in-out infinite' }}
                />
              )}
              {/* Main circle */}
              <circle
                r={nr}
                fill={isActive ? `${col}22` : '#0b1a10'}
                stroke={col}
                strokeWidth={isActive || isPinned ? 1.5 : 0.9}
                filter={isActive || m.pfas.detected ? 'url(#scg-glow)' : undefined}
              />
              {/* Score label (only if node is large enough) */}
              {nr >= 10 && (
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={col}
                  fontSize={6}
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight="700"
                >
                  {m.scores.overall}
                </text>
              )}
            </g>
          )
        })}

        {/* Center buyer node */}
        <g style={{ pointerEvents: 'none' }}>
          <circle cx={cx} cy={cy} r={21} fill="#071625" stroke="#1da6e0" strokeWidth="0.8" strokeOpacity="0.22" />
          <circle cx={cx} cy={cy} r={14} fill="#0c2030" stroke="#1da6e0" strokeWidth="1.5" filter="url(#scg-glow)" />
          <text
            x={cx} y={query ? cy - 3 : cy}
            textAnchor="middle" dominantBaseline="middle"
            fill="#1da6e0" fontSize={5}
            fontFamily="JetBrains Mono, monospace" fontWeight="700"
          >
            {buyerCity.toUpperCase().split(' ')[0].slice(0, 7)}
          </text>
          {query && (
            <text
              x={cx} y={cy + 5}
              textAnchor="middle" dominantBaseline="middle"
              fill="#1da6e0" fontSize={4}
              fontFamily="JetBrains Mono, monospace" opacity={0.5}
            >
              {query.replace(/[^a-zA-Z ]/g, '').trim().toUpperCase().slice(0, 10)}
            </text>
          )}
        </g>
      </svg>

      {/* Pinned strip + Compare button */}
      <AnimatePresence>
        {pinned.length > 0 && !showDuel && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-2 z-10 pointer-events-none"
          >
            {pinned.map(id => {
              const m = mfrMap.get(id)
              if (!m) return null
              return (
                <div
                  key={id}
                  className="pointer-events-auto flex items-center gap-1.5 bg-lc-surface border border-amber-500/50 rounded px-2 py-0.5 shadow-lg"
                >
                  <span className="text-[8px] font-mono text-amber-400 uppercase">Pin</span>
                  <span className="text-[8px] font-mono text-lc-text">
                    {m.name.split(' ').slice(0, 2).join(' ')}
                  </span>
                  <button
                    onClick={() => togglePin(id)}
                    className="text-lc-textFaint hover:text-lc-text ml-0.5 transition-colors"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              )
            })}
            {pinned.length === 2 && (
              <motion.button
                initial={{ scale: 0.88 }}
                animate={{ scale: 1 }}
                className="pointer-events-auto flex items-center gap-1 bg-lc-greenMuted border border-lc-green rounded px-2 py-0.5 text-[8px] font-mono text-lc-green hover:bg-lc-green/20 transition-colors shadow-lg"
                onClick={() => { setCompared(pinned); setShowDuel(true) }}
              >
                <ArrowLeftRight className="w-2.5 h-2.5" />
                COMPARE
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hover tooltip */}
      <AnimatePresence>
        {tooltip && !showDuel && (
          <NodeTooltip
            mfr={tooltip.mfr}
            px={tooltip.px}
            py={tooltip.py}
            isPinned={pinned.includes(tooltip.mfr.id)}
            onPin={() => togglePin(tooltip.mfr.id)}
            onEnter={() => clearTimeout(hideTimerRef.current)}
            onLeave={() => setTooltip(null)}
            containerRef={containerRef}
          />
        )}
      </AnimatePresence>

      {/* Duel view overlay */}
      <AnimatePresence>
        {showDuel && duelMfrs.length === 2 && (
          <DuelView a={duelMfrs[0]} b={duelMfrs[1]} onClose={() => setShowDuel(false)} />
        )}
      </AnimatePresence>

      {/* Graph label */}
      <div className="absolute top-2 left-3 text-[9px] font-mono text-lc-textFaint uppercase tracking-widest pointer-events-none">
        Supply Network · {manufacturers.length} nodes
      </div>
    </div>
  )
}
