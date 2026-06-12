/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        pg: {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#627d98',
          600: '#3d7cae',
          700: '#336791',
          800: '#243b53',
          900: '#102a43',
          950: '#0d1117',
        },
        // Vivid blues for dark-mode accents (links, highlights) — the muted
        // pg ramp reads as gray on dark backgrounds.
        accent: {
          300: '#79c0ff',
          400: '#58a6ff',
          500: '#388bfd',
          600: '#1f6feb',
        },
        surface: {
          DEFAULT: '#ffffff',
          secondary: '#f8fafc',
          elevated: '#ffffff',
          border: '#e2e8f0',
        },
        'surface-dark': {
          DEFAULT: '#0d1117',
          secondary: '#111827',
          elevated: '#1a2332',
          border: '#1e293b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(to right, rgba(51,103,145,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(51,103,145,0.05) 1px, transparent 1px)',
        'grid-pattern-dark': 'linear-gradient(to right, rgba(51,103,145,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(51,103,145,0.08) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid': '32px 32px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
