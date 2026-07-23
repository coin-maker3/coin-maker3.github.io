/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        nhs: {
          blue: '#005EB8',
          'dark-blue': '#003087',
          'bright-blue': '#0072CE',
          'light-blue': '#41B6E6',
          'aqua-blue': '#00A9CE',
          black: '#212B32',
          'dark-grey': '#425563',
          'mid-grey': '#768692',
          'pale-grey': '#E8EDEE',
          green: '#00A499',
          'warm-yellow': '#FFB81C',
          'warm-red': '#DA291C',
        },
      },
    },
  },
  plugins: [],
}
