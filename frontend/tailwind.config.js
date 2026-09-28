/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        garden: {
          bg: '#f3f6f1',
          panel: '#ffffff',
          surface: '#fbfcf9',
          subtle: '#f5f8f3',
          border: '#dde6da',
          borderSubtle: '#e8efe6',
          text: '#233527',
          textMuted: '#576b5a',
          textLight: '#839686',
          lawn: '#98b85b',
          meadow: '#a8c66c',
          water: '#6ba3d6',
          waterDeep: '#5387be',
          soil: '#82593b',
          soilDark: '#6d482d',
          stone: '#dedad0',
          peach: '#f29888',
          peachHover: '#e68776',
          rose: '#d96b7d',
          lavender: '#9a87ab',
          accent: '#3b7746',
          accentHover: '#32673c',
          sky: '#487eb3',
          sun: '#e5aa42',
        }
      }
    },
  },
  plugins: [],
}
