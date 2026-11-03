// Candidature à une offre (MVP2-02 RG-07, RG-12) : formulaire court du visiteur non inscrit, qui
// crée un compte candidat léger, et motivation du candidat connecté. Module pur (sans base de
// données), partagé entre le navigateur (validation immédiate) et le serveur (validation qui fait foi).
// La validation complète du profil (inscription MVP2-01) reste celle de ./domaine.ts : elle n'est
// pas affaiblie ; le compte léger est signalé « profil incomplet » jusqu'à ce qu'elle passe.
import { z } from 'zod';
import { schemaConsentements, schemaDisponibilite, schemaIdentite, schemaLocalisation, type Disponibilite, type Erreurs } from './domaine';

export const NIVEAUX_EXPERIENCE = ['Aucune / débutant', 'Moins de 1 an', '1 à 3 ans', '3 à 5 ans', 'Plus de 5 ans'] as const;
export type NiveauExperience = (typeof NIVEAUX_EXPERIENCE)[number];
/** Sans expérience : aucune ligne d'expérience n'est créée. */
export const SANS_EXPERIENCE: NiveauExperience = 'Aucune / débutant';

export const MAX_MOTIVATION = 2000;

/** Statuts d'une Candidature (RG-09). */
export const STATUTS_CANDIDATURE = { recue: 'Reçue', retenue: 'Retenue', refusee: 'Refusée' } as const;
export type StatutCandidature = keyof typeof STATUTS_CANDIDATURE;
/** Libellés montrés au candidat dans son espace. */
export const STATUTS_CANDIDATURE_CANDIDAT: Record<StatutCandidature, string> = { recue: 'Reçue', retenue: 'Retenue', refusee: 'Non retenue' };

export const MESSAGE_DEJA_POSTULE = 'Vous avez déjà postulé à cette offre.';
/** Cas limite « offre fermée » : remplace le bouton « Postuler ». */
export const LIBELLE_OFFRE_POURVUE = 'Offre pourvue — inscrivez-vous pour être contacté';
export const MESSAGE_OFFRE_POURVUE = `${LIBELLE_OFFRE_POURVUE}.`;
export const MESSAGE_OFFRE_INCONNUE = 'Cette offre n’existe pas ou n’est plus publiée.';

/** Réponse de l'API `/api/candidature`. */
export type CodeRefusCandidature = 'deja_inscrit' | 'deja_postule' | 'offre_fermee' | 'debit' | 'invalide';
export type ReponseCandidature =
  | { ok: true; mode: 'connecte' | 'compte_leger'; cvEnregistre?: boolean; erreurCv?: string }
  | { ok: false; erreur: string; code: CodeRefusCandidature };

export interface BrouillonCandidature {
  nom: string;
  prenom: string;
  telephone: string;
  villeId: number | null;
  villeAutre: string;
  quartierId: number | null;
  quartierAutre: string;
  metier: string;
  experience: NiveauExperience | '';
  disponibilite: Disponibilite | '';
  disponibleLe: string;
  preavis: string;
  motivation: string;
  consentementTraitement: boolean;
  consentementContact: boolean;
  consentementMajorite: boolean;
}

export const brouillonCandidatureVide = (metier = ''): BrouillonCandidature => ({
  nom: '',
  prenom: '',
  telephone: '',
  villeId: null,
  villeAutre: '',
  quartierId: null,
  quartierAutre: '',
  metier,
  experience: '',
  disponibilite: '',
  disponibleLe: '',
  preavis: '',
  motivation: '',
  consentementTraitement: false,
  consentementContact: false,
  consentementMajorite: false,
});

export const schemaMotivation = z
  .string()
  .trim()
  .max(MAX_MOTIVATION, `${MAX_MOTIVATION} caractères maximum`)
  .transform((v) => (v ? v : null));

const schemaCompteLeger = z.object({
  ...schemaIdentite.pick({ nom: true, prenom: true, telephone: true }).shape,
  ...schemaLocalisation.pick({ villeId: true, villeAutre: true, quartierId: true, quartierAutre: true }).shape,
  ...schemaDisponibilite.pick({ disponibilite: true, disponibleLe: true, preavis: true }).shape,
  metier: z.string().trim().min(2, 'Indiquez le métier recherché').max(80, '80 caractères maximum'),
  experience: z.enum(NIVEAUX_EXPERIENCE, { message: 'Indiquez votre expérience' }),
  motivation: schemaMotivation,
});

export type CandidatureCourteValide = z.output<typeof schemaCompteLeger>;

/** Contrôles qui croisent plusieurs champs (Zod 4 saute les raffinements d'objet si un champ échoue). */
function controles(b: BrouillonCandidature): Erreurs {
  const e: Erreurs = {};
  if (!b.villeId && !b.villeAutre.trim()) e.villeId = 'Indiquez votre ville';
  if (!b.quartierId && !b.quartierAutre.trim()) e.quartierId = 'Indiquez votre quartier';
  if (b.disponibilite === 'a_partir_du' && !b.disponibleLe) e.disponibleLe = 'Indiquez la date';
  if (b.disponibilite === 'preavis' && !b.preavis.trim()) e.preavis = 'Indiquez la durée du préavis';
  return e;
}

/**
 * Valide le formulaire court (compte léger, RG-07) : champs, puis consentements (les deux
 * consentements et l'attestation d'âge de MVP2-01). Renvoie les erreurs par champ.
 */
export function validerCandidatureCourte(b: BrouillonCandidature): { ok: true; donnees: CandidatureCourteValide } | { ok: false; erreurs: Erreurs } {
  const erreurs: Erreurs = {};
  const r = schemaCompteLeger.safeParse(b);
  if (!r.success) for (const i of r.error.issues) erreurs[i.path.join('.')] ??= i.message;
  Object.assign(erreurs, controles(b));
  const c = schemaConsentements.safeParse(b);
  if (!c.success) for (const i of c.error.issues) erreurs[i.path.join('.')] ??= i.message.replace('vous inscrire', 'postuler');
  if (Object.keys(erreurs).length || !r.success) return { ok: false, erreurs };
  const d = r.data;
  if (d.villeId) d.villeAutre = null;
  if (d.quartierId) d.quartierAutre = null;
  if (d.disponibilite !== 'a_partir_du') d.disponibleLe = null;
  if (d.disponibilite !== 'preavis') d.preavis = null;
  return { ok: true, donnees: d };
}

/** Offre telle que lue dans `content/jobs-data.ts` (ADR 0023) : état utile à la candidature. */
export interface OffrePourCandidature {
  slug: string;
  title: string;
  status: 'open' | 'closed';
}

/** RG-07 / cas limite : on ne postule qu'à une offre publiée et ouverte. */
export function refusOffre(offre: OffrePourCandidature | undefined): string | null {
  if (!offre) return MESSAGE_OFFRE_INCONNUE;
  if (offre.status !== 'open') return MESSAGE_OFFRE_POURVUE;
  return null;
}

/**
 * Responsable d'une candidature (RG-10), règle pure : parmi les responsables désignés pour l'offre,
 * celui qui a le moins de candidatures « reçues » en cours ; à égalité, le premier désigné. Sans
 * responsable : le référent du candidat ; à défaut, celui de l'attribution par ville.
 */
export function choisirResponsable(
  responsables: { id: string; charge: number; designeLe: Date }[],
  referentCandidat: string | null,
  referentVille: string | null,
): { referentId: string | null; regle: 'responsable de l’offre' | 'référent du candidat' | 'ville' | 'aucune' } {
  if (responsables.length) {
    const tri = [...responsables].sort((a, b) => a.charge - b.charge || a.designeLe.getTime() - b.designeLe.getTime() || a.id.localeCompare(b.id));
    return { referentId: tri[0]!.id, regle: 'responsable de l’offre' };
  }
  if (referentCandidat) return { referentId: referentCandidat, regle: 'référent du candidat' };
  if (referentVille) return { referentId: referentVille, regle: 'ville' };
  return { referentId: null, regle: 'aucune' };
}

/** RG-09 : seules les candidatures reçues se traitent (reçue → retenue / refusée). */
export function transitionCandidaturePermise(de: StatutCandidature, vers: StatutCandidature): boolean {
  return de === 'recue' && (vers === 'retenue' || vers === 'refusee');
}
