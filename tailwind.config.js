/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#17211f',
        mist: '#f7faf9',
        line: '#dbe6e2',
        leaf: '#1f8a70',
        sea: '#2f6f9f',
        amber: '#d28b22'
      },
      boxShadow: {
        soft: '0 16px 40px rgba(23, 33, 31, 0.08)'
      }
    }
  },
  plugins: []
};
