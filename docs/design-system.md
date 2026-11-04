# Design system — site public NEXCLEAN

> Direction artistique « service de confiance » (`docs/decisions.md`, D-06). Sources de vérité : `tailwind.config.ts` (tokens), `app/globals.css` (variables CSS `--ds-*`, focus, mouvement réduit, utilitaires), `components/ui/` (composants).
> Tous les ratios sont calculés selon WCAG 2.x (luminance relative). Seuils : **4,5:1** pour le texte courant, **3:1** pour le gros texte (≥ 24 px, ou ≥ 18,66 px en gras) et les composants non textuels (anneau de focus, bordures porteuses de sens, icônes seules).

## 1. Couleurs

### 1.1 Rôles principaux

| Token Tailwind | Valeur | Usage | Couple mesuré | Ratio |
|---|---|---|---|---|
| `forest` (DEFAULT) | `#2C4B1A` (brand-900) | **Surface forte dominante** : hero sombre, Section `dark`, footer, bouton `secondary` | blanc sur forest | **9,87** |
| `forest-deep` | `#142A08` (brand-950) | Survol `secondary`, footer | blanc sur forest-deep | **15,39** |
| `forest-light` | `#33591B` (brand-800) | Variante de surface | blanc dessus | 8,12 |
| `cta` (DEFAULT) | `#84CC45` (brand-400) | **Accent** : bouton `primary`, puces | encre ink-900 sur cta | **9,04** |
| `cta-hover` | `#A3DE6E` (brand-300) | Survol `primary` | encre sur cta-hover | 11,17 |
| — | — | **Interdit** : texte blanc sur `cta` | blanc sur cta | 1,96 ✗ |
| `primary` | `#3D701C` (brand-700) | Liens, texte d'accent sur fond clair | sur blanc / sur brand-50 | **5,94** / 5,59 |
| `ink-900` (= `slate-900`) | `#131A12` | Texte principal | sur blanc / ink-50 | 17,73 / 16,75 |
| `ink-700` | `#364032` | Texte fort secondaire | sur blanc | 10,85 |
| `ink-600` | `#4B5746` | Paragraphes, intros | sur blanc | 7,63 |
| `muted` (= ink-500) | `#66735F` | **Gris minimal pour du texte** (légendes, notes, prix secondaires) | sur blanc / ink-50 / brand-50 | **5,02** / 4,74 / 4,73 |
| `ink-400` / `slate-400` | `#8F9B8B` | Bordures, icônes décoratives, placeholders **uniquement** | sur blanc | 2,90 ✗ texte |
| `ink-300` / `slate-300` | `#C2CCBE` | Bordures | sur blanc | 1,66 ✗ texte |
| `brand-100` | `#E2F6CF` | Texte secondaire **sur forest** | sur forest | 8,61 |
| `brand-300` | `#A3DE6E` | Accent, anneau de focus **sur forest** | sur forest / forest-deep | 6,22 / 9,70 |

`slate-*` reste un **alias** de `ink-*` (même couleur). Pour le nouveau code, écrire `ink-*`.

### 1.2 WhatsApp

| Token | Valeur | Usage | Ratio |
|---|---|---|---|
| `whatsapp` | `#25D366` | Fond du bouton WhatsApp (vert officiel, reconnaissable) | **encre sur whatsapp : 8,94** |
| `whatsapp-hover` | `#1FBE5B` | Survol | encre dessus : 7,24 |
| `whatsapp-ink` | `#131A12` | Texte et icône posés sur `whatsapp` | — |
| `whatsapp-dark` | `#075E54` | Texte vert WhatsApp sur blanc, ou fond avec texte blanc | blanc dessus : 7,67 |
| — | — | **Interdit** : texte blanc sur `#25D366` (ancien bouton) | 1,98 ✗ |

**Arbitrage D-06** : texte **encre** sur `#25D366` (8,94:1) plutôt que blanc sur `#128C7E`, qui ne donne que **4,14:1** (échec AA pour du texte de 14-16 px). On garde ainsi le vert le plus reconnaissable de WhatsApp. `whatsapp-dark` (`#075E54`) sert de solution de repli en texte blanc (7,67:1).

### 1.3 Piliers (pictos, filets, badges, fonds doux — jamais de grands aplats)

| Pilier | Classes | Texte/icône | sur blanc | sur `soft` |
|---|---|---|---|---|
| Propreté & hygiène | `text-pillar-proprete` · `bg-pillar-proprete-soft` · `border-pillar-proprete-border` | `#3D701C` (brand-700) / soft `#F2FBEA` | 5,94 | 5,59 |
| Recrutement & placement | `…-recrutement` | `#1F55C4` (ocean-600) / soft `#EEF5FF` | 6,66 | 6,07 |
| Espaces verts | `…-espaces-verts` | `#0F6B40` (leaf-700, vert feuille froid) / soft `#ECF8F1` | 6,57 | 6,02 |
| Emploi | `…-emploi` | `#1B449C` (ocean-700) / soft `#EEF5FF` | 8,92 | 8,13 |
| Boutique | `…-boutique` | `#8F5300` (sun-700, ambre) / soft `#FFF7E6` | 6,17 | 5,78 |

Recrutement et emploi partagent la famille `ocean` (D-06) ; l'emploi prend la nuance plus sombre. Les classes complètes sont centralisées dans `components/ui/pillars.ts` (`PILLARS[clé]`) : utilisez-les plutôt que de recomposer les noms (Tailwind ne détecte pas les classes construites dynamiquement).

Nouvelles palettes disponibles : `leaf-50…700` (vert feuille), `sun-50…700` (`bg-sun` reste valide), `ocean-50…700`.

### 1.4 États

| Token | Texte/icône | sur blanc | Fond doux `*-soft` | sur soft | Bordure `*-border` |
|---|---|---|---|---|---|
| `success` | `#3D701C` (brand-700) | **5,94** | `#F2FBEA` | 5,59 | `#C6ECA2` |
| `danger` | `#B42318` | **6,57** | `#FEF3F2` | 6,05 | `#FECDCA` |
| `warning` | `#8F5300` | **6,17** | `#FFF7E6` | 5,78 | `#FFDB99` |
| `info` | `#1B449C` | **8,92** | `#EEF5FF` | 8,13 | `#D9E8FF` |
| `accent` | `#B54708` (orange lisible ; blanc dessus 5,43) | **5,43** | `#FEF0E6` | 4,86 | — |
| `accent-bright` | `#F08A24` | 2,51 ✗ | décoratif uniquement | | |

Changements rétrocompatibles : `success` valait brand-500 (2,61:1, échec) et vaut maintenant brand-700 ; `accent` valait `#F08A24` (2,51:1) et vaut maintenant `#B54708`. Toutes les classes `text-success`, `text-accent`, `bg-accent` existantes deviennent conformes sans modification.

### 1.5 Variables CSS

`app/globals.css` expose les tokens clés en `--ds-*` (générés depuis la config via `theme()`, une seule source) : `--ds-forest`, `--ds-cta`, `--ds-text-muted`, `--ds-whatsapp`, `--ds-success|danger|warning|info`, `--ds-pillar-*`, `--ds-container`, `--ds-section-y`, `--ds-tap`, `--ds-focus-ring`, `--ds-focus-offset`. À utiliser dans du CSS ou des styles inline (OG image, SVG), jamais de hex recopié.

## 2. Typographie

Polices locales (aucune requête externe) : **Outfit** (`font-display`, titres) et **Plus Jakarta Sans** (`font-sans`, texte). Les `h1-h4` reçoivent déjà `font-display tracking-tight` (globals.css).

Échelle **unique et fluide** (`clamp()`) : pas de préfixes `sm:`/`lg:` nécessaires.

| Classe | Mobile → bureau | Interligne | Graisse | Usage |
|---|---|---|---|---|
| `text-display` | 40 → 72 px | 1,02 | 800 | Titre de l'accueil uniquement |
| `text-h1` | 36 → 60 px | 1,05 | 800 | Titre de page (PageHero) |
| `text-h2` | 30 → 48 px | 1,1 | 700 | Titre de section (SectionHeader) |
| `text-h3` | 20 → 24 px | 1,25 | 700 | Titre de carte, sous-section |
| `text-lead` | 17 → 20 px | 1,6 | — | Intro de section, sous-titre de hero |
| `text-body` | 16 px | 1,65 | — | Texte courant |
| `text-small` | 14 px | 1,5 | — | Légendes, descriptions de carte |
| `text-eyebrow` | 12 px, +0,14em | 1rem | 700 | Surtitre (avec `uppercase`), utilisé par SectionLabel |

Les tailles `5xl-7xl` redéfinies et les tailles arbitraires (`text-[2.6rem]`, `text-[4.1rem]`, `text-[5.5rem]`, `text-[15px]`, `text-[11px]`) sont à remplacer par cette échelle.

## 3. Espacements, grille, formes

- **Conteneur unique** : `max-w-container` = **72rem** (1152 px), gouttières `px-4 sm:px-6 lg:px-8` → composant `<Container>` ou classe `.container-site`. Header, footer, menu mobile et sections partagent ces bords.
- **Variante étroite** : `max-w-container-narrow` = **48rem** (768 px) → `<Container variant="narrow">` ou `.container-narrow` (formulaires, FAQ, pages légales, suivi, profil, Coque candidat).
- **Rythme vertical** : `py-section` = clamp(64 → 112 px) par défaut ; `py-section-sm` = clamp(40 → 64 px) pour les bandeaux. Pas d'autre `py-*` de section. Ne pas ajouter de `pt-24` sous le header : `<main>` porte déjà `pt-20`.
- **Grilles** : `grid gap-6 sm:grid-cols-2 lg:grid-cols-3` (cartes) ; `gap-6` (24 px) par défaut, `gap-8` pour les grilles de grandes cartes.
- **Rayons** : `rounded-card` (24 px) pour toutes les cartes, `rounded-full` pour boutons/badges, `rounded-2xl` pour pastilles et champs, `rounded-4xl` (32 px) pour les grands panneaux. Plus de `rounded-[2rem]`.
- **Ombres** : `shadow-card`, `shadow-card-hover`, `shadow-btn`, `shadow-btn-hover`, `shadow-whatsapp`, `shadow-glow`. Plus d'ombres arbitraires `shadow-[…]`.
- **Cible tactile** : `min-h-tap min-w-tap` (44 px) ou `.tap-target`. Tous les `Button` respectent ce minimum (`sm` = 44 px, `md` = 48 px, `lg` = 56 px).

## 4. Accessibilité globale (globals.css)

- **Focus** : `:focus-visible` homogène = liseré 2 px couleur de fond + anneau 2 px `--ds-focus-ring`. Sur fond clair : brand-700 (**5,94:1** contre blanc). Dans `.surface-dark` (Section `dark`, PageHero `dark`) : brand-300 (**6,22:1** contre forest). Un `outline` transparent reste pour le mode Contraste élevé de Windows. Ne pas écrire `focus-visible:ring-*` dans les composants.
- `.focus-ring` : réapplique l'anneau aux champs qui font `outline-none focus:ring-…` (ex. `inputClass`).
- **Mouvement réduit** : avec `prefers-reduced-motion: reduce`, toutes les classes `animate-*` (marquee, blob, float, float-slow, sparkle, pulse-ring, slide-*, fade-in) sont coupées (`animation: none`), transitions ramenées à 0,01 ms, défilement doux désactivé. `Reveal`/`Stagger` n'animent plus que l'opacité, sans durée ni délai. Les déplacements au survol des composants sont en `motion-safe:`.
- **Lien d'évitement** : classe `.skip-link` (hors écran jusqu'au focus, 44 px de haut).

## 5. Composants (`components/ui/`)

Tous typés, sans dépendance nouvelle. Icônes : `lucide-react`, passées en prop (`icon={Users}`), jamais par nom de chaîne.

### Container
```tsx
import Container from '@/components/ui/Container';
<Container>…</Container>                       // 72rem
<Container variant="narrow" as="article">…</Container> // 48rem
```
Props : `variant?: 'default' | 'narrow'`, `as?: 'div'|'section'|'header'|'footer'|'nav'|'main'|'article'`, `className?`, `id?`. Export `containerClasses`.

### Section
```tsx
import Section from '@/components/ui/Section';
<Section id="piliers" labelledBy="piliers-titre" tone="muted">
  <SectionHeader id="piliers-titre" eyebrow="Nos métiers" title="Trois façons de vous aider" />
  …
</Section>
```
Props : `tone?: 'default'|'muted'|'dark'|'brand'` (blanc · ink-50 · forest + texte blanc + focus lime · brand-50), `id?`, `labelledBy?` (→ `aria-labelledby`), `spacing?: 'default'|'sm'|'none'`, `container?: 'default'|'narrow'|false`, `as?: 'section'|'div'|'aside'`, `className?`.

### SectionHeader (+ SectionLabel)
```tsx
<SectionHeader
  eyebrow="Recrutement"
  title="Du personnel fiable, sélectionné pour vous"
  intro="Décrivez votre besoin, nous proposons des profils vérifiés."
  as="h2" align="center" pillar="recrutement"
  actions={<Button href="/recrutement/demander-du-personnel">Demander du personnel</Button>}
/>
```
Props : `title`, `eyebrow?`, `intro?`, `as?: 'h1'|'h2'|'h3'` (h2 par défaut), `align?: 'left'|'center'`, `id?`, `tone?: 'light'|'dark'`, `pillar?`, `actions?`, `className?`.
`SectionLabel` : `tone?: 'light'|'dark'`, `pillar?`, `sparkle?: boolean` (**false par défaut**, réservé Propreté).

### Button
```tsx
<Button href="/contact">Demander un devis</Button>                         // primary
<Button href="/candidat/connexion" variant="outline">Je me connecte</Button>
<Button href={getWhatsAppLink()} variant="whatsapp" whatsappIcon>WhatsApp</Button>
<Button type="submit" loading={envoi} loadingLabel="Envoi en cours…">Envoyer ma demande</Button>
<Button href={TEL_LINK} variant="inverse" icon={Phone}>Appeler</Button>    // sur fond sombre
```
Props : `variant?: 'primary'|'secondary'|'outline'|'ghost'|'whatsapp'|'inverse'` (+ anciens `dark`, `outline-light`), `size?: 'sm'|'md'|'lg'`, `icon?: LucideIcon`, `iconPosition?: 'left'|'right'`, `href?`, `onClick?`, `type?`, `disabled?`, `loading?`, `loadingLabel?`, `whatsappIcon?`, `fullWidth?`, `aria-label?`, `id?`, `name?`, `value?`, `form?`, `className?`.
Rendu : `href` commençant par `/` → `next/link` ; `http…` → `<a target="_blank" rel="noopener noreferrer">` ; `#…`, `tel:`, `mailto:` → `<a>` ; sinon `<button>`. Lien désactivé/en chargement → `aria-disabled`, retiré de la tabulation. Export `buttonClasses({variant,size,fullWidth,className})` pour styler un élément qui ne peut pas être un `Button`.

| Variante | Rendu | Contraste |
|---|---|---|
| `primary` | lime `cta` + encre | 9,04 |
| `secondary` | `forest` + blanc | 9,87 |
| `outline` | blanc, bordure ink-300, texte forest | 9,87 |
| `ghost` | texte primary | 5,94 |
| `whatsapp` | `#25D366` + encre | 8,94 |
| `inverse` | transparent, bordure blanc/60, texte blanc (fonds sombres) | 9,87 sur forest |

États : `hover` (teinte + élévation `motion-safe`), `active` (teinte plus marquée + `scale-0.97` `motion-safe`), `focus-visible` (anneau global), `disabled` (50 % d'opacité, curseur interdit), `loading` (spinner `Loader2`, `aria-busy`, texte `sr-only`).

### Card
```tsx
<Card>…</Card>
<Card variant="interactive" href="/realisations">…</Card>
<Card variant="pillar" pillar="espaces-verts" as="article">…</Card>
```
Props : `variant?: 'default'|'interactive'|'pillar'`, `pillar?: PillarKey`, `href?` (carte entière en lien, focus visible), `aria-label?`, `padding?: 'sm'|'md'|'lg'`, `as?: 'div'|'article'|'li'`, `className?`. Export `cardClasses()`.

### PillarCard / PillarBadge / IconBadge
```tsx
import { Sparkles, Users, Trees } from 'lucide-react';
<PillarCard pillar="proprete" icon={Sparkles} title="Propreté & hygiène"
  description="Maison, bureaux, fin de chantier…" href="/services" ctaLabel="Voir les services" />
<PillarBadge pillar="recrutement" icon={Users} />          // libellé par défaut
<PillarBadge pillar="espaces-verts" size="md">Jardin</PillarBadge>
<IconBadge icon={Trees} tone="espaces-verts" size="lg" />
<IconBadge icon={AlertTriangle} tone="warning" label="Attention" />
```
- `PillarCard` : `pillar`, `icon: LucideIcon`, `title`, `description?`, `href?`, `ctaLabel?` (« Découvrir »), `headingAs?: 'h2'|'h3'|'h4'`, `children?`, `as?`, `className?`.
- `PillarBadge` : `pillar`, `icon?`, `children?`, `size?: 'sm'|'md'`, `className?`.
- `IconBadge` : `icon`, `tone?: PillarKey|'brand'|'neutral'|'dark'|'cta'|'success'|'danger'|'warning'|'info'`, `size?: 'sm'|'md'|'lg'`, `shape?: 'rounded'|'circle'`, `label?` (sinon décoratif), `className?`.

### PageHero
```tsx
<PageHero label="Espaces verts" pillar="espaces-verts" title="…" subtitle="…"
  breadcrumb={[{ name: 'Espaces verts' }]}>
  <Button href="#devis-espaces-verts" size="lg">Demander un devis</Button>
</PageHero>
<PageHero tone="dark" title="…" breadcrumb={[…]}>…</PageHero>
<PageHero decor … />   // PAGE PROPRETÉ UNIQUEMENT
```
Props existantes inchangées (`label?`, `title`, `subtitle?`, `breadcrumb`, `children?`) + `tone?: 'light'|'dark'`, `pillar?`, `decor?: boolean` (false). Le blob animé n'est plus affiché par défaut (D-06). En `tone="dark"`, utiliser les boutons `primary`, `whatsapp` ou `inverse`.
`Breadcrumb` gagne `tone?` et `className?` ; son texte passe de slate-400 (2,90) à `muted` (5,02).

### Reveal / Stagger / StaggerItem
API inchangée (`delay?`, `from?: 'up'|'left'|'right'|'scale'`, `as?`). Respecte `prefers-reduced-motion` par lui-même (`useReducedMotion`), même hors de `MotionProvider`.

### Décor Propreté (`Decor.tsx`)
```tsx
<section className="relative overflow-hidden">
  <PropreteDecor variant="both" tone="dark" />
  …
</section>
```
`PropreteDecor` : `variant?: 'blobs'|'sparkles'|'both'`, `tone?: 'light'|'dark'`, `className?` ; `SparkleGlyph` (étincelle seule). **Réservé à la page Propreté** (D-06) : interdit sur l'accueil, recrutement, emploi, espaces verts, boutique.

### Autres
`WhatsAppButton` (FAB) et `MobileCTABar` passent au token `whatsapp` avec texte encre. `ServiceCard`, `TestimonialCard`, `RealisationCard` : `slate-400` → `muted`.

## 6. Règles d'usage

1. **Icônes : `lucide-react` uniquement**, importées nommément (`import { Users } from 'lucide-react'`). Pas de `import * as LucideIcons`, pas de `react-icons` (retiré). Seules exceptions SVG : `WhatsAppIcon`, logos de réseaux sociaux, logo de marque.
2. **Aucun hex en dur dans les pages et composants** (`#25D366`, `#1FBE5B`, `#84CC45`…) : utiliser les tokens ou `var(--ds-*)`.
3. **Pas de couleurs Tailwind par défaut** (`red-*`, `green-*`, `amber-*`, `blue-*`, `emerald-*`…) : utiliser `danger`, `success`, `warning`, `info`, `pillar-*`, `leaf-*`, `sun-*`, `ocean-*`.
4. **Texte gris : `muted` (ink-500) minimum.** `ink-400`/`slate-400` et plus clair : bordures et décor uniquement.
5. **Lime = accent** : jamais de grand aplat lime, jamais de texte blanc sur lime. Les surfaces fortes sont en `forest`.
6. **Une action principale par bloc** (`primary` ou `whatsapp`), les autres en `outline`/`ghost` (ou `inverse` sur fond sombre).
7. **Couleurs de pilier** limitées aux pictos, filets, badges et fonds doux.
8. **Pas de boutons stylés à la main** : `Button` ou `buttonClasses()`.

## 7. Migration « ancien pattern → nouveau »

| Ancien | Nouveau |
|---|---|
| `variant="dark"` | `variant="secondary"` (alias conservé) |
| `variant="outline-light"` | `variant="inverse"` (alias conservé) |
| `variant="secondary"` au sens « bouton blanc bordé » | `variant="outline"` (⚠ `secondary` est désormais **vert profond plein**) |
| `bg-[#25D366] text-white` / `hover:bg-[#1FBE5B]` (Button, ContactSection ×4, Footer L71, WhatsAppForm L162, FormulairePersonnel ×3, FormulaireCandidat, ProductOrder) | `<Button variant="whatsapp">` ou `bg-whatsapp text-whatsapp-ink hover:bg-whatsapp-hover` |
| `text-[#25D366]` (texte sur blanc) | `text-whatsapp-dark` |
| `shadow-[0_10px_24px_-6px_rgba(37,211,102,0.6)]` | `shadow-whatsapp` |
| `#84CC45` (`PricingSection.tsx:58`) | `cta` / `brand-400` |
| Pseudo-boutons à la main : `MobileCTABar.tsx:20,28` (fait, tokens), `ProductCard.tsx:38` (pastille dans un lien : garder un `span`, mais `buttonClasses({size:'sm'})`), `BlogClient.tsx:109`, `ProductOrder.tsx:101`, `WhatsAppForm.tsx:162`, `suivi/[jeton]/page.tsx:36,93`, `profil/[jeton]/page.tsx:29,48`, `FormulaireConnexion.tsx:67`, `Postuler.tsx:152,178,239`, `FormulairePersonnel.tsx:226,512,582`, `FormulaireCandidat.tsx:335,352`, `Elements.tsx:33`, `Propositions.tsx:87`, `mot-de-passe-oublie/page.tsx:67` | `<Button>` (états `loading`/`disabled` inclus) ; à défaut `className={buttonClasses({ variant, size })}`. Garder les libellés testés (D-09) |
| Survol `hover:bg-primary-dark` avec texte encre (`BlogClient.tsx:109`, 2,18:1) | `variant="secondary"` (blanc sur forest) |
| Hauteurs `h-12`, `min-h-11`, `min-h-12`, `h-14` sur boutons | `size="sm"` (44) / `"md"` (48) / `"lg"` (56) |
| `max-w-6xl mx-auto px-4 sm:px-6 lg:px-8` (×34), `max-w-7xl` (Header, Blog), `max-w-5xl` (fiche offre), `max-w-4xl` (Coverage) | `<Container>` / `.container-site` (72rem) |
| `max-w-3xl` (FAQ, formulaires, légal), `max-w-2xl` (demander-du-personnel, Coque large, Postuler), `max-w-lg` (suivi, profil), `max-w-md` (Coque) | `<Container variant="narrow">` (48rem) ; un formulaire plus étroit garde un `max-w-md` **interne** au conteneur étroit |
| `py-20 sm:py-28`, `py-20 sm:py-24`, `py-16 sm:py-20`, `py-14`, `py-12`, `py-10` | `<Section>` (`py-section`) ou `spacing="sm"` (`py-section-sm`) |
| `pt-24 sm:pt-28` en plus du `pt-20` de `<main>` (Coque, demander-du-personnel) | supprimer ; `<Section spacing="sm">` |
| Titres `text-3xl sm:text-5xl` / `text-3xl sm:text-4xl` / `text-2xl sm:text-3xl` + surtitre maison `text-xs uppercase` | `<SectionHeader>` (`text-h2` + `SectionLabel`) |
| h1 `text-2xl font-semibold` (`/suivi`, `/profil`), `text-4xl sm:text-5xl lg:text-6xl` | `text-h1` (ou `text-h2` pour les pages outils) |
| `text-[2.6rem]`, `text-[4.1rem]`, `text-[5.5rem]`, `text-[15px]`, `text-[11px]` | `text-display`, `text-h1`, `text-h2`, `text-body`, `text-eyebrow`/`text-xs` |
| Cartes `rounded-3xl p-7 shadow-card`, `rounded-2xl p-5/p-6`, `rounded-[2rem] p-7 sm:p-10`, `rounded-xl` | `<Card>` (`rounded-card`, `padding="sm|md|lg"`) |
| `text-slate-400` / `text-ink-400` sur texte (19 occ.), `text-slate-300` (« ÉTAPE n ») | `text-muted` (ou `text-ink-600`) |
| `text-success` sur prix/« Disponible » (2,61:1) | inchangé : `success` vaut maintenant brand-700 (5,94) |
| `text-accent` (astérisques « * ») | inchangé : `accent` vaut maintenant `#B54708` (5,43) |
| `bg-green-50 text-green-700` (espaces verts, badges offre, Coverage) | `PillarBadge pillar="espaces-verts"` ou `bg-pillar-espaces-verts-soft text-pillar-espaces-verts` ; état « succès » → `bg-success-soft text-success` |
| `red-*` (×55) | `text-danger`, `bg-danger-soft`, `border-danger-border` |
| `amber-*` (×18) | `text-warning`, `bg-warning-soft`, `border-warning-border` ; étoiles d'avis : `text-sun` |
| `blue-*` (×2) | `text-info`, `bg-info-soft` |
| `focus:outline-none focus:ring-primary/10` (`inputClass`, `WhatsAppForm.tsx:31`) | ajouter `focus-ring` (anneau global) et garder `focus:border-primary` |
| `focus-visible:ring-*` dans un composant | rien : anneau global `:focus-visible` |
| `animate-blob`, `animate-sparkle`, `bg-dots` hors Propreté (Hero, CTASection, ProductsSection, PageHero) | supprimer ; sur la page Propreté seulement : `<PropreteDecor>` / `PageHero decor` / `SectionLabel sparkle` |
| `import * as LucideIcons` + nom en chaîne (`ServiceCard`, `WhyUsSection`) | import nommé, icône passée en prop (`icon={Sparkles}`) |
| Lien d'évitement `sr-only focus:not-sr-only focus:fixed …` | `className="skip-link"` |
| `.fade-up`, `.delay-*`, `.gradient-text`, `lib/useScrollAnimation.ts` (morts) | `Reveal` / `Stagger` |
