/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0f18',
        tactical: {
          cyan: '#00f0ff',
          purple: '#b000ff',
          red: '#ff2040',
          green: '#00fa9a',
          dark: '#111827',
          panel: 'rgba(17, 24, 39, 0.8)',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Roboto Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
