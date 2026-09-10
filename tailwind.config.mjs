/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#090a0f',
          card: '#10121a',
          'card-hover': '#161924',
          border: '#1e2230',
          'border-subtle': '#181b26',
          muted: '#8e96aa',
        },
        brand: {
          blue: '#3b82f6',
          cyan: '#06b6d4',
          emerald: '#10b981',
          violet: '#8b5cf6',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
};
