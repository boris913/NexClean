// Paramètres administrables par Direction / Administrateur (MVP1-03 RG-05).
// La grille tarifaire complète arrive en MVP-2 ; en MVP-1 la commission est un montant unique.
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import type { Auteur } from '@/lib/collaborateurs/service';
import { CONTACT } from '@/lib/constants';

/** ADR 0008 : 5 000 FCFA par personne placée. */
export const COMMISSION_PAR_DEFAUT = 5000;

export const METIERS_PAR_DEFAUT = [
  'Agent d’entretien',
  'Femme / homme de ménage',
  'Nounou',
  'Cuisinier(ère)',
  'Aide-cuisinier(ère)',
  'Serveur(se)',
  'Barman / barmaid',
  'Réceptionniste',
  'Femme / valet de chambre',
  'Gardien / vigile',
  'Chauffeur',
  'Livreur',
  'Caissier(ère)',
  'Vendeur(se)',
  'Magasinier',
  'Manutentionnaire',
  'Jardinier',
  'Secrétaire',
  'Assistant(e) administratif(ve)',
  'Commercial(e)',
  'Aide-soignant(e)',
  'Technicien de maintenance',
];

/** Mentions légales des documents (texte libre, à compléter par la Direction : RCCM, NIU…). */
export const MENTIONS_LEGALES_PAR_DEFAUT = `NEXCLEAN — ${CONTACT.address} — Tél. ${CONTACT.phoneDisplay} — ${CONTACT.email} — RCCM : à compléter — NIU : à compléter`;

/** Conditions générales du devis (texte administrable, ADR 0009, 0010, 0011). */
export const CONDITIONS_DEVIS_PAR_DEFAUT = [
  'L’acompte est payable à l’acceptation du devis ; la recherche démarre à son encaissement.',
  'Le délai de recherche court à compter de l’encaissement de l’acompte ; il peut être prolongé par avenant.',
  'Le montant final correspond à la commission indiquée multipliée par le nombre de placements confirmés (prise de poste attestée). Le solde est égal au montant final diminué de l’acompte ; un trop-perçu donne lieu à un avoir ou à un remboursement.',
  'Garantie de remplacement : si une personne placée quitte le poste pendant la période de garantie, NEXCLEAN propose un remplaçant sans commission supplémentaire.',
  'Tout candidat présenté par NEXCLEAN et embauché par le client dans les 6 mois suivant sa présentation donne lieu à la commission prévue.',
].join('\n');

const plage = z
  .object({ debut: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure invalide (HH:MM)'), fin: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure invalide (HH:MM)') })
  .refine((p) => p.debut < p.fin, 'L’heure de fin doit suivre l’heure de début');

/** Heures ouvrées par jour (0 = dimanche … 6 = samedi), fuseau Africa/Douala (MVP1-05 RG-07). */
export type HeuresOuvrees = ({ debut: string; fin: string } | null)[];
export const HEURES_OUVREES_PAR_DEFAUT: HeuresOuvrees = [
  null,
  { debut: '07:00', fin: '19:00' },
  { debut: '07:00', fin: '19:00' },
  { debut: '07:00', fin: '19:00' },
  { debut: '07:00', fin: '19:00' },
  { debut: '07:00', fin: '19:00' },
  { debut: '08:00', fin: '17:00' },
];

export const WA_ACCUSE_OUVERT = 'Bonjour, merci pour votre message ! NEXCLEAN a bien reçu votre demande (dossier {numero}). Un conseiller vous répond dans les plus brefs délais. Nos horaires : {horaires}.';
export const WA_ACCUSE_FERME = 'Bonjour, merci pour votre message ! NEXCLEAN a bien reçu votre demande (dossier {numero}). Nous sommes actuellement fermés : nous vous répondons dès {ouverture}. Nos horaires : {horaires}.';
export const WA_REPONSES_RAPIDES = [
  { mots: ['horaire', 'horaires', 'ouvert', 'heure d ouverture'], reponse: 'Nos horaires : {horaires}.' },
  { mots: ['zone', 'zones', 'ville', 'quartier', 'vous intervenez'], reponse: 'Nous intervenons à {zones}. Indiquez-nous votre quartier pour confirmer.' },
  { mots: ['service', 'services', 'prestations', 'que faites vous'], reponse: 'Nos services : {services}. Dites-nous ce dont vous avez besoin !' },
  { mots: ['suivi', 'mon dossier', 'ou en est', 'avancement'], reponse: 'Suivez votre dossier {numero} ici : {suivi}' },
];

const DEFINITIONS = {
  heures_ouvrees: { defaut: HEURES_OUVREES_PAR_DEFAUT, schema: z.array(plage.nullable()).length(7) },
  /** RG-06 : délai avant escalade d'un dossier non attribué, en heures ouvrées. */
  delai_escalade_heures: { defaut: 4, schema: z.number().int('Nombre entier').min(1).max(72) },
  /** RG-11 : dossier « sans action » au-delà de ce nombre de jours. */
  jours_sans_action: { defaut: 3, schema: z.number().int('Nombre entier').min(1).max(60) },
  /** MVP2-03 RG-18 : garantie de remplacement, en jours après la prise de poste. */
  garantie_jours: { defaut: 15, schema: z.number().int('Nombre entier').min(0).max(180) },
  /** MVP2-03 RG-20 (ADR 0010) : délai de recherche par défaut, en jours après l’acompte. */
  delai_recherche_jours: { defaut: 30, schema: z.number().int('Nombre entier').min(1).max(365) },
  commission_par_personne: { defaut: COMMISSION_PAR_DEFAUT, schema: z.number().int('Montant entier').min(0).max(1_000_000) },
  // ─── Grille tarifaire et documents (MVP2-04 RG-01) ───
  /** Commission par catégorie de poste (intitulé → montant HT), facultative. */
  commissions_par_categorie: { defaut: {} as Record<string, number>, schema: z.record(z.string().trim().min(2).max(80), z.number().int('Montant entier').min(0).max(1_000_000)) },
  /** Taux de TVA en % ; 0 = « TVA non applicable » (en attendant QO-2). */
  tva_taux: { defaut: 0, schema: z.number().int('Pourcentage entier').min(0).max(100) },
  acompte_taux_defaut: { defaut: 50, schema: z.number().int('Pourcentage entier').min(0).max(100) },
  acompte_bornes: {
    defaut: { min: 30, max: 100 },
    schema: z.object({ min: z.number().int().min(0).max(100), max: z.number().int().min(0).max(100) }).refine((b) => b.min <= b.max, 'La borne minimale doit être inférieure ou égale à la borne maximale'),
  },
  /** MVP2-05 RG-09 : relance d'une facture de solde impayée, en jours après émission (puis tous les 7 jours). */
  delai_relance_solde_jours: { defaut: 15, schema: z.number().int('Nombre entier').min(1).max(180) },
  validite_devis_jours: { defaut: 15, schema: z.number().int('Nombre entier').min(1).max(180) },
  mentions_legales: { defaut: MENTIONS_LEGALES_PAR_DEFAUT, schema: z.string().trim().min(10).max(1000) },
  conditions_devis: { defaut: CONDITIONS_DEVIS_PAR_DEFAUT, schema: z.string().trim().min(10).max(5000) },
  /** QO-3 : minimum de facturation — prévu, non appliqué (null = désactivé). */
  minimum_facturation: { defaut: null as number | null, schema: z.number().int().min(0).max(10_000_000).nullable() },
  // ─── WhatsApp, réponses automatiques (COM2-02 RG-06..10) ───
  /** Accusé de réception pendant les heures ouvrées. Variables : {numero}, {horaires}. */
  wa_accuse_ouvert: { defaut: WA_ACCUSE_OUVERT, schema: z.string().trim().min(10).max(1000) },
  /** Accusé hors heures ouvrées. Variables : {numero}, {ouverture}, {horaires}. */
  wa_accuse_ferme: { defaut: WA_ACCUSE_FERME, schema: z.string().trim().min(10).max(1000) },
  /** Réponses rapides par mots-clés. Variables : {horaires}, {zones}, {services}, {suivi}, {numero}. Jamais de prix. */
  wa_reponses_rapides: { defaut: WA_REPONSES_RAPIDES, schema: z.array(z.object({ mots: z.array(z.string().trim().min(2).max(40)).min(1).max(20), reponse: z.string().trim().min(5).max(1000) })).max(30) },
  /** RG-08 : suspension des réponses automatiques après une réponse humaine, en heures. */
  wa_suspension_heures: { defaut: 12, schema: z.number().int('Nombre entier').min(0).max(168) },
  /** RG-10 : modèles marketing par client et par semaine. */
  wa_plafond_marketing_semaine: { defaut: 1, schema: z.number().int('Nombre entier').min(0).max(14) },
  /** COM3-02 RG-08 : mise en service progressive de l'agent (décision Direction, journalisée). */
  mode_agent: { defaut: 'desactive' as 'desactive' | 'fantome' | 'hors_heures' | 'permanent', schema: z.enum(['desactive', 'fantome', 'hors_heures', 'permanent']) },
  metiers: {
    defaut: METIERS_PAR_DEFAUT,
    schema: z.array(z.string().trim().min(2).max(80)).max(200).transform((l) => [...new Set(l)]),
  },
} as const;

export type CleParametre = keyof typeof DEFINITIONS;
type Valeur<K extends CleParametre> = z.output<(typeof DEFINITIONS)[K]['schema']>;

export async function lireParametre<K extends CleParametre>(cle: K): Promise<Valeur<K>> {
  const [ligne] = await getDb().select({ valeur: schema.parametre.valeur }).from(schema.parametre).where(eq(schema.parametre.cle, cle));
  if (!ligne) return DEFINITIONS[cle].defaut as Valeur<K>;
  const lu = DEFINITIONS[cle].schema.safeParse(ligne.valeur);
  return (lu.success ? lu.data : DEFINITIONS[cle].defaut) as Valeur<K>;
}

/** Le contrôle des droits (tarifs.modifier) est fait par l'appelant. */
export async function definirParametre<K extends CleParametre>(cle: K, valeur: unknown, auteur: Auteur): Promise<void> {
  const nouvelle = DEFINITIONS[cle].schema.parse(valeur);
  await getDb().transaction(async (tx) => {
    const [avant] = await tx.select().from(schema.parametre).where(eq(schema.parametre.cle, cle)).for('update');
    await tx
      .insert(schema.parametre)
      .values({ cle, valeur: nouvelle, modifieLe: new Date(), modifiePar: auteur.id })
      .onConflictDoUpdate({ target: schema.parametre.cle, set: { valeur: nouvelle, modifieLe: new Date(), modifiePar: auteur.id } });
    // MVP2-04 RG-01 : historique (valeur, date d'effet, auteur). Effet immédiat, pour les nouveaux devis (RG-02).
    await tx.insert(schema.parametreHistorique).values({ cle, valeur: nouvelle, auteurId: auteur.id ?? null });
    await journaliser(
      { acteurType: auteur.id ? 'collaborateur' : 'systeme', acteurId: auteur.id, ip: auteur.ip ?? null, action: 'parametre.modifie', objetType: 'parametre', objetId: cle, avant: avant?.valeur ?? DEFINITIONS[cle].defaut, apres: nouvelle },
      tx,
    );
  });
}
