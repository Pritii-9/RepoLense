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
        soft: '0 4px 20px -2px rgba(20, 34, 29, 0.05)',
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
        glow: '0 0 20px rgba(31, 179, 127, 0.4)',
      },
      borderRadius: {
        panel: '16px',
        pill: '9999px',
      },
      screens: {
        xs: '480px',
        '3xl': '1600px',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down': {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-slow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out forwards',
        'slide-up': 'slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-down': 'slide-down 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-slow': 'pulse-slow 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
