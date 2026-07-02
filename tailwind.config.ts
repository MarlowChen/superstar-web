
import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"jf open 粉圓 1.0"', ...defaultTheme.fontFamily.sans],
        "montserrat-light": [
          "Montserrat Light",
          ...defaultTheme.fontFamily.sans,
        ],
        "montserrat-medium": [
          "Montserrat Medium",
          ...defaultTheme.fontFamily.sans,
        ],
      },
      colors: {
        "custom-gray": {
          DEFAULT: "#F2F7FC",
          dark: "#09111B",
        },
        "custom-white": {
          DEFAULT: "#FFFFFF",
          dark: "#101A26",
        },
        "custom-light-purple": {
          DEFAULT: "#D5E2EE",
          dark: "#243648",
          hover: {
            DEFAULT: "#C0D4E6",
            dark: "#2E465E",
          }
        },
        "custom-logo-purple": {
          DEFAULT: "#159CFF",
          dark: "#53C7FF",
          hover: {
            DEFAULT: "#007EDB",
            dark: "#7CD9FF",
          }
        },
        "custom-black": {
          DEFAULT: "#10243A",
          dark: "#E7F1FB",
        },
      },
    },
  },
  plugins: [],
};
export default config;
