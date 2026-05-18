import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: '#0b0b0e',
        surface: '#15151a',
        'surface-2': '#1c1c22',
        border: '#26262c',
        'border-strong': '#393941',
        accent: '#6366f1',
        'accent-hover': '#818bff',
        'accent-soft': 'rgba(99, 102, 241, 0.16)',
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
      boxShadow: {
        glow: '0 0 0 1px rgba(99, 102, 241, 0.35), 0 10px 40px -10px rgba(99, 102, 241, 0.4)',
        'glow-soft': '0 8px 32px -12px rgba(99, 102, 241, 0.35)',
        'card-hover': '0 12px 40px -16px rgba(0, 0, 0, 0.6)',
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
