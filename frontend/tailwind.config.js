/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#14221d',
        mist: '#f3f7f3',
        surface: '#ffffff',
        primary: {
          50: '#effcf7',
          100: '#d7f7eb',
          200: '#b2eed7',
          300: '#7ce0be',
          400: '#43ca9f',
          500: '#1fb37f',
          600: '#168c64',
          700: '#156f53',
          800: '#165943',
          900: '#154937',
        },
        accent: {
          50: '#fff4ec',
          100: '#ffe7d4',
          200: '#fec9a8',
          300: '#fdaa76',
          400: '#fb8740',
          500: '#f86b18',
          600: '#dc5310',
          700: '#b74010',
          800: '#923516',
          900: '#762e17',
        },
        success: '#15803d',
        warning: '#b45309',
        danger: '#be123c',
      },
      boxShadow: {
        soft: '0 18px 40px -26px rgba(20, 34, 29, 0.35)',
      },
      borderRadius: {
        panel: '8px',
      },
      screens: {
        xs: '480px',
        '3xl': '1600px',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
