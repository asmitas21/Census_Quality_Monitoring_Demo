/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
        census: {
          blue: "#002e5d",
          "blue-light": "#004b87",
          "blue-dark": "#001a33",
          gold: "#c9a227",
          white: "#ffffff",
          gray: {
            100: "#f5f5f5",
            200: "#e0e0e0",
            300: "#bdbdbd",
            400: "#9e9e9e",
            500: "#757575",
            600: "#616161",
            700: "#424242",
            800: "#212121",
          },
        },
        severity: {
          high: "#b71c1c",
          medium: "#e65100",
          low: "#f9a825",
          ok: "#2e7d32",
        },
        band: {
          gold: "#c9a227",
          silver: "#9e9e9e",
          bronze: "#cd7f32",
          nomatch: "#b71c1c",
        },
      },
      fontFamily: {
        sans: ["Source Sans 3", "Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "slide-in": "slide-in 0.25s ease-out",
      },
    },
  },
  plugins: [],
};
