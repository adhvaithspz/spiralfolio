import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: '#0d0d0f',
        surface: '#17171a',
        'surface-2': '#1f1f23',
        border: '#2a2a2e',
        'border-strong': '#3a3a3f',
        accent: '#6366f1',
        'accent-hover': '#7c7feb',
        text: {
          DEFAULT: '#f4f4f5',
          muted: '#71717a',
          dim: '#a1a1aa',
        },
        status: {
          green: '#22c55e',
          yellow: '#eab308',
          red: '#ef4444',
          blue: '#3b82f6',
          grey: '#71717a',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
    },
  },
  plugins: [],
};

export default config;
