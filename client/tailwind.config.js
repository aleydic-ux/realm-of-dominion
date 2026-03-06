/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Early 2000s fantasy RPG palette - parchment & stone
        realm: {
          bg: '#d6c9a8',
          surface: '#e8dfc8',
          panel: '#fdf8ef',
          border: '#a08050',
          gold: '#7a4f00',
          'gold-light': '#c8960c',
          'gold-dark': '#4a2e00',
          crimson: '#6b0000',
          'crimson-light': '#cc2200',
          green: '#1a4a1a',
          'green-light': '#2e7d2e',
          purple: '#3a0060',
          'purple-light': '#7a22cc',
          blue: '#00008b',
          'blue-light': '#1a4a8b',
          text: '#1a0e00',
          'text-muted': '#4a3820',
          'text-dim': '#8a7050',
        },
      },
      fontFamily: {
        mono: ['Georgia', 'Times New Roman', 'serif'],
        display: ['Cinzel', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
