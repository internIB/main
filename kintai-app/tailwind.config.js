/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#4A86C8",
        admin: "#7B1FA2",
        warning: "#FF6F00",
      },
    },
  },
  plugins: [],
};
