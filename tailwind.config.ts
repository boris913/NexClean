import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

// ============================================================
// DESIGN SYSTEM NEXCLEAN SARL — « service de confiance » (D-06).
// Documentation, usages et ratios de contraste : docs/design-system.md.
// - Surfaces fortes : vert profond (`forest`, famille brand-900/950).
// - Accent : lime `brand-400` (= `cta`), toujours avec un texte encre.
// - Piliers : rôles `pillar-*` (pictos, filets, fonds doux).
// Les ratios cités sont calculés selon WCAG 2.x, texte sur fond.
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

const ocean = {
  50: '#EEF5FF',
  100: '#D9E8FF',
  300: '#8DB8FF',
  500: '#2F6FE4',
  600: '#1F55C4', // 6,66:1 sur blanc
  700: '#1B449C', // 8,92:1 sur blanc
};

// Vert feuille plus froid (pilier Espaces verts), distinct du lime de la marque.
const leaf = {
  50: '#ECF8F1',
  100: '#D2EFDF',
  300: '#7FD1A6',
  500: '#1F9D60',
  600: '#15804D', // 4,97:1 sur blanc
  700: '#0F6B40', // 6,57:1 sur blanc
};

// Ambre (pilier Boutique, avertissements). `sun` reste utilisable seul.
const sun = {
  DEFAULT: '#FFB020',
  50: '#FFF7E6',
  100: '#FFEBC2',
  400: '#FFB020',
  700: '#8F5300', // 6,17:1 sur blanc
};

/** Couleurs de pilier : `DEFAULT` = texte/icône (AA sur blanc et sur `soft`). */
const pillar = {
  proprete: { DEFAULT: brand[700], soft: brand[50], border: brand[200] },
  recrutement: { DEFAULT: ocean[600], soft: ocean[50], border: ocean[100] },
  'espaces-verts': { DEFAULT: leaf[700], soft: leaf[50], border: leaf[100] },
  emploi: { DEFAULT: ocean[700], soft: ocean[50], border: ocean[100] },
  boutique: { DEFAULT: sun[700], soft: sun[50], border: sun[100] },
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
        ocean,
        leaf,
        sun,
        pillar,
        // ── Rôles sémantiques ──────────────────────────────────
        // Surface forte dominante : blanc dessus = 9,87:1 (DEFAULT), 15,39:1 (deep).
        forest: { DEFAULT: brand[900], deep: brand[950], light: brand[800] },
        primary: brand[700], // texte / liens sur fond clair : 5,94:1
        'primary-dark': brand[800],
        'primary-light': brand[100],
        // Accent CTA : encre dessus = 9,04:1 (DEFAULT), 11,17:1 (hover). Jamais de texte blanc (1,96:1).
        cta: { DEFAULT: brand[400], hover: brand[300] },
        // Texte secondaire minimal : ink-500 = 5,02:1 sur blanc, 4,74:1 sur ink-50.
        // Ne jamais descendre à ink-400/slate-400 (2,90:1) pour du texte.
        muted: ink[500],
        // WhatsApp : texte encre sur le vert officiel = 8,94:1 (hover 7,24:1).
        // `dark` (#075E54) pour du texte ou un fond avec texte blanc : 7,67:1.
        whatsapp: { DEFAULT: '#25D366', hover: '#1FBE5B', ink: ink[900], dark: '#075E54' },
        // États : `DEFAULT` = texte/icône, AA sur blanc et sur `soft`.
        success: { DEFAULT: brand[700], soft: brand[50], border: brand[200] }, // 5,94:1
        danger: { DEFAULT: '#B42318', soft: '#FEF3F2', border: '#FECDCA' }, // 6,57:1
        warning: { DEFAULT: sun[700], soft: sun[50], border: '#FFDB99' }, // 6,17:1
        info: { DEFAULT: ocean[700], soft: ocean[50], border: ocean[100] }, // 8,92:1
        // Orange : `DEFAULT` lisible (5,43:1, blanc dessus idem) ; `bright` décoratif uniquement (2,51:1).
        accent: { DEFAULT: '#B54708', soft: '#FEF0E6', bright: '#F08A24' },
      },
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
      },
      // Échelle typographique unique (fluide : pas besoin de préfixes sm:/lg:).
      // Titres : à combiner avec `font-display` (déjà appliqué aux h1-h4 par globals.css).
      fontSize: {
        display: ['clamp(2.5rem, 1.6rem + 3.6vw, 4.5rem)', { lineHeight: '1.02', letterSpacing: '-0.035em', fontWeight: '800' }],
        h1: ['clamp(2.25rem, 1.65rem + 2.4vw, 3.75rem)', { lineHeight: '1.05', letterSpacing: '-0.03em', fontWeight: '800' }],
        h2: ['clamp(1.875rem, 1.45rem + 1.7vw, 3rem)', { lineHeight: '1.1', letterSpacing: '-0.025em', fontWeight: '700' }],
        h3: ['clamp(1.25rem, 1.15rem + 0.45vw, 1.5rem)', { lineHeight: '1.25', letterSpacing: '-0.015em', fontWeight: '700' }],
        lead: ['clamp(1.0625rem, 1rem + 0.35vw, 1.25rem)', { lineHeight: '1.6' }],
        body: ['1rem', { lineHeight: '1.65' }],
        small: ['0.875rem', { lineHeight: '1.5' }],
        eyebrow: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.14em', fontWeight: '700' }],
        '5xl': ['3rem', { lineHeight: '1.08', letterSpacing: '-0.025em' }],
        '6xl': ['3.75rem', { lineHeight: '1.04', letterSpacing: '-0.03em' }],
        '7xl': ['4.5rem', { lineHeight: '1', letterSpacing: '-0.035em' }],
      },
      // Largeur de conteneur unique (+ variante étroite) : remplace les max-w-* épars.
      maxWidth: {
        container: '72rem',
        'container-narrow': '48rem',
      },
      spacing: {
        // Rythme vertical des sections : `py-section`, `py-section-sm`.
        section: 'clamp(4rem, 2.75rem + 5vw, 7rem)',
        'section-sm': 'clamp(2.5rem, 2rem + 2.5vw, 4rem)',
        // Cible tactile minimale (44 px) : `min-h-tap min-w-tap`.
        tap: '2.75rem',
      },
      borderRadius: {
        card: '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(19,26,18,0.04), 0 8px 24px -4px rgba(19,26,18,0.08)',
        'card-hover': '0 2px 4px 0 rgba(19,26,18,0.04), 0 24px 48px -12px rgba(61,112,28,0.22)',
        btn: '0 1px 2px 0 rgba(19,26,18,0.06)',
        'btn-hover': '0 10px 24px -6px rgba(102,179,43,0.55)',
        glow: '0 0 0 6px rgba(132,204,69,0.18)',
        whatsapp: '0 10px 24px -6px rgba(37,211,102,0.6)',
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
