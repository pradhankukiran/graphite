import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#f3f2f1',
        surface: '#FFFFFF',
        'surface-raised': '#f3f2f1',
        charcoal: '#0b0c0e',
        'charcoal-light': '#505a5f',
        teal: '#00703c',
        'teal-hover': '#005a30',
        'teal-light': '#e8f5e9',
        'teal-muted': 'rgba(0,112,60,0.1)',
        danger: '#d4351c',
        'danger-light': '#fef2f1',
        warning: '#f47738',
        'warning-light': '#fff8f0',
        border: '#b1b4b6',
        'border-subtle': '#d4d5d7',
        muted: '#505a5f',
        'muted-light': '#b1b4b6',
      },
    },
  },
  plugins: [],
};

export default config;
