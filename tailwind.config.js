/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1C1917',
        mist: '#FAFAF9',
        line: '#E7E5E4',
        leaf: '#166534',
        sea: '#2563EB',
        amber: '#65A30D'
      },
      boxShadow: {
        soft: '0 16px 40px rgba(28, 25, 23, 0.08)'
      }
    }
  },
  plugins: []
};
