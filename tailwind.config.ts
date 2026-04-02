import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "barn-dark": "#2C1810",
        barn: "#3D261B",
        saddle: "#5C3D2E",
        brass: "#C4922A",
        "brass-light": "#D4A94B",
        parchment: "#F5E6D3",
        cream: "#FAF6F0",
        oak: "#8B7355",
        leather: "#B09A7E",
        "border-warm": "#E8DDD0",
        "border-dark": "#4A3428",
        pasture: "#1A6B4A",
        alert: "#A63D2F",
      },
      fontFamily: {
        sans: [
          "var(--font-geist-sans)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        serif: ["var(--font-brand-serif)", "Georgia", "ui-serif", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
