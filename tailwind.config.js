/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#1E3A5F",
        gold: "#C5A028",
        cream: "#FFF8E7", // highlight for AI-auto-filled fields
      },
    },
  },
  plugins: [],
};
