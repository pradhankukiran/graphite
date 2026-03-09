export const colors = {
  background: '#f3f2f1',
  surface: '#FFFFFF',
  charcoal: '#0b0c0e',
  charcoalLight: '#505a5f',
  teal: '#00703c',
  tealHover: '#005a30',
  tealLight: '#e8f5e9',
  danger: '#d4351c',
  warning: '#f47738',
  border: '#b1b4b6',
  muted: '#505a5f',
  surfaceRaised: '#f3f2f1',
  tealMuted: 'rgba(0,112,60,0.1)',
  dangerLight: '#fef2f1',
  warningLight: '#fff8f0',
  borderSubtle: '#d4d5d7',
  mutedLight: '#b1b4b6',
  link: '#1d70b8',
  linkHover: '#003078',
  linkVisited: '#4c2c92',
} as const;

export const entityColors: Record<string, string> = {
  Person: '#2A9D8F',
  Organization: '#264653',
  Location: '#E9C46A',
  Concept: '#F4A261',
  Event: '#E76F51',
  Technology: '#7209B7',
} as const;

export const spacing = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
  '2xl': '3rem',
  '3xl': '4rem',
} as const;

export const borderRadius = {
  sm: '0',
  md: '0',
  lg: '0',
  xl: '0',
  '2xl': '0',
  full: '9999px',
} as const;

export const shadows = {
  sm: 'none',
  md: '0 2px 4px rgba(0,0,0,0.08)',
  lg: '0 4px 8px rgba(0,0,0,0.1)',
  xl: '0 4px 8px rgba(0,0,0,0.1)',
} as const;

export const typography = {
  fontFamily: {
    sans: 'Geist, ui-sans-serif, system-ui, -apple-system, sans-serif',
    mono: 'Geist Mono, ui-monospace, SF Mono, monospace',
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: '1.3',
    normal: '1.5',
    relaxed: '1.7',
  },
} as const;
