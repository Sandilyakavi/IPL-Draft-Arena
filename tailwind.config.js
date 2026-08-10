/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ipl: {
          dark: '#0b0f19',
          card: '#131b2e',
          accent: '#00d2ff',
          gold: '#ffb703',
        },
        team: {
          csk: { primary: '#FCCA06', secondary: '#005CA8', accent: '#FFD700' },
          dc: { primary: '#004C97', secondary: '#E42528', accent: '#1769B2' },
          gt: { primary: '#1B2133', secondary: '#CCA43B', accent: '#2B344D' },
          kkr: { primary: '#3A225D', secondary: '#F7D070', accent: '#51337A' },
          lsg: { primary: '#A2C53B', secondary: '#0057B8', accent: '#7AA326' },
          mi: { primary: '#004BA0', secondary: '#D1AB3E', accent: '#0066D0' },
          pbks: { primary: '#DD1D1D', secondary: '#D1AB3E', accent: '#ED3237' },
          rr: { primary: '#EA1B85', secondary: '#254AA5', accent: '#FF3399' },
          rcb: { primary: '#EC1C24', secondary: '#414042', accent: '#000000' },
          srh: { primary: '#F26522', secondary: '#000000', accent: '#FF7733' },
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
