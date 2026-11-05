import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

// ============================================================
// DESIGN SYSTEM NEXCLEAN SARL — « Institution claire + Opérations » (DESIGN_AUDIT.md).
// Documentation, usages et ratios de contraste : docs/design-system.md.
// - Fonds clairs dominants ; surfaces fortes bleu nuit (`navy`).
// - Action : bleu `brand-600` (= `primary`), texte blanc.
// - Accent unique : lime du logo (`cta`, gamme `lime`), toujours avec un texte encre.
// - Piliers : rôles `pillar-*` (pictos, filets, fonds doux), une teinte par public.
// Les ratios cités sont calculés selon WCAG 2.x, texte sur fond.
// ============================================================

/** Bleu de marque (proche des polos des équipes). `600` = action. */
const brand = {
  50: '#EEF4FE',
  100: '#DBE7FC', // 14,58:1 sur navy
  200: '#B8CEF8', // 11,44:1 sur navy
  300: '#89ADF2', // 8,07:1 sur navy (texte sur fond sombre)
  400: '#5B8BEA', // 5,47:1 sur navy ; décoratif sur fond clair
  500: '#2E7CF6', // « signal » : décoratif uniquement sur fond clair (3,94:1)
  600: '#1F5FD1', // 5,81:1 sur blanc, blanc dessus idem
  700: '#1A4FB0', // 7,53:1 sur blanc
  800: '#173F8A',
  900: '#12355B', // blanc dessus : 12,46:1
  950: '#0A1626', // blanc dessus : 18,17:1
};

/** Lime du logo : accent unique. Jamais de texte blanc dessus. */
const lime = {
  50: '#F2FBEA',
  100: '#E2F6CF',
  200: '#C6ECA2',
  300: '#A3DE6E', // encre dessus : 11,45:1
  400: '#84CC45', // encre dessus : 9,26:1 ; 6,35:1 sur navy-light
  700: '#3D701C',
};

/** Neutres froids. Texte : ink-500 minimum. */
const ink = {
  50: '#F5F7FA',
  100: '#EDF1F5',
  200: '#DDE3EA',
  300: '#C3CDD8',
  400: '#8FA3BC', // décoratif uniquement (2,58:1)
  500: '#56677D', // 5,78:1 sur blanc, 5,39:1 sur ink-50
  600: '#4A5B70', // 6,95:1 sur blanc
  700: '#33435A', // 10,04:1 sur blanc
  800: '#1C2A3D',
  900: '#0A1626', // 18,17:1 sur blanc
};

const ocean = {
  50: '#EEF5FF',
  100: '#D9E8FF',
  300: '#8DB8FF',
  500: '#2F6FE4',
  600: '#1F55C4', // 6,66:1 sur blanc
  700: '#1B449C', // 8,92:1 sur blanc
};

// Vert feuille (pilier Espaces verts, états de succès).
const leaf = {
  50: '#ECF8F1',
  100: '#D2EFDF',
  300: '#7FD1A6',
  500: '#1F9D60',
  600: '#15804D', // 4,97:1 sur blanc
  700: '#0F6B40', // 6,57:1 sur blanc, 6,02:1 sur leaf-50
};

// Bleu-vert « eau » (pilier Propreté).
const teal = {
  50: '#E6F4F6',
  100: '#C5E6EB',
  700: '#0B7285', // 5,59:1 sur blanc, 4,96:1 sur teal-50
};

// Ambre (avertissements). `sun` reste utilisable seul.
const sun = {
  DEFAULT: '#FFB020',
  50: '#FFF7E6',
  100: '#FFEBC2',
  400: '#FFB020',
  700: '#8F5300', // 6,17:1 sur blanc
};

/** Couleurs de pilier : `DEFAULT` = texte/icône (AA sur blanc et sur `soft`). */
const pillar = {
  proprete: { DEFAULT: teal[700], soft: teal[50], border: teal[100] },
  recrutement: { DEFAULT: brand[600], soft: brand[50], border: brand[100] }, // 5,26:1 sur soft
  'espaces-verts': { DEFAULT: leaf[700], soft: leaf[50], border: leaf[100] },
  emploi: { DEFAULT: '#B54708', soft: '#FEF0E6', border: '#FAD7BD' }, // 5,43:1 / 4,86:1 sur soft
  boutique: { DEFAULT: ink[600], soft: ink[50], border: ink[200] },
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
        lime,
        ink,
        // Les classes `slate-*` existantes héritent des neutres de la marque.
        slate: ink,
        ocean,
        leaf,
        teal,
        sun,
        pillar,
        // ── Rôles sémantiques ──────────────────────────────────
        // Surface forte : bleu nuit. Blanc dessus = 18,17:1 (DEFAULT), 12,46:1 (light), 19,36:1 (deep).
        navy: { DEFAULT: brand[950], light: brand[900], deep: '#060E19' },
        primary: brand[600], // texte / liens / boutons sur fond clair : 5,81:1
        'primary-dark': brand[700], // 7,53:1
        'primary-light': brand[100],
        // Accent (lime du logo) : encre dessus = 9,26:1 (DEFAULT), 11,45:1 (hover). Jamais de texte blanc.
        cta: { DEFAULT: lime[400], hover: lime[300] },
        // Texte secondaire minimal : ink-500 = 5,78:1 sur blanc, 5,39:1 sur ink-50.
        // Ne jamais descendre à ink-400/slate-400 (2,58:1) pour du texte.
        muted: ink[500],
        // WhatsApp : `DEFAULT` pour l'icône ; `dark` (#075E54) pour une icône ou un texte sur fond clair : 7,67:1.
        whatsapp: { DEFAULT: '#25D366', hover: '#1FBE5B', ink: ink[900], dark: '#075E54' },
        // États : `DEFAULT` = texte/icône, AA sur blanc et sur `soft`.
        success: { DEFAULT: leaf[700], soft: leaf[50], border: leaf[100] }, // 6,57:1
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
        card: '0 1px 2px 0 rgba(10,22,38,0.04), 0 8px 24px -4px rgba(10,22,38,0.08)',
        'card-hover': '0 2px 4px 0 rgba(10,22,38,0.04), 0 24px 48px -12px rgba(31,95,209,0.18)',
        btn: '0 1px 2px 0 rgba(10,22,38,0.06)',
        whatsapp: '0 10px 24px -6px rgba(37,211,102,0.6)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-down': 'slideDown 0.3s ease-out forwards',
        blob: 'blob 18s ease-in-out infinite',
        sparkle: 'sparkle 2.4s ease-in-out infinite',
        'pulse-ring': 'pulseRing 2.2s cubic-bezier(0.22,1,0.36,1) infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideDown: { '0%': { opacity: '0', transform: 'translateY(-8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        blob: {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '33%': { transform: 'translate(30px,-40px) scale(1.08)' },
          '66%': { transform: 'translate(-25px,20px) scale(0.95)' },
        },
        sparkle: { '0%,100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' }, '50%': { transform: 'scale(0.75) rotate(45deg)', opacity: '0.7' } },
        pulseRing: { '0%': { boxShadow: '0 0 0 0 rgba(37,211,102,0.55)' }, '100%': { boxShadow: '0 0 0 14px rgba(37,211,102,0)' } },
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [typography],
};

export default config;
