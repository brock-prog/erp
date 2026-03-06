/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      colors: {
        // ── DECORA Machina Blue (PMS 534) — Primary Brand ──────────────────
        brand: {
          50:  '#edf1f8',
          100: '#d4dcee',
          200: '#a8b9de',
          300: '#7a96cb',
          400: '#4e72b6',
          500: '#2e509e',
          600: '#1f355e',  // Machina Blue PMS 534 ← PRIMARY
          700: '#192a4a',
          800: '#121f37',
          900: '#0b1424',
          950: '#060d18',
        },
        // ── DECORA Sublimation Green (PMS 3278) — Accent ───────────────────
        accent: {
          50:  '#e6f5f1',
          100: '#b3e4d6',
          200: '#80d3bb',
          300: '#4dc2a0',
          400: '#26b48e',
          500: '#009877',  // Sublimation Green PMS 3278 ← ACCENT
          600: '#007f63',
          700: '#006650',
          800: '#004d3c',
          900: '#003329',
          950: '#001a14',
        },
        // ── DECORA Silver (PMS 877) ─────────────────────────────────────────
        silver: {
          300: '#c8caca',
          400: '#adb0b0',
          500: '#8e9090',  // PMS 877 Silver
          600: '#737676',
          700: '#585a5a',
        },
      },
      backgroundImage: {
        'brand-gradient':        'linear-gradient(135deg, #1f355e 0%, #009377 100%)',
        'brand-gradient-r':      'linear-gradient(135deg, #009877 0%, #1f355e 100%)',
        'brand-gradient-subtle': 'linear-gradient(135deg, #1f355e 0%, #2e509e 100%)',
        'accent-gradient':       'linear-gradient(135deg, #009877 0%, #26b48e 100%)',
        'dark-gradient':         'linear-gradient(160deg, #0b1424 0%, #111c30 100%)',
      },
      boxShadow: {
        'brand':       '0 4px 24px -4px rgba(31, 53, 94, 0.28)',
        'accent':      '0 4px 24px -4px rgba(0, 152, 119, 0.32)',
        'glow-brand':  '0 0 24px rgba(31, 53, 94, 0.40)',
        'glow-accent': '0 0 24px rgba(0, 152, 119, 0.38)',
        'card':        '0 1px 3px 0 rgba(31, 53, 94, 0.08), 0 1px 2px -1px rgba(31, 53, 94, 0.05)',
        'card-hover':  '0 4px 16px -2px rgba(31, 53, 94, 0.14), 0 2px 6px -2px rgba(31, 53, 94, 0.08)',
      },
      animation: {
        'fade-in':    'fadeIn 0.25s ease-out',
        'slide-up':   'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer':    'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' },                    to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' },  '100%': { backgroundPosition: '200% 0' } },
      },
    },
  },
  plugins: [],
}
