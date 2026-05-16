'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ArrowRight, Droplets } from 'lucide-react'
import { MICHIGAN_CITIES } from '@/data/manufacturers'

const EXAMPLE_QUERIES = [
  'Sustainable aluminum castings for automotive assembly',
  'FSC-certified structural lumber for commercial construction',
  'Precision CNC components for aerospace applications',
  'ISO 14001 certified water filtration systems',
  'Bio-based packaging materials — food grade',
  'Electronic sensors for EV manufacturing',
]

const CATEGORY_TAGS = [
  'Metals & Castings',
  'Timber & Wood Products',
  'Precision Machining',
  'Electronics & Sensors',
  'Filtration Systems',
  'Biocomposites',
  'Polymers & Coatings',
  'Composites',
]

const BUYER_CITIES = Object.keys(MICHIGAN_CITIES)

interface Props {
  onStart: (query: string, buyerCity: string) => void
}

export default function DiscoveryScreen({ onStart }: Props) {
  const [query, setQuery] = useState('')
  const [buyerCity, setBuyerCity] = useState('Detroit')
  const [placeholder, setPlaceholder] = useState('')
  const [exampleIdx, setExampleIdx] = useState(0)
  const [charIdx, setCharIdx] = useState(0)
  const [particles, setParticles] = useState<{ x: number; y: number; delay: number; dur: number }[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // Animated placeholder typing effect
  useEffect(() => {
    const example = EXAMPLE_QUERIES[exampleIdx]
    if (charIdx < example.length) {
      const t = setTimeout(() => setCharIdx(c => c + 1), 30 + Math.random() * 25)
      return () => clearTimeout(t)
    } else {
      const t = setTimeout(() => {
        setCharIdx(0)
        setExampleIdx(i => (i + 1) % EXAMPLE_QUERIES.length)
      }, 3000)
      return () => clearTimeout(t)
    }
  }, [charIdx, exampleIdx])

  useEffect(() => {
    setPlaceholder(EXAMPLE_QUERIES[exampleIdx].slice(0, charIdx))
  }, [charIdx, exampleIdx])

  // Background particles
  useEffect(() => {
    setParticles(
      Array.from({ length: 24 }, () => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        delay: Math.random() * 4,
        dur: 3 + Math.random() * 4,
      }))
    )
  }, [])

  const handleSubmit = () => {
    const q = query.trim() || EXAMPLE_QUERIES[exampleIdx]
    if (q) onStart(q, buyerCity)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
      className="relative flex flex-col items-center justify-center h-screen bg-lc-bg overflow-hidden"
    >
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,217,126,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,217,126,0.04) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none">
        {particles.map((p, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-lc-green"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            animate={{ opacity: [0, 0.5, 0], y: [-10, -40] }}
            transition={{ duration: p.dur, delay: p.delay, repeat: Infinity }}
          />
        ))}
      </div>

      {/* Great Lakes silhouette */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <svg
          viewBox="0 0 800 600"
          className="absolute w-full h-full opacity-[0.03]"
          preserveAspectRatio="xMidYMid slice"
        >
          <text x="50%" y="55%" textAnchor="middle" dominantBaseline="middle"
            fill="#00d97e" fontSize="320" fontFamily="serif" fontWeight="bold">
            MI
          </text>
        </svg>
      </div>

      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(0,217,126,0.04) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 w-full max-w-2xl px-6 flex flex-col items-center gap-8">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-lg border border-lc-green flex items-center justify-center"
                style={{ boxShadow: '0 0 20px rgba(0,217,126,0.3)' }}>
                <Droplets className="w-5 h-5 text-lc-green" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-lc-green"
                style={{ boxShadow: '0 0 8px #00d97e' }} />
            </div>
            <div>
              <div className="font-mono font-bold text-2xl text-lc-green tracking-wider"
                style={{ textShadow: '0 0 20px rgba(0,217,126,0.5)' }}>
                LAKECHAIN
              </div>
              <div className="text-[10px] font-mono text-lc-textFaint tracking-widest">
                MICHIGAN SUPPLY CHAIN INTELLIGENCE
              </div>
            </div>
          </div>
          <div className="text-center text-lc-textMuted text-sm max-w-sm">
            Discover Michigan manufacturers ranked by Great Lakes watershed impact, economic value, and transport efficiency.
          </div>
        </motion.div>

        {/* Search box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="w-full"
        >
          <div
            className="relative rounded-xl border border-lc-border bg-lc-surface overflow-hidden"
            style={{ boxShadow: query ? '0 0 30px rgba(0,217,126,0.1)' : 'none' }}
          >
            <div className="flex items-center gap-3 px-5 py-4">
              <Search className="w-5 h-5 text-lc-textFaint shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKey}
                className="flex-1 bg-transparent text-lc-text text-base outline-none placeholder-lc-textFaint font-medium"
                placeholder={placeholder || 'Describe what you are sourcing…'}
              />
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: query ? '#00d97e' : '#1c3a27',
                  color: query ? '#070d0a' : '#4a7a5e',
                  boxShadow: query ? '0 0 16px rgba(0,217,126,0.4)' : 'none',
                }}
              >
                Discover
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Buyer location row */}
            <div className="flex items-center gap-3 px-5 pb-3 border-t border-lc-border pt-3">
              <span className="text-[11px] font-mono text-lc-textFaint">YOUR LOCATION</span>
              <div className="flex flex-wrap gap-1.5 flex-1">
                {BUYER_CITIES.map(city => (
                  <button
                    key={city}
                    onClick={() => setBuyerCity(city)}
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-all ${
                      buyerCity === city
                        ? 'border-lc-green text-lc-green bg-lc-greenMuted'
                        : 'border-lc-border text-lc-textFaint hover:border-lc-borderBright hover:text-lc-text'
                    }`}
                  >
                    {city}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Category tags */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-wrap justify-center gap-2"
        >
          {CATEGORY_TAGS.map((tag, i) => (
            <motion.button
              key={tag}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + i * 0.04 }}
              onClick={() => {
                setQuery(tag)
                inputRef.current?.focus()
              }}
              className="text-[11px] font-mono px-3 py-1 rounded-full border border-lc-border text-lc-textMuted hover:border-lc-green hover:text-lc-green transition-all"
            >
              {tag}
            </motion.button>
          ))}
        </motion.div>

        {/* Stats strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-center gap-6 text-center"
        >
          {[
            ['8', 'Michigan Manufacturers'],
            ['5', 'Great Lakes Watersheds'],
            ['4', 'Score Dimensions'],
            ['100%', 'Michigan-Sourced'],
          ].map(([val, label]) => (
            <div key={label}>
              <div className="font-mono font-bold text-xl text-lc-green"
                style={{ textShadow: '0 0 10px rgba(0,217,126,0.3)' }}>
                {val}
              </div>
              <div className="text-[9px] text-lc-textFaint font-mono uppercase tracking-wider">{label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  )
}
