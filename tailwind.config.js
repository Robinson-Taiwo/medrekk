/** @type {import('tailwindcss').Config} */

/**
 * The MedRekk palette. These values and the @theme block in medrekk-web/src/app/globals.css
 * are one palette; change a colour in one and change it in the other.
 *
 * Several were corrected for contrast. The web file had already been fixed and this one had
 * not, so for a while the two drifted while a comment claimed they matched. Measured against
 * the surfaces each is actually used on (surface #FFFFFF, canvas #F7F9F7, fill #F1F5F3):
 *
 *   muted   #64748B -> #5D6C82   was 4.33:1 on fill, under the 4.50 floor; now 4.86 at worst
 *   danger  #CE2B2B              was #D94848 at 3.99:1 on canvas; now 4.96 at worst
 *   hint    #7C8A9C              new. Replaces #9CA3AF and #94A3B8 placeholders, which sat
 *                                at 2.31:1 and 2.33:1 — below even the 3:1 floor for
 *                                non-essential text
 *
 * dim is for borders and switch tracks only. It must never carry text: white on dim is
 * 1.48:1, which is how disabled buttons ended up with an invisible label.
 */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ink: "#142D2A",
        primary: "#0F6E56",
        "primary-deep": "#0C5A47",
        "primary-soft": "#D9F0E7",
        surface: "#FFFFFF",
        canvas: "#F7F9F7",
        line: "#E2E8E4",
        muted: "#5D6C82",
        hint: "#7C8A9C",
        fill: "#F1F5F3",
        track: "#E9EEEB",
        warn: "#B45309",
        "warn-soft": "#FEF3E2",
        danger: "#CE2B2B",
        "danger-soft": "#FBEAEA",
        "neutral-soft": "#EEF1F4",
        dim: "#CBD5E1",

        /*
         * The night surface, shared with the website. Used where the app wants to feel like a
         * brand moment rather than a form: signing in, the emergency card, the passport.
         *
         * The brand green does not survive on it — #0F6E56 measures 2.88:1 against #0B1A17 —
         * so `glow` is a lifted version at 7.56:1. White on `glow` is only 2.36:1 while ink on
         * it is 7.56:1, which is why a button on this surface carries dark type.
         */
        night: "#0B1A17",
        "night-panel": "#122621",
        mist: "#F2F7F4",
        "mist-dim": "#9FB3AB",
        "mist-faint": "#7C9289",
        glow: "#2FBE8F",
        "glow-ink": "#06120F",
      },
      fontFamily: {
        heading: ["Manrope-SemiBold"],
        body: ["Inter-Regular"],
      },
    },
  },
  plugins: [],
};
