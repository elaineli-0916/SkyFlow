/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Avenir Next", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "SFMono-Regular", "Consolas", "monospace"]
      },
      colors: {
        void: "#02040a",
        glass: "rgba(215, 232, 255, 0.08)",
        aurora: "#94f4df",
        amberline: "#f6d38a"
      }
    }
  },
  plugins: []
};
