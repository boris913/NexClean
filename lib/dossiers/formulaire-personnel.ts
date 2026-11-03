// Formulaire public « Demander du personnel » (MVP1-03) : listes, validation par étape,
// estimation et récapitulatif. Module pur (sans base de données), partagé entre le
// navigateur (validation immédiate) et le serveur (validation qui fait foi).
import { z } from 'zod';
import { normaliserTelephone } from '@/lib/telephone';
import { FUSEAU } from '@/lib/domain/referentiels';

export const FORMULAIRE_PERSONNEL = 'demande_personnel';
export const MAX_LIGNES = 10;
export const MAX_PERSONNES_PAR_LIGNE = 100;

export const SECTEURS = [
  'Hôtellerie',
  'Restauration',
  'Commerce',
  'Industrie',
  'Logistique',
  'Administration',
  'Santé',
  'Immobilier',
  'Services à domicile',
  'Autre',
] as const;

export const EXPERIENCES = ['Débutant accepté', 'Moins d’1 an', '1 à 3 ans', '3 à 5 ans', 'Plus de 5 ans'] as const;

export const CONTRATS = ['CDI', 'CDD', 'Stage', 'Job étudiant', 'Temps partiel', 'Alternance', 'Mission ponctuelle', 'Saisonnier'] as const;
/** Contrats pour lesquels la durée est obligatoire. */
export const CONTRATS_AVEC_DUREE: readonly string[] = ['CDD', 'Mission ponctuelle', 'Saisonnier', 'Stage'];

export const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] as const;

// ─── Brouillon (état du formulaire côté navigateur) ───────────

export interface LigneBrouillon {
  intitule: string;
  nombre: string;
  missions: string;
  competences: string;
  experience: string;
  salaire: string;
  typeContrat: string;
  duree: string;
  horaires: string;
  joursRepos: string[];
  avantages: string;
  datePriseFonction: string;
  desQuePossible: boolean;
}

export interface Brouillon {
  clientType: 'entreprise' | 'particulier';
  entreprise: string;
  contact: string;
  whatsapp: string;
  autreTelephone: string;
  email: string;
  villeId: number | null;
  villeAutre: string;
  arrondissementId: number | null;
  quartierId: number | null;
  quartierAutre: string;
  lieu: string;
  secteur: string;
  lignes: LigneBrouillon[];
  precisions: string;
  consentement: boolean;
}

export const ligneVide = (): LigneBrouillon => ({
  intitule: '',
  nombre: '1',
  missions: '',
  competences: '',
  experience: '',
  salaire: '',
  typeContrat: '',
  duree: '',
  horaires: '',
  joursRepos: [],
  avantages: '',
  datePriseFonction: '',
  desQuePossible: false,
});

export const brouillonVide = (): Brouillon => ({
  clientType: 'entreprise',
  entreprise: '',
  contact: '',
  whatsapp: '',
  autreTelephone: '',
  email: '',
  villeId: null,
  villeAutre: '',
  arrondissementId: null,
  quartierId: null,
  quartierAutre: '',
  lieu: '',
  secteur: '',
  lignes: [ligneVide()],
  precisions: '',
  consentement: false,
});

// ─── Validation ───────────────────────────────────────────────

/** Date du jour à Douala, au format AAAA-MM-JJ. */
export const aujourdhuiDouala = (maintenant = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU, year: 'numeric', month: '2-digit', day: '2-digit' }).format(maintenant);

const libre = (max: number, message?: string) =>
  z
    .string()
    .trim()
    .max(max, message ?? `${max} caractères maximum`)
    .transform((v) => (v ? v : null));
const requis = (max: number, message: string) => z.string().trim().min(1, message).max(max, `${max} caractères maximum`);

const telephone = (obligatoire: boolean) =>
  z
    .string()
    .trim()
    .superRefine((v, ctx) => {
      if (!v) {
        if (obligatoire) ctx.addIssue({ code: 'custom', message: 'Numéro WhatsApp obligatoire' });
        return;
      }
      if (!normaliserTelephone(v)) ctx.addIssue({ code: 'custom', message: 'Numéro invalide (ex. 6 90 00 00 00)' });
    })
    .transform((v) => (v ? normaliserTelephone(v) : null));

/** Entier ou fourchette en FCFA : « 80000 », « 80 000 », « 80 000 - 100 000 FCFA ». */
const RE_SALAIRE = /^\d[\d\s.]*(\s*(-|–|à|a)\s*\d[\d\s.]*)?(\s*(f\s?cfa|xaf|f))?$/i;

export const schemaEtape1 = z
  .object({
    clientType: z.enum(['entreprise', 'particulier']),
    entreprise: libre(120),
    contact: requis(80, 'Nom du contact obligatoire'),
    whatsapp: telephone(true),
    autreTelephone: telephone(false),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(120)
      .refine((v) => !v || z.email().safeParse(v).success, 'E-mail invalide')
      .transform((v) => (v ? v : null)),
  });

export const schemaEtape2 = z
  .object({
    villeId: z.number().int().positive().nullable(),
    villeAutre: libre(80),
    arrondissementId: z.number().int().positive().nullable(),
    quartierId: z.number().int().positive().nullable(),
    quartierAutre: libre(80),
    lieu: libre(200),
    secteur: z.enum(SECTEURS, { message: 'Choisissez un secteur' }),
  });

export const schemaLigne = z
  .object({
    intitule: requis(120, 'Intitulé du poste obligatoire'),
    nombre: z
      .string()
      .trim()
      .regex(/^\d+$/, 'Nombre entier')
      .transform(Number)
      .pipe(z.number().int().min(1, 'Au moins 1 personne').max(MAX_PERSONNES_PAR_LIGNE, `${MAX_PERSONNES_PAR_LIGNE} personnes maximum par poste`)),
    missions: requis(1000, 'Missions principales obligatoires'),
    competences: libre(500),
    experience: z.enum(EXPERIENCES, { message: 'Choisissez l’expérience souhaitée' }),
    salaire: libre(60).refine((v) => !v || RE_SALAIRE.test(v), 'Montant ou fourchette en FCFA (ex. 80 000 ou 80 000 - 100 000)'),
    typeContrat: z.enum(CONTRATS, { message: 'Choisissez un type de contrat' }),
    duree: libre(80),
    horaires: libre(120),
    joursRepos: z.array(z.enum(JOURS)).max(7),
    avantages: libre(300),
    datePriseFonction: z.string().trim(),
    desQuePossible: z.boolean(),
  })
  .transform((v) => ({ ...v, duree: CONTRATS_AVEC_DUREE.includes(v.typeContrat) ? v.duree : null, datePriseFonction: v.desQuePossible ? null : v.datePriseFonction }));

export const schemaEtape3 = z.object({
  lignes: z.array(schemaLigne).min(1, 'Ajoutez au moins un poste').max(MAX_LIGNES, `${MAX_LIGNES} postes maximum`),
  precisions: libre(2000),
});

export const schemaEtape4 = z.object({
  consentement: z.literal(true, { message: 'Votre accord est nécessaire pour envoyer la demande' }),
});

export const SCHEMAS_ETAPES = [schemaEtape1, schemaEtape2, schemaEtape3, schemaEtape4] as const;

export type DemandePersonnel = z.output<typeof schemaEtape1> & z.output<typeof schemaEtape2> & z.output<typeof schemaEtape3> & z.output<typeof schemaEtape4>;

/**
 * Contrôles qui croisent plusieurs champs. Faits à part : en Zod 4, un raffinement d'objet
 * n'est pas exécuté si un autre champ est déjà en erreur, et toutes les erreurs doivent
 * s'afficher ensemble.
 */
function controlesCroises(etape: number, b: Partial<Brouillon>): Record<string, string> {
  const r: Record<string, string> = {};
  const vide = (v: unknown) => typeof v !== 'string' || !v.trim();
  if (etape === 1 && b.clientType === 'entreprise' && vide(b.entreprise)) r.entreprise = 'Nom de l’entreprise obligatoire';
  if (etape === 2) {
    if (!b.villeId && vide(b.villeAutre)) r.villeId = 'Ville obligatoire';
    if (!b.quartierId && vide(b.quartierAutre)) r.quartierId = 'Quartier obligatoire';
  }
  if (etape === 3 && Array.isArray(b.lignes)) {
    b.lignes.forEach((l, i) => {
      if (!l || typeof l !== 'object') return;
      if (CONTRATS_AVEC_DUREE.includes(l.typeContrat) && vide(l.duree)) r[`lignes.${i}.duree`] = 'Durée obligatoire pour ce contrat';
      if (!l.desQuePossible) {
        const d = typeof l.datePriseFonction === 'string' ? l.datePriseFonction.trim() : '';
        if (!d) r[`lignes.${i}.datePriseFonction`] = 'Date obligatoire, ou cochez « Dès que possible »';
        else if (!z.iso.date().safeParse(d).success) r[`lignes.${i}.datePriseFonction`] = 'Date invalide';
        else if (d < aujourdhuiDouala()) r[`lignes.${i}.datePriseFonction`] = 'La date ne peut pas être passée';
      }
    });
  }
  return r;
}

/** Erreurs Zod → { 'lignes.0.duree': 'Durée obligatoire…' } (première erreur par champ). */
export function erreursParChamp(e: z.ZodError): Record<string, string> {
  const r: Record<string, string> = {};
  for (const i of e.issues) {
    const cle = i.path.join('.') || '_';
    r[cle] ??= i.message;
  }
  return r;
}

function verifierEtape(etape: number, b: unknown): { donnees?: object; erreurs: Record<string, string> } {
  const s = SCHEMAS_ETAPES[etape - 1]!;
  const r = s.safeParse(b);
  const croises = b && typeof b === 'object' ? controlesCroises(etape, b as Partial<Brouillon>) : {};
  const erreurs = { ...croises, ...(r.success ? {} : erreursParChamp(r.error)) };
  return { donnees: r.success && !Object.keys(erreurs).length ? r.data : undefined, erreurs };
}

/** Validation d'une étape (1 à 4) dans le navigateur. */
export const validerEtape = (etape: number, b: Brouillon): Record<string, string> => verifierEtape(etape, b).erreurs;

/** Validation complète (côté serveur, fait foi). */
export function validerDemandePersonnel(b: unknown): { ok: true; donnees: DemandePersonnel } | { ok: false; erreurs: Record<string, string> } {
  const erreurs: Record<string, string> = {};
  const parties: object[] = [];
  SCHEMAS_ETAPES.forEach((_, i) => {
    const r = verifierEtape(i + 1, b);
    Object.assign(erreurs, r.erreurs);
    if (r.donnees) parties.push(r.donnees);
  });
  if (Object.keys(erreurs).length) return { ok: false, erreurs };
  return { ok: true, donnees: Object.assign({}, ...parties) as DemandePersonnel };
}

// ─── Estimation (RG-04, RG-05) ────────────────────────────────

export const formaterFCFA = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`;

export function totalPersonnes(lignes: { nombre: string | number }[]): number {
  return lignes.reduce((t, l) => {
    const n = typeof l.nombre === 'number' ? l.nombre : Number(l.nombre);
    return t + (Number.isInteger(n) && n > 0 ? n : 0);
  }, 0);
}

export interface Estimation {
  commission: number;
  personnes: number;
  montant: number;
}

export const estimer = (commission: number, personnes: number): Estimation => ({ commission, personnes, montant: commission * personnes });

export const texteEstimation = (e: Estimation) =>
  `Estimation indicative : ${formaterFCFA(e.montant)} (${e.personnes} personne${e.personnes > 1 ? 's' : ''} × ${formaterFCFA(e.commission)}).`;

export const MENTION_ESTIMATION = 'Montant définitif sur devis, payable selon les placements effectivement réalisés.';

// ─── Récapitulatif WhatsApp (RG-08, repli en cas d'échec) ─────

export function recapitulatifWhatsApp(p: {
  numero?: string | null;
  contact: string;
  entreprise?: string | null;
  ville?: string | null;
  quartier?: string | null;
  lignes: { intitule: string; nombre: string | number; typeContrat?: string | null; missions?: string | null }[];
  lienSuivi?: string | null;
  estimation?: Estimation | null;
  detaille?: boolean;
}): string {
  const total = totalPersonnes(p.lignes);
  const l: string[] = [];
  l.push(p.numero ? `Bonjour NEXCLEAN, voici le récapitulatif de ma demande de personnel n° ${p.numero}.` : 'Bonjour NEXCLEAN, je souhaite vous envoyer ma demande de personnel.');
  l.push(`Contact : ${p.contact}${p.entreprise ? ` (${p.entreprise})` : ''}`);
  if (p.ville) l.push(`Lieu : ${[p.quartier, p.ville].filter(Boolean).join(', ')}`);
  l.push(`Total : ${total} personne${total > 1 ? 's' : ''}`);
  for (const x of p.lignes) {
    l.push(`- ${x.nombre} × ${x.intitule}${x.typeContrat ? ` (${x.typeContrat})` : ''}`);
    if (p.detaille && x.missions) l.push(`  Missions : ${x.missions}`);
  }
  if (p.estimation) l.push(texteEstimation(p.estimation));
  if (p.lienSuivi) l.push(`Suivi : ${p.lienSuivi}`);
  return l.join('\n');
}
