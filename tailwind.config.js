/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        lc: {
          bg:          '#070d0a',
          surface:     '#0c1710',
          surfaceAlt:  '#0f1f14',
          border:      '#1c3a27',
          borderBright:'#2d5c40',
          green:       '#00d97e',
          greenDim:    '#00a862',
          greenGlow:   '#00ff88',
          greenMuted:  '#1a4d30',
          water:       '#1da6e0',
          waterDeep:   '#071625',
          waterDim:    '#0e7bb5',
          waterGlow:   '#38bdf8',
          text:        '#e2f0e8',
          textMuted:   '#8eb89c',
          textFaint:   '#4a7a5e',
          amber:       '#f59e0b',
          red:         '#ef4444',
          redDim:      '#7f1d1d',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    }
  },
  plugins: []
}
