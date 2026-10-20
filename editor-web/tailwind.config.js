/** @type {import('tailwindcss').Config} */
// Same token set as the main Tactica web app (tactica-web-app/tailwind.config.js)
// — keep these two files in sync by hand if the core brand palette ever changes.
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg:    "#0D1317",
        bg2:   "#0A0F13",
        sur:   "#151E25",
        sur2:  "#1A242B",
        bd:    "#1E2A33",
        bd2:   "#2A3B47",
        volt:  "#CCFF00",
        volt2: "#E8FF66",
        cyan:  "#00E5FF",
        cyan2: "#6FF0FF",
        mt:    "#8A9BA8",
        mt2:   "#5C6B7C",
        grn:   "#00E676",
        red:   "#EF4444",
        red2:  "#FF4444",
        amber: "#FFB830",
      },
      fontFamily: {
        display: ["'Playfair Display'", "serif"],
        body:    ["'DM Sans'", "sans-serif"],
        mono:    ["'Space Mono'", "monospace"],
      },
      boxShadow: {
        volt: "0 8px 32px rgba(204,255,0,0.22)",
        cyan: "0 8px 32px rgba(0,229,255,0.22)",
      },
    },
  },
  plugins: [],
};
