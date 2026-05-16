'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { Manufacturer } from '@/types'
import { scoreColor } from '@/lib/utils'

interface Node {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  r: number
  label: string
  score: number
  isBuyer: boolean
}

interface Edge {
  source: string
  target: string
  weight: number
  color: string
}

interface Props {
  manufacturers: Manufacturer[]
  activeId: string | null
  onSelect: (id: string) => void
  buyerCity: string
}

function buildGraph(
  manufacturers: Manufacturer[],
  width: number,
  height: number
): { nodes: Node[]; edges: Edge[] } {
  const cx = width / 2
  const cy = height / 2

  const buyerNode: Node = {
    id: '__buyer__',
    x: cx,
    y: cy,
    vx: 0,
    vy: 0,
    r: 18,
    label: 'YOUR CO.',
    score: 100,
    isBuyer: true,
  }

  const count = manufacturers.length
  const radius = Math.min(width, height) * 0.35

  const mfrNodes: Node[] = manufacturers.map((m, i) => {
    const angle = (i / count) * 2 * Math.PI - Math.PI / 2
    return {
      id: m.id,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
      r: 4 + (m.scores.overall / 100) * 8,
      label: m.city,
      score: m.scores.overall,
      isBuyer: false,
    }
  })

  const nodes = [buyerNode, ...mfrNodes]

  const edges: Edge[] = manufacturers.map(m => ({
    source: '__buyer__',
    target: m.id,
    weight: m.scores.overall / 100,
    color: scoreColor(m.scores.overall),
  }))

  // Add lateral edges between same-watershed manufacturers
  for (let i = 0; i < manufacturers.length; i++) {
    const j = (i + 1) % manufacturers.length
    if (manufacturers[i].watershedZone === manufacturers[j].watershedZone) {
      edges.push({
        source: manufacturers[i].id,
        target: manufacturers[j].id,
        weight: 0.3,
        color: '#1c3a27',
      })
    }
  }

  return { nodes, edges }
}

export default function SupplyChainGraph({ manufacturers, activeId, onSelect, buyerCity }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 500, h: 220 })
  const animRef = useRef<number>()
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const nodesRef = useRef<Node[]>([])

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect()
        setDims({ w: width, h: height })
      }
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    const { nodes: initNodes, edges: initEdges } = buildGraph(manufacturers, dims.w, dims.h)
    nodesRef.current = initNodes
    setEdges(initEdges)

    let frame = 0
    const simulate = () => {
      if (frame > 120) return
      frame++
      const ns = nodesRef.current
      const cx = dims.w / 2
      const cy = dims.h / 2

      for (const n of ns) {
        if (n.isBuyer) { n.vx = 0; n.vy = 0; continue }
        let fx = 0; let fy = 0

        // Repulsion between non-buyer nodes
        for (const other of ns) {
          if (other.id === n.id || other.isBuyer) continue
          const dx = n.x - other.x
          const dy = n.y - other.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const force = 800 / (dist * dist)
          fx += (dx / dist) * force
          fy += (dy / dist) * force
        }

        // Attraction to ring position
        const ringR = Math.min(dims.w, dims.h) * 0.35
        const dx = n.x - cx
        const dy = n.y - cy
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const ringForce = (dist - ringR) * 0.08
        fx -= (dx / dist) * ringForce
        fy -= (dy / dist) * ringForce

        n.vx = (n.vx + fx * 0.016) * 0.85
        n.vy = (n.vy + fy * 0.016) * 0.85
        n.x += n.vx
        n.y += n.vy
        n.x = Math.max(n.r + 4, Math.min(dims.w - n.r - 4, n.x))
        n.y = Math.max(n.r + 4, Math.min(dims.h - n.r - 4, n.y))
      }

      setNodes([...ns])
      animRef.current = requestAnimationFrame(simulate)
    }

    animRef.current = requestAnimationFrame(simulate)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [manufacturers, dims])

  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes])

  if (!nodes.length) return <div ref={containerRef} className="w-full h-full" />

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      <svg width={dims.w} height={dims.h} className="absolute inset-0">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Edges */}
        {edges.map((e, i) => {
          const s = nodeMap.get(e.source)
          const t = nodeMap.get(e.target)
          if (!s || !t) return null
          const isActive = e.target === activeId || e.source === activeId
          return (
            <line
              key={i}
              x1={s.x} y1={s.y}
              x2={t.x} y2={t.y}
              stroke={e.color}
              strokeWidth={isActive ? 1.5 : e.source === '__buyer__' ? 0.8 : 0.4}
              strokeOpacity={isActive ? 0.9 : 0.35}
            />
          )
        })}

        {/* Nodes */}
        {nodes.map(n => {
          const isActive = n.id === activeId
          const isMfr = !n.isBuyer
          return (
            <g
              key={n.id}
              onClick={() => isMfr && onSelect(n.id)}
              style={{ cursor: isMfr ? 'pointer' : 'default' }}
            >
              {/* Pulse ring for active */}
              {isActive && (
                <circle
                  cx={n.x} cy={n.y}
                  className="pulse-ring"
                  fill="none"
                  stroke={scoreColor(n.score)}
                  strokeWidth="1"
                  style={{ animationDuration: '1.5s' }}
                />
              )}

              {n.isBuyer ? (
                <>
                  <circle cx={n.x} cy={n.y} r={n.r + 4} fill="#071625" stroke="#1da6e0" strokeWidth="1" strokeOpacity="0.4" />
                  <circle cx={n.x} cy={n.y} r={n.r} fill="#0c2030" stroke="#1da6e0" strokeWidth="1.5" filter="url(#glow)" />
                  <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="middle"
                    fill="#1da6e0" fontSize="6" fontFamily="JetBrains Mono, monospace" fontWeight="600">
                    {buyerCity.split(' ')[0].toUpperCase().slice(0, 6)}
                  </text>
                </>
              ) : (
                <>
                  <circle
                    cx={n.x} cy={n.y} r={n.r + 3}
                    fill={`${scoreColor(n.score)}10`}
                    stroke={scoreColor(n.score)}
                    strokeWidth="0.5"
                    strokeOpacity={isActive ? 0.8 : 0.2}
                  />
                  <circle
                    cx={n.x} cy={n.y} r={n.r}
                    fill={isActive ? `${scoreColor(n.score)}30` : '#0c1710'}
                    stroke={scoreColor(n.score)}
                    strokeWidth={isActive ? 1.5 : 1}
                    filter={isActive ? 'url(#glow)' : undefined}
                  />
                  <text
                    x={n.x} y={n.y + n.r + 8}
                    textAnchor="middle"
                    fill={isActive ? '#e2f0e8' : '#4a7a5e'}
                    fontSize="7"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {n.label}
                  </text>
                </>
              )}
            </g>
          )
        })}
      </svg>

      {/* Label */}
      <div className="absolute top-2 left-3 text-[9px] font-mono text-lc-textFaint uppercase tracking-widest">
        Supply Network · {manufacturers.length} nodes
      </div>
    </div>
  )
}
