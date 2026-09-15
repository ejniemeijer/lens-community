import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

/**
 * Design tokens are defined as HSL triplets in app/globals.css and consumed
 * here via `hsl(var(--token) / <alpha-value>)` so Tailwind opacity modifiers
 * (e.g. `bg-surface/60`) keep working. Dark mode is class-based.
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
    },
    extend: {
      colors: {
        // Surfaces
        canvas: "hsl(var(--canvas) / <alpha-value>)",
        surface: "hsl(var(--surface) / <alpha-value>)",
        "surface-2": "hsl(var(--surface-2) / <alpha-value>)",
        "surface-hover": "hsl(var(--surface-hover) / <alpha-value>)",
        overlay: "hsl(var(--overlay) / <alpha-value>)",
        // Lines
        border: "hsl(var(--border) / <alpha-value>)",
        "border-strong": "hsl(var(--border-strong) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        // Text
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        muted: "hsl(var(--muted) / <alpha-value>)",
        subtle: "hsl(var(--subtle) / <alpha-value>)",
        // Brand / accent
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          fg: "hsl(var(--primary-fg) / <alpha-value>)",
          soft: "hsl(var(--primary-soft) / <alpha-value>)",
        },
        // Semantic status
        success: "hsl(var(--success) / <alpha-value>)",
        "success-soft": "hsl(var(--success-soft) / <alpha-value>)",
        warning: "hsl(var(--warning) / <alpha-value>)",
        "warning-soft": "hsl(var(--warning-soft) / <alpha-value>)",
        danger: "hsl(var(--danger) / <alpha-value>)",
        "danger-soft": "hsl(var(--danger-soft) / <alpha-value>)",
        info: "hsl(var(--info) / <alpha-value>)",
        "info-soft": "hsl(var(--info-soft) / <alpha-value>)",
      },
      borderRadius: {
        lg: "12px",
        md: "9px",
        sm: "6px",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "0.875rem" }],
      },
      boxShadow: {
        xs: "0 1px 2px 0 hsl(220 40% 12% / 0.04)",
        sm: "0 1px 3px 0 hsl(220 40% 12% / 0.06), 0 1px 2px -1px hsl(220 40% 12% / 0.06)",
        md: "0 4px 12px -2px hsl(220 40% 12% / 0.08), 0 2px 6px -2px hsl(220 40% 12% / 0.05)",
        lg: "0 12px 32px -8px hsl(220 40% 12% / 0.14), 0 4px 12px -4px hsl(220 40% 12% / 0.08)",
        popover: "0 8px 28px -6px hsl(220 40% 12% / 0.20), 0 2px 6px -2px hsl(220 40% 12% / 0.10)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.15s ease-out",
        "scale-in": "scale-in 0.12s ease-out",
        "slide-up": "slide-up 0.18s ease-out",
        "slide-in-right": "slide-in-right 0.2s cubic-bezier(0.32, 0.72, 0, 1)",
      },
    },
  },
  plugins: [typography],
};

export default config;
