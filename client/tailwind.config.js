/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Utopia-style dark navy palette
        realm: {
          bg: '#0a1020',
          surface: '#111828',
          panel: '#162030',
          border: '#243650',
          gold: '#c8a048',
          'gold-light': '#e8c870',
          'gold-dark': '#8a6828',
          crimson: '#7a1010',
          'crimson-light': '#cc2828',
          green: '#1a4a28',
          'green-light': '#2a8a48',
          purple: '#3a1060',
          'purple-light': '#8830cc',
          blue: '#1a4880',
          'blue-light': '#3070c0',
          text: '#c8d8e8',
          'text-muted': '#8090a8',
          'text-dim': '#485868',
        },
      },
      fontFamily: {
        mono: ['Inter', 'Verdana', 'Arial', 'sans-serif'],
        display: ['Cinzel', 'Georgia', 'serif'],
      },
      borderRadius: {
        realm: '6px',
      },
      boxShadow: {
        'realm-glow': '0 0 12px rgba(200, 160, 72, 0.15), 0 4px 16px rgba(0, 0, 0, 0.4)',
        'realm-glow-strong': '0 0 20px rgba(200, 160, 72, 0.3), 0 4px 20px rgba(0, 0, 0, 0.5)',
      },
    },
  },
  plugins: [],
};
