import tailwindPlugin from 'fumadocs-ui/tailwind-plugin';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/content/**/*.{md,mdx}',
    './node_modules/fumadocs-ui/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // Custom theme colors can be added here
      }
    }
  },
  plugins: [tailwindPlugin]
};
