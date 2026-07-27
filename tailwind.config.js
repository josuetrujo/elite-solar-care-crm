/** @type {import('tailwindcss').Config} */
// Colors come from the Elite Solar Care Design System tokens.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Montserrat', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#EAF1FB', 100: '#C9DCF5', 200: '#94B8EB', 300: '#5E93E0',
          400: '#2E6FD0', 500: '#0E57BE', 600: '#004AAD', 700: '#003C8A',
          800: '#002E69', 900: '#001F47',
        },
        orange: {
          50: '#FEF0E8', 100: '#FBD7C4', 200: '#F8B392', 300: '#F48A5C',
          400: '#F06A30', 500: '#EC5002', 600: '#C53F00', 700: '#9E3200',
        },
        amber: {
          50: '#FFF3E0', 100: '#FFE0B2', 200: '#FFC97A', 300: '#FFAE40',
          400: '#FF9B1A', 500: '#FF8900', 600: '#DB6E00', 700: '#A85400',
        },
      },
      boxShadow: {
        brand: '0 6px 18px rgba(0, 74, 173, 0.22)',
        card: '0 1px 3px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.04)',
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
}
