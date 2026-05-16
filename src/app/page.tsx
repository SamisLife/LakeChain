'use client'

import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { AppState } from '@/types'
import { manufacturers } from '@/data/manufacturers'
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

  const handleStart = (query: string, buyerCity: string) => {
    setAppState(prev => ({
      ...prev,
      view: 'dashboard',
      query,
      buyerCity,
      buyerCoordinates: MICHIGAN_CITIES[buyerCity] ?? MICHIGAN_CITIES['Detroit'],
      activeManufacturerId: null,
    }))
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
  )
}
