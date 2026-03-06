/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark fantasy palette
        realm: {
          bg: '#080810',
          surface: '#12121e',
          panel: '#1a1a2e',
          border: '#2a2a4a',
          gold: '#c9a227',
          'gold-light': '#e8c147',
          'gold-dark': '#8a6e15',
          crimson: '#8b1a1a',
          'crimson-light': '#c0392b',
          green: '#2d6a4f',
          'green-light': '#52b788',
          purple: '#4a2d6b',
          'purple-light': '#9b59b6',
          blue: '#1a3a5c',
          'blue-light': '#2980b9',
          text: '#e8e0d0',
          'text-muted': '#9a9080',
          'text-dim': '#6a6060',
        },
      },
      fontFamily: {
        mono: ['Courier New', 'Courier', 'monospace'],
        display: ['"Palatino Linotype"', 'Palatino', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
