/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        carbon: {
          DEFAULT: '#08090D',
          bg: '#08090D',
          card: '#0F1118',
          'card-hover': '#151824',
          border: '#1E2333',
          'border-subtle': '#181D2B',
          muted: '#8e96aa',
        },
        dark: {
          bg: '#08090D',
          card: '#0F1118',
          'card-hover': '#151824',
          border: '#1E2333',
          'border-subtle': '#181D2B',
          muted: '#8e96aa',
        },
        telemetry: {
          green: '#22c55e',
          blue: '#38bdf8',
          magenta: '#BF3B68',
          amber: '#f59e0b',
          purple: '#c084fc',
        },
        brand: {
          blue: '#3b82f6',
          cyan: '#06b6d4',
          emerald: '#10b981',
          violet: '#8b5cf6',
          leetify: '#BF3B68',
        },
        leetify: {
          DEFAULT: '#BF3B68',
          hover: '#d64c7b',
          muted: 'rgba(191, 59, 104, 0.15)',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
      boxShadow: {
        'telemetry-magenta': '0 0 20px -3px rgba(191, 59, 104, 0.35)',
        'telemetry-blue': '0 0 20px -3px rgba(56, 189, 248, 0.35)',
        'telemetry-green': '0 0 20px -3px rgba(34, 197, 94, 0.35)',
        'telemetry-amber': '0 0 20px -3px rgba(245, 158, 11, 0.35)',
      },
    },
  },
  plugins: [],
};
