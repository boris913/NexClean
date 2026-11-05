# Design system — site public NEXCLEAN

> Direction artistique « Institution claire + Opérations » (`DESIGN_AUDIT.md`, novembre 2026), qui remplace « service de confiance » (D-06) pour les couleurs, la typographie et les formes. Sources de vérité : `tailwind.config.ts` (tokens), `app/globals.css` (variables CSS `--ds-*`, focus, mouvement, utilitaires), `components/ui/` (composants).
> Tous les ratios sont calculés selon WCAG 2.x (luminance relative). Seuils : **4,5:1** pour le texte courant, **3:1** pour le gros texte (≥ 24 px, ou ≥ 18,66 px en gras) et les composants non textuels (anneau de focus, bordures porteuses de sens, icônes seules).

## 1. Couleurs

Principe : **fonds clairs dominants**, **une seule section bleu nuit** par page au plus (hors pied de page et bloc d'appel final), **bleu d'action** pour les boutons et liens, **lime du logo comme accent unique** (puces actives, numéros sur fond nuit, bouton principal sur fond nuit). Le logo n'est pas modifié.

### 1.1 Rôles principaux

| Token Tailwind | Valeur | Usage | Couple mesuré | Ratio |
|---|---|---|---|---|
| `navy` (DEFAULT) | `#0A1626` (brand-950) | **Surface forte** : Section `dark`, CTA final, carte tarif | blanc sur navy | **18,17** |
| `navy-light` | `#12355B` (brand-900) | Surface secondaire, survol `secondary` | blanc dessus | 12,46 |
| `navy-deep` | `#060E19` | Pied de page | blanc dessus | 19,36 |
| `primary` | `#1F5FD1` (brand-600) | **Action** : bouton `primary` sur fond clair, liens, numéros d'étape | sur blanc / blanc dessus / sur brand-50 | **5,81** / 5,81 / 5,26 |
| `primary-dark` | `#1A4FB0` (brand-700) | Survol, anneau de focus | sur blanc | 7,53 |
| `brand-500` | `#2E7CF6` | « Signal » : **décor uniquement** sur fond clair | sur blanc | 3,94 ✗ texte |
| `brand-300` | `#89ADF2` | Texte, surtitres sur fond nuit | sur navy | 8,07 |
| `brand-100` | `#DBE7FC` | Texte secondaire sur fond nuit | sur navy | 14,58 |
| `cta` (DEFAULT) | `#84CC45` (lime-400) | **Accent unique** : puce « en cours », numéros sur fond nuit, bouton `primary` dans `.surface-dark` | encre sur cta | **9,26** |
| `cta-hover` | `#A3DE6E` (lime-300) | Survol, anneau de focus sur fond nuit | encre dessus | 11,45 |
| — | — | **Interdit** : texte blanc sur `cta`, grand aplat lime | | ✗ |
| `ink-900` (= `slate-900`) | `#0A1626` | Texte principal | sur blanc / ink-50 | 18,17 / 16,93 |
| `ink-700` | `#33435A` | Texte fort secondaire | sur blanc | 10,04 |
| `ink-600` | `#4A5B70` | Paragraphes, intros | sur blanc / ink-50 | 6,95 / 6,48 |
| `muted` (= ink-500) | `#56677D` | **Gris minimal pour du texte** | sur blanc / ink-50 | **5,78** / 5,39 |
| `ink-400` | `#8FA3BC` | Bordures, icônes décoratives **uniquement** | sur blanc | 2,58 ✗ texte |
| `ink-200` | `#DDE3EA` | Filets, bordures de carte | | décoratif |
| `ink-50` | `#F5F7FA` | Fond des sections `muted` et des en-têtes de page | | |

`brand-*` est désormais une **gamme bleue** (50 → 950) et `lime-*` porte le vert du logo. `slate-*` reste un alias de `ink-*`.

### 1.2 WhatsApp

| Token | Valeur | Usage | Ratio |
|---|---|---|---|
| `whatsapp` | `#25D366` | Bouton flottant, boutons WhatsApp du Back-Office (texte encre) | encre dessus : 9,16 |
| `whatsapp-dark` | `#075E54` | Icône WhatsApp dans un bouton clair, texte vert sur blanc | sur blanc : 7,67 |
| — | — | **Interdit** : texte blanc sur `#25D366` | 1,98 ✗ |

WhatsApp est un **canal**, pas une couleur d'action : quand c'est l'action principale d'un bloc, `Button` `primary` + `whatsappIcon` ; sinon variante `whatsapp` (fond blanc, icône `whatsapp-dark`), ou `inverse` + `whatsappIcon` sur fond nuit.

### 1.3 Piliers (pictos, filets, badges, fonds doux — jamais de grands aplats)

| Pilier | Texte/icône | Fond doux | sur blanc | sur `soft` |
|---|---|---|---|---|
| Propreté & hygiène | `#0B7285` (teal-700, « eau ») | `#E6F4F6` | 5,59 | 4,96 |
| Recrutement & placement | `#1F5FD1` (brand-600) | `#EEF4FE` | 5,81 | 5,26 |
| Espaces verts | `#0F6B40` (leaf-700) | `#ECF8F1` | 6,57 | 6,02 |
| Emploi | `#B54708` (orange, plus chaleureux pour les candidats) | `#FEF0E6` | 5,43 | 4,86 |
| Boutique | `#4A5B70` (ink-600, neutre) | `#F5F7FA` | 6,95 | 6,48 |

Chaque public a une teinte distincte (recrutement et emploi ne sont plus deux bleus voisins). Classes complètes centralisées dans `components/ui/pillars.ts` (`PILLARS[clé]`).

### 1.4 États

| Token | Texte/icône | sur blanc | Fond doux `*-soft` | sur soft | Bordure `*-border` |
|---|---|---|---|---|---|
| `success` | `#0F6B40` (leaf-700) | **6,57** | `#ECF8F1` | 6,02 | `#D2EFDF` |
| `danger` | `#B42318` | **6,57** | `#FEF3F2` | 6,05 | `#FECDCA` |
| `warning` | `#8F5300` | **6,17** | `#FFF7E6` | 5,78 | `#FFDB99` |
| `info` | `#1B449C` | **8,92** | `#EEF5FF` | 8,13 | `#D9E8FF` |
| `accent` | `#B54708` | **5,43** | `#FEF0E6` | 4,86 | — |

Le vert est réservé au **succès** et au pilier Espaces verts : ce n'est plus une couleur de marque.

### 1.5 Variables CSS

`app/globals.css` expose les tokens clés en `--ds-*` (via `theme()`, une seule source) : `--ds-navy`, `--ds-navy-deep`, `--ds-cta`, `--ds-text-muted`, `--ds-whatsapp`, `--ds-success|danger|warning|info`, `--ds-pillar-*`, `--ds-container`, `--ds-section-y`, `--ds-tap`, `--ds-focus-ring`, `--ds-focus-offset`, et pour le bouton principal `--ds-btn-bg`, `--ds-btn-bg-hover`, `--ds-btn-fg` (bleu + blanc sur fond clair, lime + encre dans `.surface-dark`). Les e-mails, les PDF (`lib/documents/mise-en-page.ts`) et l'image de partage (`lib/og-image.tsx`) reprennent les mêmes valeurs.

## 2. Typographie

Polices locales (licence OFL, `app/fonts/`) : **IBM Plex Sans** variable (`font-sans` et `font-display`, même famille) et **IBM Plex Mono** 500 (`font-mono`) pour les surtitres, chiffres, montants en FCFA, numéros de dossier et d'étape. Le gras de Plex Mono n'est pas synthétisé (`font-synthesis-weight: none`).

| Classe | Mobile → bureau | Interligne | Interlettrage | Graisse | Usage |
|---|---|---|---|---|---|
| `text-display` | 40 → 68 px | 1,08 | −0,02 em | 600 | Titre de l'accueil uniquement |
| `text-h1` | 36 → 56 px | 1,1 | −0,02 em | 600 | Titre de page (PageHero) |
| `text-h2` | 28 → 40 px | 1,15 | −0,015 em | 600 | Titre de section |
| `text-h3` | 20 → 24 px | 1,3 | −0,01 em | 600 | Titre d'élément de liste, de carte |
| `text-lead` | 17 → 20 px | 1,6 | | | Intro de section |
| `text-body` | 16 px | 1,65 | | | Texte courant |
| `text-small` | 14 px | 1,5 | | | Légendes, descriptions |
| `text-eyebrow` | 12 px | 1rem | 0,08 em | 500 | Surtitre : `font-mono uppercase` (SectionLabel) |
| `text-figure` | 32 → 48 px | 1 | −0,02 em | 500 | Chiffre clé, montant : `font-mono tabular-nums` |

## 3. Espacements, grille, formes

- **Conteneur unique** : `max-w-container` = 72rem ; variante étroite 48rem. Gouttières `px-4 sm:px-6 lg:px-8`.
- **Rythme vertical** : `py-section` (64 → 112 px), `py-section-sm` (40 → 64 px).
- **Alignement** : titres et contenus **à gauche** partout. Pour une section dense (FAQ, zones), grille deux colonnes `lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]` : en-tête à gauche, contenu à droite.
- **Listes plutôt que cartes** : une suite d'éléments de même nature (étapes, piliers, méthode, avantages) se présente en **liste à filets** (`divide-y divide-ink-200 border-y`) avec numéros mono (`01`, `02`…), pas en grille de cartes identiques. Les cartes restent pour les objets autonomes (offre d'emploi, formule, réalisation, simulateur).
- **Rayons** : `rounded-card` = **12 px** (cartes, photos), `rounded-4xl` = **16 px** (grands panneaux), boutons et champs `rounded-lg` (8 px). `rounded-full` réservé aux puces d'état.
- **Ombres** : `shadow-card`, `shadow-card-hover` (teinte bleue), `shadow-btn`, `shadow-whatsapp` (bouton flottant).
- **Cible tactile** : `min-h-tap min-w-tap` (44 px) ou `.tap-target`.

## 4. Accessibilité et mouvement (globals.css)

- **Focus** : `:focus-visible` homogène = liseré 2 px couleur de fond + anneau 2 px `--ds-focus-ring`. Fond clair : brand-700 (**7,53:1**). `.surface-dark` : lime-300 (11,45:1 sur navy). Ne pas écrire `focus-visible:ring-*` dans les composants.
- `.focus-ring` : réapplique l'anneau aux champs qui retirent l'outline.
- **Apparitions au défilement** (`Reveal`, `Stagger`/`StaggerItem`) : en CSS (`[data-reveal]`), **contenu visible par défaut** (sans JS, robots, aperçus) ; seuls les blocs hors écran au chargement sont masqués puis révélés une fois. framer-motion n'est plus utilisé.
- **Mouvement réduit** : aucune apparition animée, `animate-*` coupées, transitions à 0,01 ms, défilement doux désactivé.
- **Lien d'évitement** : `.skip-link`.

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
Props : `tone?: 'default'|'muted'|'dark'|'brand'` (blanc · ink-50 · navy + texte blanc + focus et bouton principal lime · brand-50), `id?`, `labelledBy?` (→ `aria-labelledby`), `spacing?: 'default'|'sm'|'none'`, `container?: 'default'|'narrow'|false`, `as?: 'section'|'div'|'aside'`, `className?`.

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
| `primary` | fond clair : bleu `primary` + blanc · `.surface-dark` : lime `cta` + encre | 5,81 · 9,26 |
| `secondary` | `navy` + blanc | 18,17 |
| `outline` | blanc, bordure ink-300, texte navy | 18,17 |
| `ghost` | texte primary | 5,81 |
| `whatsapp` | canal secondaire : blanc, bordure ink-200, icône `whatsapp-dark` | 18,17 (texte) |
| `inverse` | transparent, bordure blanc/60, texte blanc (fonds sombres) | 18,17 sur navy |

Boutons en `rounded-lg`. **Un seul bouton plein par bloc.**

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
Props existantes inchangées (`label?`, `title`, `subtitle?`, `breadcrumb`, `children?`) + `tone?: 'light'|'dark'`, `pillar?`, `decor?: boolean` (false), `illustration?: NomIllustration` (fond clair). Fond clair : `ink-50` + filet bas. Le blob animé n'est plus affiché par défaut (D-06). En `tone="dark"`, utiliser les boutons `primary`, `whatsapp` ou `inverse`.
`Breadcrumb` gagne `tone?` et `className?` ; son texte passe de slate-400 (2,90) à `muted` (5,02).

### Reveal / Stagger / StaggerItem
API inchangée (`delay?`, `from?: 'up'|'left'|'right'|'scale'`, `as?`). Implémentation CSS + IntersectionObserver (voir §4) ; `MotionProvider` supprimé.

### PhotoTraitee
```tsx
<PhotoTraitee src="/images/team/equipe-nexclean.jpg" alt="L'équipe NEXCLEAN" traitement="douce"
  cadrage="object-top" sizes="(min-width: 1024px) 480px, 100vw" className="h-64" />
<PhotoTraitee src="…" alt="…" legende="Sur le terrain" sizes="33vw" className="aspect-[3/4]" />
```
Cadre, rayon et traitement homogènes pour les photos existantes : `traitement?: 'duotone'|'douce'` (duotone = niveaux de gris + teinte bleue ; douce = couleurs conservées, dégradé bleu nuit en bas), `legende?` (mono), `cadrage?`, `priority?`. Portraits et équipes en `douce`, matériel et photos de qualité inégale en `duotone`. Les avant/après restent en couleurs naturelles (preuve).

### Illustration
```tsx
<Illustration nom="immeuble" className="w-64" />
<PageHero illustration="maison" … />
```
`nom: 'maison'|'immeuble'|'equipe'|'candidat'|'jardin'|'proprete'` (`components/illustrations/Illustrations.tsx`). Trait `currentColor` (navy), aplats brand-50, **un point lime**. Décoratives (`aria-hidden`). `PageHero` les affiche à droite à partir de `md`.

### SimulateurEstimation
`<SimulateurEstimation commission={commission} />` (premier écran de l'accueil) : poste × personnes × commission en vigueur (`lib/commission-publique.ts`, en cache, revalidée par l'action Back-Office `enregistrerCommission`). Le bouton ouvre `/recrutement/demander-du-personnel?poste=…&personnes=…`, que le formulaire utilise pour préremplir la première ligne si elle est vierge. Toujours présenté comme **estimation indicative** (CONTEXT.md).

### Décor Propreté (`Decor.tsx`)
```tsx
<section className="relative overflow-hidden">
  <PropreteDecor variant="both" tone="dark" />
  …
</section>
```
`PropreteDecor` : `variant?: 'blobs'|'sparkles'|'both'`, `tone?: 'light'|'dark'`, `className?` ; `SparkleGlyph` (étincelle seule). **Réservé à la page Propreté** (D-06) : interdit sur l'accueil, recrutement, emploi, espaces verts, boutique.

### Autres
`WhatsAppButton` (FAB) garde le vert WhatsApp ; `MobileCTABar` utilise la variante `whatsapp` (canal secondaire). `ServiceCard`, `TestimonialCard`, `RealisationCard` : `slate-400` → `muted`.

## 6. Règles d'usage

1. **Icônes : `lucide-react` uniquement**, importées nommément (`import { Users } from 'lucide-react'`). Pas de `import * as LucideIcons`, pas de `react-icons` (retiré). Seules exceptions SVG : `WhatsAppIcon`, logos de réseaux sociaux, logo de marque.
2. **Aucun hex en dur dans les pages et composants** (`#25D366`, `#1FBE5B`, `#84CC45`…) : utiliser les tokens ou `var(--ds-*)`.
3. **Pas de couleurs Tailwind par défaut** (`red-*`, `green-*`, `amber-*`, `blue-*`, `emerald-*`…) : utiliser `danger`, `success`, `warning`, `info`, `pillar-*`, `leaf-*`, `sun-*`, `ocean-*`.
4. **Texte gris : `muted` (ink-500) minimum.** `ink-400`/`slate-400` et plus clair : bordures et décor uniquement.
5. **Lime = accent unique** (couleur du logo) : jamais de grand aplat lime, jamais de texte blanc sur lime. Les surfaces fortes sont en `navy`, les actions en bleu `primary`.
6. **Une action principale par bloc** (`primary`, avec `whatsappIcon` si c'est WhatsApp), les autres en `outline`/`whatsapp`/`ghost` (ou `inverse` sur fond sombre).
7. **Couleurs de pilier** limitées aux pictos, filets, badges et fonds doux.
8. **Pas de boutons stylés à la main** : `Button` ou `buttonClasses()`.
9. **Pas de grilles de cartes identiques** : liste à filets numérotée en mono (§3).
10. **Chiffres de preuve** (`CHIFFRES`, `content/home-data.ts`) : valeurs provisoires fictives au lancement (marquées `PROVISOIRE`), à remplacer par des chiffres réels ; tableau vide = bandeau masqué.

## 7. Migration « ancien pattern → nouveau »

| Ancien | Nouveau |
|---|---|
| `forest`, `forest-deep`, `forest-light` | `navy`, `navy-deep`, `navy-light` |
| `brand-*` au sens « vert de marque » | `lime-*` (accent) ; `brand-*` est désormais bleu |
| Vert pour un état « OK » (`bg-brand-50 text-brand-900`) | `bg-success-soft text-success` |
| Outfit (`font-display`) / Plus Jakarta Sans (`font-sans`) | IBM Plex Sans (les deux classes) ; `font-mono` = IBM Plex Mono |
| `variant="whatsapp"` comme action principale | `primary` + `whatsappIcon` |
| Grille de cartes « icône + titre + texte » | Liste à filets numérotée (`01`…) |
| `MotionProvider`, framer-motion | supprimés : `Reveal` en CSS |
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
