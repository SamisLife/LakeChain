'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { Filter, RefreshCw, Layers, Map, GitBranch } from 'lucide-react'
import { Manufacturer, AppState, ScenarioState } from '@/types'
import { parseScenario, applyScenario } from '@/lib/scenario'
import ManufacturerCard from './ManufacturerCard'
import ScenarioBar from './ScenarioBar'

const GreatLakesMap = dynamic(() => import('./GreatLakesMap'), { ssr: false })
const SupplyChainGraph = dynamic(() => import('./SupplyChainGraph'), { ssr: false })

interface Props {
  manufacturers: Manufacturer[]
  state: AppState
  onStateChange: (s: Partial<AppState>) => void
}

type RightPanel = 'map' | 'graph' | 'split'

export default function Dashboard({ manufacturers, state, onStateChange }: Props) {
  const [rightPanel, setRightPanel] = useState<RightPanel>('split')
  const [scenario, setScenario] = useState<ScenarioState>({ text: '', filters: {} })

  const filtered = useMemo(() => {
    const result = applyScenario(manufacturers, scenario)
    return [...result].sort((a, b) => b.scores.overall - a.scores.overall)
  }, [manufacturers, scenario])

  const handleScenario = (text: string) => {
    const filters = text ? parseScenario(text) : {}
    setScenario({ text, filters })
  }

  const handleSelect = (id: string) => {
    onStateChange({ activeManufacturerId: id === state.activeManufacturerId ? null : id })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-screen bg-lc-bg"
    >
      {/* Header */}
      <header className="flex items-center gap-4 px-5 py-3 border-b border-lc-border bg-lc-surface shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded border border-lc-green flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-lc-green" style={{ boxShadow: '0 0 6px #00d97e' }} />
          </div>
          <span className="font-mono font-bold text-lc-green tracking-wider text-sm">LAKECHAIN</span>
        </div>

        <div className="w-px h-4 bg-lc-border" />

        <div className="flex-1">
          <span className="text-[11px] text-lc-textFaint font-mono">SOURCING ›</span>
          <span className="text-[11px] text-lc-text ml-2 font-medium truncate max-w-xs inline-block">
            {state.query}
          </span>
        </div>

        <div className="flex items-center gap-1 text-[10px] font-mono text-lc-textFaint">
          <div className="w-1.5 h-1.5 rounded-full bg-lc-green animate-pulse" />
          {filtered.length} of {manufacturers.length} suppliers active
        </div>

        {/* Panel toggles */}
        <div className="flex border border-lc-border rounded overflow-hidden">
          {([['split', Layers], ['map', Map], ['graph', GitBranch]] as const).map(([mode, Icon]) => (
            <button
              key={mode}
              onClick={() => setRightPanel(mode)}
              className={`px-2 py-1.5 transition-colors ${
                rightPanel === mode ? 'bg-lc-greenMuted text-lc-green' : 'text-lc-textFaint hover:text-lc-text'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>

        <button
          onClick={() => onStateChange({ view: 'discovery', activeManufacturerId: null })}
          className="flex items-center gap-1.5 text-lc-textFaint hover:text-lc-text text-[11px] font-mono transition-colors border border-lc-border hover:border-lc-borderBright rounded px-2 py-1"
        >
          <RefreshCw className="w-3 h-3" />
          New Query
        </button>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Manufacturer list */}
        <div className="w-72 shrink-0 border-r border-lc-border flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-lc-border flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3 h-3 text-lc-textFaint" />
              <span className="text-[10px] font-mono text-lc-textFaint uppercase tracking-wider">
                Ranked Suppliers
              </span>
            </div>
            <span className="font-mono text-[10px] text-lc-green">{filtered.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            <AnimatePresence mode="popLayout">
              {filtered.map((m, i) => (
                <ManufacturerCard
                  key={m.id}
                  manufacturer={m}
                  rank={i + 1}
                  isActive={m.id === state.activeManufacturerId}
                  onSelect={handleSelect}
                  index={i}
                />
              ))}
              {filtered.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-12 text-lc-textFaint text-xs font-mono"
                >
                  <div className="text-2xl mb-2">∅</div>
                  No suppliers match current filters.
                  <br />
                  Adjust your scenario.
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right: Map / Graph panels */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Map panel */}
          {(rightPanel === 'map' || rightPanel === 'split') && (
            <div
              className="relative border-b border-lc-border"
              style={{ flex: rightPanel === 'map' ? '1' : '0 0 65%' }}
            >
              <GreatLakesMap
                manufacturers={filtered}
                allManufacturers={manufacturers}
                activeId={state.activeManufacturerId}
                onSelect={handleSelect}
                buyerCoordinates={state.buyerCoordinates}
                buyerCity={state.buyerCity}
              />
            </div>
          )}

          {/* Graph panel */}
          {(rightPanel === 'graph' || rightPanel === 'split') && (
            <div
              className="relative bg-lc-bg border-b border-lc-border"
              style={{ flex: rightPanel === 'graph' ? '1' : '0 0 35%' }}
            >
              <SupplyChainGraph
                manufacturers={filtered}
                activeId={state.activeManufacturerId}
                onSelect={handleSelect}
                buyerCity={state.buyerCity}
              />
            </div>
          )}
        </div>
      </div>

      {/* Bottom scenario bar */}
      <div className="shrink-0">
        <ScenarioBar onApply={handleScenario} activeText={scenario.text} />
      </div>
    </motion.div>
  )
}
