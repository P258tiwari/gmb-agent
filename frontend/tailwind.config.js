/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      colors: {
        brand: {
          blue: '#2563EB',
          'blue-light': '#EFF6FF',
          'blue-border': '#BFDBFE',
          green: '#16A34A',
          'green-light': '#F0FDF4',
          orange: '#D97706',
          'orange-light': '#FFFBEB',
          red: '#DC2626',
          'red-light': '#FEF2F2',
          purple: '#7C3AED',
          'purple-light': '#F5F3FF'
        }
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms')
  ]
};
