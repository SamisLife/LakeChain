'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Terminal, Sparkles, X, ChevronRight } from 'lucide-react'
import { QUICK_SCENARIOS } from '@/lib/scenario'

interface Props {
  onApply: (text: string) => void
  activeText: string
}

export default function ScenarioBar({ onApply, activeText }: Props) {
  const [value, setValue] = useState('')
  const [processing, setProcessing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (text: string) => {
    if (!text.trim() && !activeText) return
    setProcessing(true)
    await new Promise(r => setTimeout(r, 600))
    onApply(text.trim())
    setValue('')
    setProcessing(false)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit(value)
    if (e.key === 'Escape') { setValue(''); onApply('') }
  }

  return (
    <div className="relative border-t border-lc-border bg-lc-bg">
      {/* Active scenario indicator */}
      <AnimatePresence>
        {activeText && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-1.5 flex items-center gap-2 bg-lc-greenMuted border-b border-lc-border">
              <Sparkles className="w-3 h-3 text-lc-green" />
              <span className="text-[11px] font-mono text-lc-green flex-1 truncate">
                Active filter: {activeText}
              </span>
              <button
                onClick={() => onApply('')}
                className="text-lc-textFaint hover:text-lc-green transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* Terminal icon */}
        <div className="flex items-center gap-1.5 text-lc-textFaint shrink-0">
          <Terminal className="w-3.5 h-3.5" />
          <span className="font-mono text-[10px] text-lc-textFaint">SCENARIO</span>
        </div>

        {/* Input */}
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKey}
            placeholder='e.g. "show only suppliers within 100 miles of Detroit" or "filter to EGLE-compliant manufacturers"'
            className="w-full bg-transparent font-mono text-[12px] text-lc-text placeholder-lc-textFaint outline-none"
          />
          {processing && (
            <motion.div
              className="absolute right-0 top-1/2 -translate-y-1/2 flex gap-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="w-1 h-1 rounded-full bg-lc-green"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 0.8, delay: i * 0.2, repeat: Infinity }}
                />
              ))}
            </motion.div>
          )}
        </div>

        {/* Submit */}
        <button
          onClick={() => handleSubmit(value)}
          disabled={processing}
          className="shrink-0 text-lc-textFaint hover:text-lc-green transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Quick scenarios */}
      <div className="flex items-center gap-2 px-4 pb-2.5 overflow-x-auto scrollbar-none">
        <span className="text-[10px] text-lc-textFaint font-mono shrink-0">QUICK →</span>
        {QUICK_SCENARIOS.map(s => (
          <button
            key={s.label}
            onClick={() => {
              setValue(s.text)
              if (!s.text) { onApply(''); setValue('') }
            }}
            className={`shrink-0 text-[10px] font-mono px-2 py-0.5 rounded border transition-all ${
              s.label === 'Reset'
                ? 'border-lc-red text-lc-red hover:bg-lc-red hover:text-white'
                : 'border-lc-border text-lc-textMuted hover:border-lc-green hover:text-lc-green'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
