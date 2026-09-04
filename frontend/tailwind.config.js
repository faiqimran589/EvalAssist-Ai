/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#120B09",
          surface: "#1F1513",
          surface2: "#2A1D1A",
        },
        border: {
          DEFAULT: "#382622",
          hover: "#4D3530",
        },
        text: {
          primary: "#F5ECE8",
          secondary: "#C8B6AF",
        },
        accent: {
          DEFAULT: "#FF6B4A",
          hover: "#FF8266",
        },
        cyan: {
          DEFAULT: "#00D4FF",
        },
        status: {
          excelling: "#FF6B4A",
          stable: "#4DA6E0",
          attention: "#EF4444",
          mastered: "#00D4FF",
          needsReview: "#F59E0B",
          highConfidence: "#10B981",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        nastaliq: ["var(--font-noto-nastaliq)", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      boxShadow: {
        "glow-accent": "0 0 24px -4px rgba(255, 107, 74, 0.35)",
        "glow-cyan":   "0 0 24px -4px rgba(0, 212, 255, 0.3)",
        "glow-green":  "0 0 24px -4px rgba(16, 185, 129, 0.3)",
        "glow-sm":     "0 0 12px -2px rgba(255, 107, 74, 0.25)",
        "card":        "0 4px 24px -4px rgba(0,0,0,0.45)",
      },
      backgroundImage: {
        "accent-gradient": "linear-gradient(135deg, #FF6B4A, #FF8266)",
        "sidebar-active":  "linear-gradient(90deg, rgba(255,107,74,0.12), transparent)",
      },
    },
  },
  plugins: [],
};
