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
          DEFAULT:  '#0F0F1A',
          surface:  '#16162A',
          elevated: '#1E1E35'
        },
        sidebar: {
          DEFAULT: '#0B0B16',
          border:  '#1E1E35',
          text:    '#C8C8E0',
          active:  '#E07A5F'
        },
        primary: {
          DEFAULT: '#EEEEF0',
          muted:   '#8A8AA8',
          subtle:  '#3D3D5C'
        },
        accent: {
          DEFAULT: '#E07A5F',
          light:   'rgba(224,122,95,0.12)',
          hover:   '#E8917A',
          2:       '#F2CC8F'
        },
        card:     '#16162A',
        border:   '#1E1E35',
        success:  '#4CAF82',
        warning:  '#F2CC8F',
        danger:   '#E07A5F',
        info:     '#60A5FA'
      },

      // ── Tipografía ───────────────────────────────────────────────────────
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif']
      },

      fontSize: {
        '2xs': ['12px', { lineHeight: '16px' }],
        'xs':  ['13px', { lineHeight: '18px' }],
        'sm':  ['14px', { lineHeight: '20px' }],
        'base':['15px', { lineHeight: '22px' }],
        'md':  ['16px', { lineHeight: '22px' }],
        'lg':  ['18px', { lineHeight: '26px' }],
        'xl':  ['20px', { lineHeight: '30px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
        '3xl': ['28px', { lineHeight: '36px' }]
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
        'glow':  '0 0 24px rgba(224,122,95,0.25)'
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