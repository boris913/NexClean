// Espace candidat (MVP2-01) : listes, textes de consentement, validation par étape, complétude.
// Module pur (sans base de données), partagé entre le navigateur (validation immédiate) et le
// serveur (validation qui fait foi).
import { z } from 'zod';
import { normaliserTelephone } from '@/lib/telephone';
import { CONTRATS, SECTEURS } from '@/lib/dossiers/formulaire-personnel';

export { CONTRATS, SECTEURS };

// ─── Référentiels ─────────────────────────────────────────────

/** Statut candidat (ADR 0015). Jamais montré tel quel au candidat (RG-12). */
export const STATUTS_CANDIDAT = {
  nouveau: 'Nouveau',
  a_contacter: 'À contacter',
  preselectionne: 'Présélectionné',
  entretien: 'Entretien',
  propose: 'Proposé au client',
  place: 'Placé',
  indisponible: 'Indisponible',
} as const;
export type StatutCandidat = keyof typeof STATUTS_CANDIDAT;
export const STATUT_CANDIDAT_CODES = Object.keys(STATUTS_CANDIDAT) as [StatutCandidat, ...StatutCandidat[]];

export const NIVEAUX_ETUDES = [
  'Sans diplôme',
  'CEP / fin du primaire',
  'BEPC / CAP',
  'Probatoire',
  'Baccalauréat / GCE A Level',
  'BTS / HND / DUT',
  'Licence / Bachelor',
  'Master et plus',
] as const;

export const HORAIRES = { jour: 'De jour', nuit: 'De nuit', weekend: 'Le week-end' } as const;
export type Horaire = keyof typeof HORAIRES;

export const DISPONIBILITES = {
  immediate: 'Disponible immédiatement',
  a_partir_du: 'Disponible à partir du…',
  preavis: 'En poste, avec un préavis',
} as const;
export type Disponibilite = keyof typeof DISPONIBILITES;

export const MAX_METIERS = 5;
export const MAX_EXPERIENCES = 10;
export const MAX_JUSTIFICATIFS = 5;
export const MAX_COMPETENCES = 20;

/** Au-delà, un bandeau invite le candidat à mettre son profil à jour (RG-11). */
export const MOIS_AVANT_RAPPEL = 6;
/** Délai entre la demande de suppression et son exécution (RG-16 : 7 à 30 jours). */
export const JOURS_AVANT_SUPPRESSION = 7;

// ─── Consentements (RG-02, RG-03 ; ADR 0017) ──────────────────

/** Changer un texte impose de changer sa version : la version acceptée est enregistrée. */
export const CONSENTEMENTS = {
  traitement: {
    version: '2026-11-03',
    texte:
      'J’accepte que NEXCLEAN SARL enregistre et utilise les informations de mon profil et mes documents pour me proposer des emplois. Mon profil n’est présenté à un employeur qu’avec mon accord, pour chaque poste.',
  },
  contact: {
    version: '2026-11-03',
    texte: 'J’accepte que NEXCLEAN SARL me contacte par téléphone, WhatsApp ou e-mail au sujet d’offres d’emploi et de mon inscription.',
  },
  majorite: {
    version: '2026-11-03',
    texte: 'Je certifie avoir au moins 18 ans, ou l’âge légal pour le type de contrat recherché.',
  },
} as const;
export type TypeConsentement = keyof typeof CONSENTEMENTS;

export const MENTION_GRATUITE = 'L’inscription, la candidature et la mise en relation sont 100 % gratuites.';

// ─── Brouillon (état du formulaire côté navigateur) ───────────

export interface ExperienceBrouillon {
  poste: string;
  employeur: string;
  ville: string;
  duree: string;
  missions: string;
}

export interface BrouillonCandidat {
  // 1. Identité
  nom: string;
  prenom: string;
  telephone: string;
  whatsappIdentique: boolean;
  whatsapp: string;
  email: string;
  // 2. Localisation
  villeId: number | null;
  villeAutre: string;
  arrondissementId: number | null;
  quartierId: number | null;
  quartierAutre: string;
  repere: string;
  zonesTouteVille: boolean;
  zonesArrondissementIds: number[];
  zonesQuartierIds: number[];
  // 3. Recherche
  metiers: string[];
  secteurs: string[];
  typesContrat: string[];
  salaireMin: string;
  salaireMax: string;
  // 4. Parcours
  niveauEtudes: string;
  qualifications: string;
  experiences: ExperienceBrouillon[];
  competences: string[];
  // 5. Disponibilité
  disponibilite: Disponibilite | '';
  disponibleLe: string;
  preavis: string;
  horaires: Horaire[];
  // 7. Compte et consentements (le mot de passe n'est jamais conservé dans le brouillon)
  consentementTraitement: boolean;
  consentementContact: boolean;
  consentementMajorite: boolean;
}

export const experienceVide = (): ExperienceBrouillon => ({ poste: '', employeur: '', ville: '', duree: '', missions: '' });

export const brouillonCandidatVide = (): BrouillonCandidat => ({
  nom: '',
  prenom: '',
  telephone: '',
  whatsappIdentique: true,
  whatsapp: '',
  email: '',
  villeId: null,
  villeAutre: '',
  arrondissementId: null,
  quartierId: null,
  quartierAutre: '',
  repere: '',
  zonesTouteVille: false,
  zonesArrondissementIds: [],
  zonesQuartierIds: [],
  metiers: [],
  secteurs: [],
  typesContrat: [],
  salaireMin: '',
  salaireMax: '',
  niveauEtudes: '',
  qualifications: '',
  experiences: [],
  competences: [],
  disponibilite: '',
  disponibleLe: '',
  preavis: '',
  horaires: [],
  consentementTraitement: false,
  consentementContact: false,
  consentementMajorite: false,
});

// ─── Validation ───────────────────────────────────────────────

const libre = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum`)
    .transform((v) => (v ? v : null));
const requis = (max: number, message: string) => z.string().trim().min(1, message).max(max, `${max} caractères maximum`);
const ids = z.array(z.number().int().positive()).max(100);

const telephone = z
  .string()
  .trim()
  .min(1, 'Indiquez votre numéro de téléphone')
  .transform((v, ctx) => {
    const n = normaliserTelephone(v);
    if (!n) {
      ctx.addIssue({ code: 'custom', message: 'Numéro invalide (ex. 6 90 00 00 00)' });
      return z.NEVER;
    }
    return n;
  });

const telephoneFacultatif = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return null;
    const n = normaliserTelephone(v);
    if (!n) {
      ctx.addIssue({ code: 'custom', message: 'Numéro invalide (ex. 6 90 00 00 00)' });
      return z.NEVER;
    }
    return n;
  });

const montant = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return null;
    const n = Number(v.replace(/[\s .]/g, ''));
    if (!Number.isInteger(n) || n < 0 || n > 100_000_000) {
      ctx.addIssue({ code: 'custom', message: 'Montant en FCFA, sans décimales' });
      return z.NEVER;
    }
    return n;
  });

export const schemaIdentite = z.object({
  nom: requis(80, 'Indiquez votre nom'),
  prenom: requis(80, 'Indiquez votre prénom'),
  telephone,
  whatsappIdentique: z.boolean(),
  whatsapp: telephoneFacultatif,
  email: z
    .string()
    .trim()
    .max(160)
    .transform((v) => v.toLowerCase())
    .pipe(z.union([z.literal(''), z.email('Adresse e-mail invalide')]))
    .transform((v) => v || null),
});

export const schemaLocalisation = z.object({
  villeId: z.number().int().positive().nullable(),
  villeAutre: libre(80),
  arrondissementId: z.number().int().positive().nullable(),
  quartierId: z.number().int().positive().nullable(),
  quartierAutre: libre(80),
  repere: libre(160),
  zonesTouteVille: z.boolean(),
  zonesArrondissementIds: ids,
  zonesQuartierIds: ids,
});

export const schemaRecherche = z.object({
  metiers: z
    .array(z.string().trim().min(2, 'Métier trop court').max(80))
    .min(1, 'Indiquez au moins un métier recherché')
    .max(MAX_METIERS, `${MAX_METIERS} métiers maximum`)
    .transform((l) => [...new Set(l)]),
  secteurs: z.array(z.enum(SECTEURS)).max(SECTEURS.length),
  typesContrat: z.array(z.enum(CONTRATS)).min(1, 'Choisissez au moins un type de contrat'),
  salaireMin: montant,
  salaireMax: montant,
});

export const schemaExperience = z.object({
  poste: requis(120, 'Indiquez le poste occupé'),
  employeur: libre(120),
  ville: libre(80),
  duree: libre(60),
  missions: libre(1000),
});

export const schemaParcours = z.object({
  niveauEtudes: z.enum(NIVEAUX_ETUDES, { message: 'Choisissez votre niveau d’études' }),
  qualifications: libre(1000),
  experiences: z.array(schemaExperience).max(MAX_EXPERIENCES, `${MAX_EXPERIENCES} expériences maximum`),
  competences: z
    .array(z.string().trim().min(1).max(60))
    .max(MAX_COMPETENCES, `${MAX_COMPETENCES} compétences maximum`)
    .transform((l) => [...new Set(l)]),
});

export const schemaDisponibilite = z.object({
  disponibilite: z.enum(Object.keys(DISPONIBILITES) as [Disponibilite, ...Disponibilite[]], { message: 'Indiquez votre disponibilité' }),
  disponibleLe: z
    .string()
    .trim()
    .transform((v) => v || null)
    .pipe(z.iso.date('Date invalide').nullable()),
  preavis: libre(80),
  horaires: z.array(z.enum(Object.keys(HORAIRES) as [Horaire, ...Horaire[]])).max(3),
});

export const schemaMotDePasse = z
  .string()
  .refine((v) => /^\d{6}$/.test(v) || v.length >= 8, 'Au moins 8 caractères, ou un code de 6 chiffres')
  .refine((v) => v.length <= 128, '128 caractères maximum');

export const schemaConsentements = z.object({
  consentementTraitement: z.literal(true, { message: 'Ce consentement est nécessaire pour vous inscrire' }),
  consentementContact: z.literal(true, { message: 'Ce consentement est nécessaire pour vous inscrire' }),
  consentementMajorite: z.literal(true, { message: 'Cette attestation est nécessaire pour vous inscrire' }),
});

/** Étapes du formulaire d'inscription, dans l'ordre (la 6 = documents, envoyés après la création du compte). */
export const ETAPES_INSCRIPTION = ['Identité', 'Localisation', 'Recherche', 'Parcours', 'Disponibilité', 'Documents', 'Compte'] as const;

export type Erreurs = Record<string, string>;

const versErreurs = (e: z.ZodError, prefixe = ''): Erreurs => {
  const r: Erreurs = {};
  for (const i of e.issues) {
    const cle = prefixe + i.path.join('.');
    r[cle] ??= i.message;
  }
  return r;
};

/** Contrôles qui croisent plusieurs champs (Zod 4 saute les raffinements d'objet si un champ échoue). */
export function controlesCroises(etape: number, b: BrouillonCandidat): Erreurs {
  const e: Erreurs = {};
  if (etape === 1 && !b.whatsappIdentique && !b.whatsapp.trim()) e.whatsapp = 'Indiquez votre numéro WhatsApp, ou cochez « identique »';
  if (etape === 2) {
    if (!b.villeId && !b.villeAutre.trim()) e.villeId = 'Indiquez votre ville';
    if (!b.quartierId && !b.quartierAutre.trim()) e.quartierId = 'Indiquez votre quartier';
    if (!b.zonesTouteVille && b.zonesArrondissementIds.length === 0 && b.zonesQuartierIds.length === 0)
      e.zones = 'Choisissez au moins un arrondissement ou un quartier, ou « toute la ville »';
  }
  if (etape === 3) {
    const min = Number(b.salaireMin.replace(/[\s .]/g, '') || 0);
    const max = Number(b.salaireMax.replace(/[\s .]/g, '') || 0);
    if (b.salaireMin.trim() && b.salaireMax.trim() && min > max) e.salaireMax = 'Le maximum doit être supérieur au minimum';
  }
  if (etape === 5) {
    if (b.disponibilite === 'a_partir_du' && !b.disponibleLe) e.disponibleLe = 'Indiquez la date';
    if (b.disponibilite === 'preavis' && !b.preavis.trim()) e.preavis = 'Indiquez la durée du préavis';
  }
  return e;
}

/** Valide une étape du brouillon ; renvoie les erreurs par champ (vide si l'étape est valide). */
export function validerEtapeCandidat(etape: number, b: BrouillonCandidat): Erreurs {
  const r = (() => {
    switch (etape) {
      case 1:
        return schemaIdentite.safeParse(b);
      case 2:
        return schemaLocalisation.safeParse(b);
      case 3:
        return schemaRecherche.safeParse(b);
      case 4:
        return schemaParcours.safeParse(b);
      case 5:
        return schemaDisponibilite.safeParse(b);
      case 7:
        return schemaConsentements.safeParse(b);
      default:
        return null;
    }
  })();
  return { ...(r && !r.success ? versErreurs(r.error) : {}), ...controlesCroises(etape, b) };
}

/** Profil validé, prêt à être enregistré. */
export type ProfilValide = z.output<typeof schemaIdentite> &
  z.output<typeof schemaLocalisation> &
  z.output<typeof schemaRecherche> &
  z.output<typeof schemaParcours> &
  z.output<typeof schemaDisponibilite>;

/** Validation complète (serveur) : toutes les étapes de profil. */
export function validerProfil(b: BrouillonCandidat): { ok: true; profil: ProfilValide } | { ok: false; erreurs: Erreurs; etape: number } {
  for (const etape of [1, 2, 3, 4, 5]) {
    const erreurs = validerEtapeCandidat(etape, b);
    if (Object.keys(erreurs).length) return { ok: false, erreurs, etape };
  }
  const profil = {
    ...schemaIdentite.parse(b),
    ...schemaLocalisation.parse(b),
    ...schemaRecherche.parse(b),
    ...schemaParcours.parse(b),
    ...schemaDisponibilite.parse(b),
  };
  if (profil.whatsappIdentique) profil.whatsapp = profil.telephone;
  if (profil.disponibilite !== 'a_partir_du') profil.disponibleLe = null;
  if (profil.disponibilite !== 'preavis') profil.preavis = null;
  if (profil.zonesTouteVille) {
    profil.zonesArrondissementIds = [];
    profil.zonesQuartierIds = [];
  }
  return { ok: true, profil };
}

// ─── Complétude (RG-09) ───────────────────────────────────────

export interface ElementsCompletude {
  email: string | null;
  quartierId: number | null;
  quartierAutre: string | null;
  repere: string | null;
  secteurs: string[];
  salaireMin: number | null;
  qualifications: string | null;
  experiences: number;
  competences: string[];
  horaires: string[];
  cv: boolean;
}

/** Pourcentage de complétude : les champs obligatoires comptent pour 40 %, le reste se répartit. */
export function completude(c: ElementsCompletude): { pourcentage: number; manquants: string[] } {
  const facultatifs: [boolean, string][] = [
    [c.cv, 'votre CV'],
    [c.experiences > 0, 'au moins une expérience'],
    [c.competences.length > 0, 'vos compétences'],
    [!!c.qualifications, 'vos diplômes ou qualifications'],
    [c.secteurs.length > 0, 'les secteurs souhaités'],
    [c.horaires.length > 0, 'vos horaires possibles'],
    [!!c.email, 'une adresse e-mail (utile pour récupérer votre mot de passe)'],
    [!!c.repere, 'un point de repère'],
    [c.salaireMin != null, 'vos prétentions salariales'],
  ];
  const faits = facultatifs.filter(([ok]) => ok).length;
  return {
    pourcentage: Math.round(40 + (60 * faits) / facultatifs.length),
    manquants: facultatifs.filter(([ok]) => !ok).map(([, libelle]) => libelle),
  };
}

/** Pseudonyme stable d'un candidat supprimé (RG-17) : « Candidat #8F3A ». */
export const pseudonyme = (id: number) => `Candidat #${(id * 2654435761 % 0x10000).toString(16).toUpperCase().padStart(4, '0')}`;
