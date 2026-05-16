'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AppState, Manufacturer } from '@/types'
import { MICHIGAN_CITIES } from '@/data/manufacturers'
import DiscoveryScreen from '@/components/DiscoveryScreen'
import Dashboard from '@/components/Dashboard'

const DEFAULT_STATE: AppState = {
  view: 'discovery',
  query: '',
  scenario: { text: '', filters: {} },
  activeManufacturerId: null,
  buyerCoordinates: MICHIGAN_CITIES['Detroit'],
  buyerCity: 'Detroit',
}

export default function Home() {
  const [appState, setAppState] = useState<AppState>(DEFAULT_STATE)
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')

  const handleStart = async (query: string, buyerCity: string) => {
    setLoading(true)
    setLoadingMsg('Decomposing sourcing query…')

    try {
      await new Promise(r => setTimeout(r, 400))
      setLoadingMsg('Scanning 769 Michigan TRI facilities…')

      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, buyerCity }),
      })

      setLoadingMsg('Scoring watershed impact…')
      const data = await res.json()
      setManufacturers(data.manufacturers ?? [])

      setAppState(prev => ({
        ...prev,
        view: 'dashboard',
        query,
        buyerCity,
        buyerCoordinates: MICHIGAN_CITIES[buyerCity] ?? MICHIGAN_CITIES['Detroit'],
        activeManufacturerId: null,
      }))
    } catch {
      setLoadingMsg('Search failed — using demo data')
      await new Promise(r => setTimeout(r, 1000))
    } finally {
      setLoading(false)
    }
  }

  const handleStateChange = (updates: Partial<AppState>) => {
    setAppState(prev => {
      const next = { ...prev, ...updates }
      if (updates.buyerCity) {
        next.buyerCoordinates = MICHIGAN_CITIES[updates.buyerCity] ?? prev.buyerCoordinates
      }
      return next
    })
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {appState.view === 'discovery' ? (
          <DiscoveryScreen key="discovery" onStart={handleStart} />
        ) : (
          <Dashboard
            key="dashboard"
            manufacturers={manufacturers}
            state={appState}
            onStateChange={handleStateChange}
          />
        )}
      </AnimatePresence>

      {/* Loading overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-lc-bg/95"
          >
            {/* Pulse ring */}
            <div className="relative mb-8">
              <div className="w-16 h-16 rounded-full border-2 border-lc-green animate-ping absolute inset-0 opacity-30" />
              <div className="w-16 h-16 rounded-full border border-lc-green flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-lc-green animate-pulse" style={{ boxShadow: '0 0 20px #00d97e' }} />
              </div>
            </div>

            <div className="font-mono text-lc-green text-sm tracking-widest mb-2">LAKECHAIN SEARCH</div>
            <div className="font-mono text-lc-textMuted text-xs animate-pulse">{loadingMsg}</div>

            {/* Progress dots */}
            <div className="flex gap-1.5 mt-6">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-lc-green"
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
