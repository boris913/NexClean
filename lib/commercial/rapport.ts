// Rapport commercial hebdomadaire (specs/COM1-02 RG-09..11) — module pur : semaine couverte,
// contenu figé, texte de l'e-mail. RG-11 : ni salaire ni montant par client ; uniquement des
// agrégats, des numéros de dossier et des liens (connexion requise).
import { formaterMontant } from '@/lib/devis/domaine';
import { bornesAgenda, libelleDebut, partiesDouala, RDV_TYPES, type RdvType } from '@/lib/rendezvous/domaine';
import { ecart, libelleDuree, type Totaux, type Ventilation } from './indicateurs';

const HEURE_MS = 60 * 60 * 1000;
const JOUR_MS = 24 * HEURE_MS;
/** RG-09 : envoi le lundi à 7 h (heure de Douala). */
export const HEURE_ENVOI = 7;

export interface SemaineRapport {
  /** Lundi de la semaine écoulée, « AAAA-MM-JJ ». */
  semaine: string;
  du: Date;
  au: Date;
  /** Semaine d'avant, pour les écarts. */
  precedente: { du: Date; au: Date };
  /** Semaine qui commence (rendez-vous à venir). */
  suivante: { du: Date; au: Date };
}

/** Semaine écoulée (lundi → dimanche) dont le rapport est dû à `maintenant` ; null avant le lundi 7 h. */
export function semaineDue(maintenant: Date): SemaineRapport | null {
  const lundi = bornesAgenda('semaine', partiesDouala(maintenant).jour).du;
  if (maintenant.getTime() < lundi.getTime() + HEURE_ENVOI * HEURE_MS) return null;
  const du = new Date(lundi.getTime() - 7 * JOUR_MS);
  return {
    semaine: partiesDouala(du).jour,
    du,
    au: lundi,
    precedente: { du: new Date(du.getTime() - 7 * JOUR_MS), au: du },
    suivante: { du: lundi, au: new Date(lundi.getTime() + 7 * JOUR_MS) },
  };
}

export interface ContenuRapport {
  semaine: string;
  /** Dimanche de la semaine couverte. */
  fin: string;
  portee: 'direction' | 'referent';
  actuel: Totaux;
  precedent: Totaux;
  topSources: { libelle: string; nouveaux: number; acceptes: number }[];
  /** Demandes sans réponse depuis plus de 24 h. */
  enSouffrance: { dossierId: number; numero: string; ancienneteH: number }[];
  /** Dossiers sans action depuis `joursSansAction` jours ou plus. */
  sansAction: { dossierId: number; numero: string; jours: number }[];
  joursSansAction: number;
  /** Rendez-vous passés à clôturer. */
  aCloturer: { dossierId: number; numero: string; type: RdvType; debut: string }[];
  /** Rendez-vous de la semaine qui commence. */
  aVenir: { dossierId: number; numero: string; type: RdvType; debut: string; ville: string | null }[];
  /** COM3-01 : commentaire rédigé par l'IA, en complément des chiffres (jamais à leur place). */
  commentaire?: string | null;
}

export function topSources(ventilation: Ventilation[], n = 3): ContenuRapport['topSources'] {
  return ventilation
    .filter((v) => v.nouveaux > 0)
    .slice(0, n)
    .map((v) => ({ libelle: v.libelle, nouveaux: v.nouveaux, acceptes: v.devisAcceptes }));
}

const FORMAT_JOUR = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Douala', day: 'numeric', month: 'long' });
const jourLisible = (j: string) => FORMAT_JOUR.format(new Date(`${j}T12:00:00+01:00`));

export const titreRapport = (c: Pick<ContenuRapport, 'semaine' | 'fin'>) => `Rapport commercial du ${jourLisible(c.semaine)} au ${jourLisible(c.fin)}`;

/** « 12 (+20 %) », « 3 (=) », « 4 (nouveau) ». */
function avecEcart(actuel: number, precedent: number, format: (n: number) => string = String): string {
  const e = ecart(actuel, precedent);
  const suffixe = e === null ? 'nouveau' : e === 0 ? '=' : `${e > 0 ? '+' : ''}${e} %`;
  return `${format(actuel)} (${suffixe})`;
}

/** Lignes d'indicateurs, avec l'écart par rapport à la semaine précédente (RG-10). */
export function lignesIndicateurs(c: Pick<ContenuRapport, 'actuel' | 'precedent'>): [string, string][] {
  const { actuel: a, precedent: p } = c;
  return [
    ['Nouveaux prospects', avecEcart(a.nouveaux, p.nouveaux)],
    ['Devis envoyés', avecEcart(a.devisEnvoyes, p.devisEnvoyes)],
    ['Devis acceptés', avecEcart(a.devisAcceptes, p.devisAcceptes)],
    ['Taux de transformation', a.tauxTransformation === null ? '—' : `${a.tauxTransformation} %${p.tauxTransformation === null ? '' : ` (${p.tauxTransformation} % la semaine précédente)`}`],
    ['Prestations réalisées', avecEcart(a.prestationsRealisees, p.prestationsRealisees)],
    ['CA facturé TTC', avecEcart(a.facture, p.facture, formaterMontant)],
    ['CA encaissé', avecEcart(a.encaisse, p.encaisse, formaterMontant)],
    ['Délai moyen de 1re réponse', `${libelleDuree(a.delaiPremiereReponseMin)} (${libelleDuree(p.delaiPremiereReponseMin)} la semaine précédente)`],
    ['Demandes en attente', String(a.enAttente)],
    ['Sans réponse > 24 h', String(a.sansReponse)],
  ];
}

const liste = <T,>(titre: string, xs: T[], f: (x: T) => string, max = 10) =>
  xs.length ? [`\n${titre} :`, ...xs.slice(0, max).map((x) => `- ${f(x)}`), ...(xs.length > max ? [`- … et ${xs.length - max} autre(s)`] : [])] : [];

/** Corps texte de l'e-mail (la notification ajoute le lien vers le Back-Office). */
export function texteRapport(c: ContenuRapport): string {
  return [
    `${titreRapport(c)}${c.portee === 'referent' ? ' — vos dossiers' : ''}`,
    '',
    ...lignesIndicateurs(c).map(([k, v]) => `${k} : ${v}`),
    ...liste('Meilleures sources', c.topSources, (s) => `${s.libelle} : ${s.nouveaux} prospect(s), ${s.acceptes} accepté(s)`),
    ...liste('Demandes sans réponse depuis plus de 24 h', c.enSouffrance, (d) => `${d.numero} (${libelleDuree(d.ancienneteH * 60)})`),
    ...liste(`Dossiers sans action depuis ${c.joursSansAction} jours ou plus`, c.sansAction, (d) => `${d.numero} (${d.jours} j)`),
    ...liste('Rendez-vous à clôturer', c.aCloturer, (r) => `${r.numero} — ${RDV_TYPES[r.type]} du ${libelleDebut(new Date(r.debut))}`),
    ...liste('Rendez-vous de la semaine', c.aVenir, (r) => `${libelleDebut(new Date(r.debut))} — ${RDV_TYPES[r.type]} ${r.numero}${r.ville ? ` (${r.ville})` : ''}`, 20),
    ...(c.commentaire ? ['\nCommentaire :', c.commentaire] : []),
  ].join('\n');
}
