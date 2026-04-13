import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#07111F",
        mint: "#7FFFD4",
        ocean: "#1C8DFF",
        ember: "#FF7A59",
        panel: "rgba(11, 23, 39, 0.7)",
      },
      fontFamily: {
        sans: ["Manrope", "sans-serif"],
        display: ["Space Grotesk", "sans-serif"],
      },
      boxShadow: {
        glow: "0 20px 60px rgba(28, 141, 255, 0.22)",
      },
      backgroundImage: {
        "mesh-dark":
          "radial-gradient(circle at top left, rgba(127,255,212,.14), transparent 30%), radial-gradient(circle at top right, rgba(28,141,255,.16), transparent 32%), linear-gradient(180deg, #030711 0%, #08111F 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
