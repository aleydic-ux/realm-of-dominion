/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Retro phosphor terminal palette
        realm: {
          bg: '#020b02',
          surface: '#030f03',
          panel: '#051505',
          border: '#0f3d0f',
          gold: '#ffc107',
          'gold-light': '#ffdd44',
          'gold-dark': '#996600',
          crimson: '#4a0000',
          'crimson-light': '#cc2200',
          green: '#003300',
          'green-light': '#00cc66',
          purple: '#1a0033',
          'purple-light': '#aa44ff',
          blue: '#001a33',
          'blue-light': '#00aaff',
          text: '#33ff66',
          'text-muted': '#00aa33',
          'text-dim': '#005522',
        },
      },
      fontFamily: {
        mono: ['"Share Tech Mono"', 'Courier New', 'monospace'],
        display: ['VT323', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
};
