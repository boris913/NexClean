// Données personnelles des candidats (ADR 0017 §4 et §6, specs/POST-04) : règles de conservation
// (relance à 24 mois d'inactivité, anonymisation 30 jours plus tard sans réponse) et contenu de
// l'export « Mes données ». Module pur (sans base de données), testé unitairement ; la tâche
// planifiée est dans ./conservation.ts, la lecture et le rendu de l'export dans ./export.ts.
import { CONSENTEMENTS, DISPONIBILITES, HORAIRES, type TypeConsentement } from './domaine';
import { STATUTS_CANDIDATURE_CANDIDAT } from './formulaire-candidature';
import { STATUTS_PLACEMENT, type StatutPlacement } from '@/lib/propositions/domaine';

// ─── Conservation (RG-01..08) ─────────────────────────────────

/** RG-02 : un profil sans activité depuis ce nombre de mois est relancé. */
export const MOIS_INACTIVITE = 24;
/** RG-05 : sans réponse dans ce délai après la relance, le profil est anonymisé. */
export const JOURS_REPONSE_RELANCE = 30;
const JOUR_MS = 24 * 60 * 60 * 1000;

/** Date avant laquelle la dernière activité rend un profil « inactif » (24 mois calendaires). */
export function limiteInactivite(maintenant: Date): Date {
  const d = new Date(maintenant);
  d.setUTCMonth(d.getUTCMonth() - MOIS_INACTIVITE);
  return d;
}

/** Date à partir de laquelle un profil relancé sans réponse est anonymisé. */
export const anonymisationPrevueLe = (relanceLe: Date) => new Date(relanceLe.getTime() + JOURS_REPONSE_RELANCE * JOUR_MS);

/**
 * RG-01 : dernière activité du candidat = la plus récente de ces dates (les absentes sont
 * ignorées). Toutes viennent du candidat lui-même, ou d'une réponse qu'il a donnée au référent.
 */
export interface ActiviteCandidat {
  creeLe: Date;
  profilMisAJourLe: Date;
  derniereConnexionLe: Date | null;
  conservationConfirmeeLe: Date | null;
  derniereCandidatureLe: Date | null;
  derniereReponsePropositionLe: Date | null;
  dernierPlacementConfirmeLe: Date | null;
}

export function derniereActivite(a: ActiviteCandidat): Date {
  const dates = [a.creeLe, a.profilMisAJourLe, a.derniereConnexionLe, a.conservationConfirmeeLe, a.derniereCandidatureLe, a.derniereReponsePropositionLe, a.dernierPlacementConfirmeLe].filter(
    (d): d is Date => d instanceof Date,
  );
  return new Date(Math.max(...dates.map((d) => d.getTime())));
}

export interface EtatConservation {
  derniereActivite: Date;
  /** Relance en cours (null : aucune). */
  relanceLe: Date | null;
  /** RG-06 : Proposition en cours ou Placement annoncé (pas encore confirmé). */
  processusActif: boolean;
  suppressionDemandee: boolean;
  supprime: boolean;
}

export type DecisionConservation = 'aucune' | 'relancer' | 'attendre' | 'annuler_relance' | 'anonymiser';

/**
 * Décision de la tâche planifiée pour un candidat (RG-02..07). Idempotente : appliquer la décision
 * change l'état (relance posée, annulée, données effacées), le passage suivant décide `aucune` ou `attendre`.
 */
export function decisionConservation(e: EtatConservation, maintenant: Date): DecisionConservation {
  // RG-07 : la suppression à la demande (MVP2-01 RG-15..18) a son propre circuit.
  if (e.supprime || e.suppressionDemandee) return 'aucune';
  if (e.relanceLe) {
    // RG-04 : une activité postérieure à la relance l'annule ; RG-06 : un processus actif aussi.
    if (e.derniereActivite > e.relanceLe || e.processusActif) return 'annuler_relance';
    return maintenant >= anonymisationPrevueLe(e.relanceLe) ? 'anonymiser' : 'attendre';
  }
  if (e.processusActif) return 'aucune';
  return e.derniereActivite <= limiteInactivite(maintenant) ? 'relancer' : 'aucune';
}

/** Modèle WhatsApp proposé sur la fiche pour la relance (RG-03). Texte par défaut, à valider. */
export const MODELE_RELANCE_INACTIVITE = {
  nom: 'Relance inactivité',
  texte:
    'Bonjour {{candidat.prenom}}, je suis {{referent.prenom}} de NEXCLEAN. Votre profil candidat n’a pas été utilisé depuis 2 ans. Pour le garder, connectez-vous à votre espace ou mettez votre profil à jour : {{candidat.lien_espace}}\n\nVous pouvez aussi simplement me répondre ici. Sans nouvelle de votre part sous 30 jours, votre profil sera anonymisé et vos documents (CV, justificatifs) supprimés.\n\n{{referent.prenom}}, NEXCLEAN',
} as const;

const dateFr = (d: Date) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Douala', day: 'numeric', month: 'long', year: 'numeric' }).format(d);

/** Textes envoyés au candidat (RG-03, RG-05). Textes par défaut, à valider par la Direction. */
export const TEXTES_CONSERVATION = {
  notificationRelance: (relanceLe: Date) => ({
    titre: 'Votre profil est-il toujours d’actualité ?',
    texte: `Vous ne vous êtes pas connecté(e) et n’avez pas mis votre profil à jour depuis 2 ans. Pour le garder, il suffit de vous connecter ou de mettre votre profil à jour avant le ${dateFr(anonymisationPrevueLe(relanceLe))}. Sinon, votre profil sera anonymisé et vos documents supprimés.`,
  }),
  emailRelance: (prenom: string, relanceLe: Date, lienEspace: string) => ({
    subject: 'Votre profil candidat NEXCLEAN — toujours d’actualité ?',
    text: `Bonjour ${prenom},\n\nVous ne vous êtes pas connecté(e) à votre espace candidat NEXCLEAN et n'avez pas mis votre profil à jour depuis 2 ans.\n\nPour le garder, connectez-vous ou mettez votre profil à jour avant le ${dateFr(anonymisationPrevueLe(relanceLe))} :\n${lienEspace}\n\nSans nouvelle de votre part, votre profil sera anonymisé et vos documents (CV, justificatifs) supprimés. Les placements déjà réalisés sont conservés sous un pseudonyme, pour nos obligations comptables.\n\nNEXCLEAN SARL`,
  }),
  emailAnonymisation: (prenom: string) => ({
    subject: 'Votre profil candidat NEXCLEAN a été anonymisé',
    text: `Bonjour ${prenom},\n\nSans nouvelle de votre part depuis notre message d'il y a 30 jours, votre compte candidat NEXCLEAN a été fermé : votre profil a été anonymisé et vos documents (CV, justificatifs) supprimés. Les copies de sauvegarde sont effacées sous 30 jours.\n\nVous pouvez vous réinscrire à tout moment sur notre site.\n\nNEXCLEAN SARL`,
  }),
} as const;

// ─── Export « Mes données » (RG-09..14) ───────────────────────

/** RG-12 : nombre maximal d'exports par candidat sur 24 heures glissantes. */
export const MAX_EXPORTS_PAR_JOUR = 5;
export const MESSAGE_LIMITE_EXPORT = `Vous avez déjà téléchargé vos données ${MAX_EXPORTS_PAR_JOUR} fois en 24 heures. Réessayez plus tard.`;

export type FormatExport = 'json' | 'pdf';
export const estFormatExport = (v: unknown): v is FormatExport => v === 'json' || v === 'pdf';

/** Lignes lues en base pour l'export : uniquement des données du candidat lui-même. */
export interface LignesExport {
  candidat: {
    id: number;
    nom: string;
    prenom: string;
    telephone: string | null;
    whatsapp: string | null;
    email: string | null;
    ville: string | null;
    arrondissement: string | null;
    quartier: string | null;
    repere: string | null;
    zonesTouteVille: boolean;
    zones: string[];
    metiers: string[];
    secteurs: string[];
    typesContrat: string[];
    salaireMin: number | null;
    salaireMax: number | null;
    niveauEtudes: string | null;
    qualifications: string | null;
    competences: string[];
    disponibilite: keyof typeof DISPONIBILITES | null;
    disponibleLe: string | null;
    preavis: string | null;
    horaires: string[];
    enRecherche: boolean;
    canalInscription: string;
    creeLe: Date;
    profilMisAJourLe: Date;
    derniereConnexionLe: Date | null;
  };
  consentements: { type: TypeConsentement; version: string; canal: string; ip: string | null; horodatage: Date }[];
  experiences: { poste: string; employeur: string | null; ville: string | null; duree: string | null; missions: string | null }[];
  documents: { categorie: 'cv' | 'justificatif'; nomOrigine: string; taille: number; creeLe: Date }[];
  candidatures: { offreTitre: string; offreSlug: string; motivation: string | null; statut: keyof typeof STATUTS_CANDIDATURE_CANDIDAT; creeLe: Date }[];
  /** Mêmes informations que l'espace candidat (nom du Client compris, ADR 0017 §2). */
  propositions: {
    id: number;
    poste: string;
    client: string;
    libelleStatut: string;
    secteur: string | null;
    ville: string | null;
    typeContrat: string | null;
    salaire: string | null;
    creeLe: Date;
    accordMode: 'espace' | 'whatsapp' | null;
    accordLe: Date | null;
    reponseLe: Date | null;
    numeroCommunicable: boolean;
    entretienLe: Date | null;
    entretienLieu: string | null;
  }[];
  placements: { propositionId: number; poste: string; client: string; statut: StatutPlacement; datePrevue: string; datePriseDePoste: string | null; finLe: string | null }[];
  notifications: { titre: string; texte: string; creeLe: Date; luLe: Date | null }[];
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);
const MODES_ACCORD_CANDIDAT = { espace: 'Dans votre espace candidat', whatsapp: 'Par WhatsApp, enregistré par votre conseiller' } as const;

/**
 * Export JSON (RG-10) : version de format, responsable du traitement, puis les données du
 * candidat. N'y figurent jamais (RG-11) : mot de passe, jetons et sessions, statut interne,
 * référent, notes et motifs internes, retours des clients, données d'autres personnes, salaire
 * d'un Placement (confidentiel), clés de stockage des fichiers.
 */
export function construireExport(l: LignesExport, genereLe: Date, responsable: { nom: string; contact: string }) {
  const c = l.candidat;
  return {
    format: 'nexclean-mes-donnees',
    version: 1,
    genereLe: genereLe.toISOString(),
    responsableDuTraitement: responsable,
    profil: {
      identifiant: c.id,
      nom: c.nom,
      prenom: c.prenom,
      telephone: c.telephone,
      whatsapp: c.whatsapp,
      email: c.email,
      localisation: { ville: c.ville, arrondissement: c.arrondissement, quartier: c.quartier, repere: c.repere, zonesAcceptees: c.zonesTouteVille ? ['Toute la ville'] : c.zones },
      recherche: { metiers: c.metiers, secteurs: c.secteurs, typesContrat: c.typesContrat, salaireMin: c.salaireMin, salaireMax: c.salaireMax, enRecherche: c.enRecherche },
      parcours: { niveauEtudes: c.niveauEtudes, qualifications: c.qualifications, competences: c.competences },
      disponibilite: {
        disponibilite: c.disponibilite ? DISPONIBILITES[c.disponibilite] : null,
        disponibleLe: c.disponibleLe,
        preavis: c.preavis,
        horaires: c.horaires.map((h) => HORAIRES[h as keyof typeof HORAIRES] ?? h),
      },
      compte: { inscritLe: iso(c.creeLe), canalInscription: c.canalInscription === 'assiste' ? 'Inscription assistée par NEXCLEAN' : 'En ligne', profilMisAJourLe: iso(c.profilMisAJourLe), derniereConnexionLe: iso(c.derniereConnexionLe) },
    },
    consentements: l.consentements.map((x) => ({ type: x.type, texte: CONSENTEMENTS[x.type]?.version === x.version ? CONSENTEMENTS[x.type].texte : null, version: x.version, canal: x.canal, ip: x.ip, horodatage: iso(x.horodatage) })),
    experiences: l.experiences.map((x) => ({ poste: x.poste, employeur: x.employeur, ville: x.ville, duree: x.duree, missions: x.missions })),
    documents: l.documents.map((x) => ({ categorie: x.categorie === 'cv' ? 'CV' : 'Justificatif', nom: x.nomOrigine, tailleOctets: x.taille, deposeLe: iso(x.creeLe) })),
    candidatures: l.candidatures.map((x) => ({ offre: x.offreTitre, lienOffre: `/recrutement/${x.offreSlug}`, motivation: x.motivation, statut: STATUTS_CANDIDATURE_CANDIDAT[x.statut], envoyeeLe: iso(x.creeLe) })),
    propositions: l.propositions.map((x) => ({
      poste: x.poste,
      client: x.client,
      statut: x.libelleStatut,
      secteur: x.secteur,
      ville: x.ville,
      typeContrat: x.typeContrat,
      salaire: x.salaire,
      recueLe: iso(x.creeLe),
      accord: x.accordMode ? { mode: MODES_ACCORD_CANDIDAT[x.accordMode], le: iso(x.accordLe), numeroCommunicable: x.numeroCommunicable } : null,
      reponseLe: iso(x.reponseLe),
      entretien: x.entretienLe || x.entretienLieu ? { le: iso(x.entretienLe), lieu: x.entretienLieu } : null,
    })),
    placements: l.placements.map((x) => ({ poste: x.poste, client: x.client, statut: STATUTS_PLACEMENT[x.statut], datePrevue: x.datePrevue, datePriseDePoste: x.datePriseDePoste, finLe: x.finLe })),
    notifications: l.notifications.map((x) => ({ titre: x.titre, texte: x.texte, recueLe: iso(x.creeLe), lueLe: iso(x.luLe) })),
  };
}

export type ExportDonnees = ReturnType<typeof construireExport>;

/** Nom du fichier téléchargé : « nexclean-mes-donnees-AAAA-MM-JJ.json » (jour à Douala). */
export function nomFichierExport(format: FormatExport, genereLe: Date): string {
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(genereLe);
  return `nexclean-mes-donnees-${jour}.${format}`;
}
