/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ink: "#142D2A",
        primary: "#0F6E56",
        "primary-soft": "#D9F0E7",
        surface: "#FFFFFF",
        canvas: "#F7F9F7",
        line: "#E2E8E4",
        muted: "#64748B",
        fill: "#F1F5F3",
        track: "#E9EEEB",
        warn: "#B45309",
        "warn-soft": "#FEF3E2",
        danger: "#D94848",
        "danger-soft": "#FBEAEA",
        "neutral-soft": "#EEF1F4",
        dim: "#CBD5E1",
      },
      fontFamily: {
        heading: ["Manrope-SemiBold"],
        body: ["Inter-Regular"],
      },
    },
  },
  plugins: [],
};
