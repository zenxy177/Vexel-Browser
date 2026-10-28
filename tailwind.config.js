/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        arc: {
          bg: '#0B0E13',
          sidebar: '#10141B',
          surface: '#171C25',
          hover: '#1D2430',
          active: '#202A38',
          border: 'rgba(190, 205, 225, 0.09)',
          accent: '#9BBCFF',
          text: '#EEF2F8',
          muted: '#929BAA',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'glow': '0 0 20px -5px rgba(59, 130, 246, 0.5)',
        'acrylic': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      }
    },
  },
  plugins: [],
}
