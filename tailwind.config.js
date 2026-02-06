/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'calm-cream': '#faf9f7',
        'calm-blue': '#e8f1f8',
        'calm-sage': '#e6f0e9',
        'calm-teal': '#d4e9e6',
        'calm-text': '#2c3e50',
        'calm-border': '#d4e3ed',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', '"Roboto"', '"Oxygen"', '"Ubuntu"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
