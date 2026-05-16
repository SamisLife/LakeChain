'use client'

import { motion } from 'framer-motion'
import { MapPin, Users, TrendingUp, Droplets, Zap, Shield } from 'lucide-react'
import { Manufacturer } from '@/types'
import { scoreColor, watershedRiskColor, cn } from '@/lib/utils'
import ScoreRing from './ScoreRing'

interface Props {
  manufacturer: Manufacturer
  rank: number
  isActive: boolean
  onSelect: (id: string) => void
  index: number
}

const SCORE_DIMS = [
  { key: 'watershed', label: 'Watershed Impact', icon: Droplets },
  { key: 'economic', label: 'Economic Multiplier', icon: TrendingUp },
  { key: 'transport', label: 'Transport Emissions', icon: Zap },
  { key: 'certifications', label: 'Certifications', icon: Shield },
] as const

const RISK_LABELS = { low: 'Low Risk', medium: 'Moderate', high: 'Elevated' }
const CERT_COLORS: Record<string, string> = {
  environmental: '#00d97e',
  quality: '#1da6e0',
  social: '#a78bfa',
}

export default function ManufacturerCard({ manufacturer: m, rank, isActive, onSelect, index }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07 }}
      onClick={() => onSelect(m.id)}
      className={cn(
        'relative cursor-pointer rounded-lg border transition-all duration-200 overflow-hidden',
        'bg-lc-surface hover:bg-lc-surfaceAlt',
        isActive
          ? 'border-lc-green shadow-[0_0_20px_rgba(0,217,126,0.15)]'
          : 'border-lc-border hover:border-lc-borderBright'
      )}
    >
      {/* Rank stripe */}
      <div
        className="absolute left-0 top-0 bottom-0 w-0.5"
        style={{ background: scoreColor(m.scores.overall) }}
      />

      <div className="p-3 pl-4">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <ScoreRing score={m.scores.overall} size={52} stroke={4} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-mono text-[10px] text-lc-textFaint">#{rank}</span>
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                style={{
                  color: watershedRiskColor(m.watershedRisk),
                  background: `${watershedRiskColor(m.watershedRisk)}18`,
                  border: `1px solid ${watershedRiskColor(m.watershedRisk)}30`,
                }}
              >
                {RISK_LABELS[m.watershedRisk]}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-lc-text leading-tight truncate">{m.name}</h3>
            <div className="flex items-center gap-1 mt-0.5 text-lc-textMuted text-[11px]">
              <MapPin className="w-2.5 h-2.5" />
              <span>{m.city}, MI · {m.county}</span>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="font-mono text-[10px] text-lc-textFaint">REVENUE</div>
            <div className="text-xs font-semibold text-lc-text">{m.annualRevenue}</div>
            <div className="flex items-center gap-1 mt-0.5 text-[10px] text-lc-textMuted">
              <Users className="w-2.5 h-2.5" />
              <span>{m.employees.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Watershed */}
        <div className="mt-2 text-[10px] font-mono text-lc-waterDim truncate">
          ⬡ {m.watershed}
        </div>

        {/* Score breakdown bars */}
        <div className="mt-2.5 space-y-1.5">
          {SCORE_DIMS.map(({ key, label, icon: Icon }) => {
            const val = m.scores[key]
            const col = scoreColor(val)
            return (
              <div key={key} className="flex items-center gap-2">
                <Icon className="w-2.5 h-2.5 shrink-0" style={{ color: col }} />
                <span className="text-[10px] text-lc-textMuted w-28 shrink-0">{label}</span>
                <div className="flex-1 h-1 bg-lc-border rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${val}%` }}
                    transition={{ duration: 0.8, delay: index * 0.07 + 0.3 }}
                    className="h-full rounded-full"
                    style={{ background: col }}
                  />
                </div>
                <span className="font-mono text-[10px] shrink-0 w-6 text-right" style={{ color: col }}>
                  {val}
                </span>
              </div>
            )
          })}
        </div>

        {/* Certifications */}
        <div className="mt-2.5 flex flex-wrap gap-1">
          {m.certifications.map(cert => (
            <span
              key={cert.name}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
              style={{
                color: CERT_COLORS[cert.type],
                borderColor: `${CERT_COLORS[cert.type]}40`,
                background: `${CERT_COLORS[cert.type]}10`,
              }}
            >
              {cert.name}
            </span>
          ))}
        </div>

        {/* Description — only when active */}
        {isActive && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-2.5 text-[10px] text-lc-textMuted leading-relaxed border-t border-lc-border pt-2"
          >
            {m.description}
          </motion.p>
        )}
      </div>
    </motion.div>
  )
}
