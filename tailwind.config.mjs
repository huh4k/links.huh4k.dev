/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        // warm near-black surfaces
        ink: {
          DEFAULT: '#0c0c0a',
          2: '#141411',
          3: '#1c1b17',
          4: '#27261f',
        },
        // hairlines
        rule: {
          DEFAULT: '#2a2923',
          strong: '#48463c',
        },
        // text
        bone: {
          DEFAULT: '#ece6d6',
          soft: '#cfc9b8',
        },
        ash: {
          DEFAULT: '#948e7e',
          dim: '#69655a',
        },
        // the one accent
        signal: {
          DEFAULT: '#ff6a1a',
          deep: '#d9520a',
          soft: '#ff9a5c',
        },
        live: '#72e08a',
      },
      fontFamily: {
        sans: ['"Bricolage Grotesque Variable"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      keyframes: {
        rise: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        ping: {
          '75%, 100%': { transform: 'scale(2.2)', opacity: '0' },
        },
      },
      animation: {
        rise: 'rise 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) both',
      },
    },
  },
  plugins: [],
};
