import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

// ============================================================
// DESIGN SYSTEM NEXCLEAN SARL — tokens alignés sur Figma
// (fichier « NEXCLEAN SARL — Identité visuelle », page Fondations).
// Le vert clair (brand) est la couleur dominante, le bleu (ocean) un accent.
// ============================================================

const brand = {
  50: '#F2FBEA',
  100: '#E2F6CF',
  200: '#C6ECA2',
  300: '#A3DE6E',
  400: '#84CC45',
  500: '#66B32B',
  600: '#4E911F',
  700: '#3D701C',
  800: '#33591B',
  900: '#2C4B1A',
  950: '#142A08',
};

const ink = {
  50: '#F7F9F6',
  100: '#EEF2EC',
  200: '#DDE4DA',
  300: '#C2CCBE',
  400: '#8F9B8B',
  500: '#66735F',
  600: '#4B5746',
  700: '#364032',
  800: '#222A1F',
  900: '#131A12',
};

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './content/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand,
        ink,
        // Les classes `slate-*` existantes héritent des neutres de la marque.
        slate: ink,
        ocean: { 50: '#EEF5FF', 100: '#D9E8FF', 300: '#8DB8FF', 500: '#2F6FE4', 600: '#1F55C4', 700: '#1B449C' },
        sun: '#FFB020',
        // Rôles sémantiques
        primary: brand[700], // texte / icônes sur fond clair (contraste AA)
        'primary-dark': brand[800],
        'primary-light': brand[100],
        cta: brand[400], // boutons principaux (texte encre)
        success: brand[500],
        accent: '#F08A24',
      },
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '5xl': ['3rem', { lineHeight: '1.08', letterSpacing: '-0.025em' }],
        '6xl': ['3.75rem', { lineHeight: '1.04', letterSpacing: '-0.03em' }],
        '7xl': ['4.5rem', { lineHeight: '1', letterSpacing: '-0.035em' }],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(19,26,18,0.04), 0 8px 24px -4px rgba(19,26,18,0.08)',
        'card-hover': '0 2px 4px 0 rgba(19,26,18,0.04), 0 24px 48px -12px rgba(61,112,28,0.22)',
        btn: '0 1px 2px 0 rgba(19,26,18,0.06)',
        'btn-hover': '0 10px 24px -6px rgba(102,179,43,0.55)',
        glow: '0 0 0 6px rgba(132,204,69,0.18)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.7s cubic-bezier(0.22,1,0.36,1) both',
        'slide-down': 'slideDown 0.3s ease-out forwards',
        float: 'float 6s ease-in-out infinite',
        'float-slow': 'float 9s ease-in-out infinite',
        blob: 'blob 18s ease-in-out infinite',
        sparkle: 'sparkle 2.4s ease-in-out infinite',
        marquee: 'marquee 40s linear infinite',
        'pulse-ring': 'pulseRing 2.2s cubic-bezier(0.22,1,0.36,1) infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(24px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideDown: { '0%': { opacity: '0', transform: 'translateY(-8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-12px)' } },
        blob: {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '33%': { transform: 'translate(30px,-40px) scale(1.08)' },
          '66%': { transform: 'translate(-25px,20px) scale(0.95)' },
        },
        sparkle: { '0%,100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' }, '50%': { transform: 'scale(0.75) rotate(45deg)', opacity: '0.7' } },
        marquee: { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
        pulseRing: { '0%': { boxShadow: '0 0 0 0 rgba(37,211,102,0.55)' }, '100%': { boxShadow: '0 0 0 14px rgba(37,211,102,0)' } },
      },
      transitionTimingFunction: {
        apple: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        'out-expo': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [typography],
};

export default config;
