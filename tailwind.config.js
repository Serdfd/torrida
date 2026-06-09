import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {

      // ── Colores ──────────────────────────────────────────────────────────
      colors: {
        bg: {
          DEFAULT:  '#0A0A14',
          surface:  '#0F0F1E',
          elevated: '#13132A'
        },
        primary: {
          DEFAULT: '#E8E8F0',
          muted:   '#6B6B8A',
          subtle:  '#3D3D5C'
        },
        accent: {
          DEFAULT: '#7C6AF7',
          light:   'rgba(124,106,247,0.08)',
          hover:   '#9B8DFF'
        },
        border:   'rgba(255,255,255,0.07)',
        success:  '#34D399',
        warning:  '#FBBF24',
        danger:   '#F87171',
        info:     '#60A5FA'
      },

      // ── Tipografía ───────────────────────────────────────────────────────
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif']
      },

      fontSize: {
        '2xs': ['10px', { lineHeight: '14px' }],
        'xs':  ['11px', { lineHeight: '16px' }],
        'sm':  ['12px', { lineHeight: '18px' }],
        'base':['13.5px', { lineHeight: '20px' }],
        'md':  ['14px', { lineHeight: '20px' }],
        'lg':  ['16px', { lineHeight: '24px' }],
        'xl':  ['18px', { lineHeight: '28px' }],
        '2xl': ['22px', { lineHeight: '30px' }],
        '3xl': ['26px', { lineHeight: '34px' }]
      },

      // ── Border radius ────────────────────────────────────────────────────
      borderRadius: {
        'sm':  '6px',
        'md':  '8px',
        'lg':  '10px',
        'xl':  '12px',
        '2xl': '16px',
        '3xl': '20px',
        'full': '9999px'
      },

      // ── Sombras ──────────────────────────────────────────────────────────
      boxShadow: {
        'soft':  '0 2px 12px rgba(0,0,0,0.4)',
        'card':  '0 4px 24px rgba(0,0,0,0.5)',
        'modal': '0 8px 48px rgba(0,0,0,0.7)',
        'glow':  '0 0 24px rgba(124,106,247,0.25)'
      },

      // ── Transiciones ─────────────────────────────────────────────────────
      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
        '300': '300ms'
      },

      // ── Animaciones ──────────────────────────────────────────────────────
      animation: {
        'fade-in':        'fadeIn 0.18s ease-out both',
        'fade-up':        'fadeUp 0.22s ease-out both',
        'slide-in-left':  'slideInLeft 0.22s ease-out both',
        'slide-in-right': 'slideInRight 0.22s ease-out both',
        'scale-in':       'scaleIn 0.18s ease-out both',
        'pulse-slow':     'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite'
      },

      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' }
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)'   }
        },
        slideInLeft: {
          from: { opacity: '0', transform: 'translateX(-12px)' },
          to:   { opacity: '1', transform: 'translateX(0)'     }
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(12px)' },
          to:   { opacity: '1', transform: 'translateX(0)'    }
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to:   { opacity: '1', transform: 'scale(1)'    }
        }
      },

      // ── Spacing extra ────────────────────────────────────────────────────
      spacing: {
        '13': '3.25rem',
        '15': '3.75rem',
        '18': '4.5rem',
        '22': '5.5rem',
        '26': '6.5rem'
      }
    }
  },
  plugins: []
} satisfies Config