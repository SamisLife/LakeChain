'use client'

import { useEffect, useState } from 'react'
import { scoreColor } from '@/lib/utils'

interface Props {
  score: number
  size?: number
  stroke?: number
}

export default function ScoreRing({ score, size = 56, stroke = 4 }: Props) {
  const [displayed, setDisplayed] = useState(0)
  const r = (size - stroke * 2) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (displayed / 100) * circ
  const color = scoreColor(score)

  useEffect(() => {
    const timer = setTimeout(() => setDisplayed(score), 100)
    return () => clearTimeout(timer)
  }, [score])

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#1c3a27"
          strokeWidth={stroke}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <span
        className="absolute font-mono font-semibold"
        style={{ color, fontSize: size * 0.28 }}
      >
        {score}
      </span>
    </div>
  )
}
