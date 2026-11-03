// Envoi du formulaire public « Demander du personnel » (MVP1-03 RG-03..09).
// Séparé de l'action serveur pour être testable sans requête HTTP.
import { and, eq, gte, sql } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { env } from '@/lib/env';
import { echapperHtml, envoyerEmail } from '@/lib/email';
import { lireParametre } from '@/lib/parametres';
import { formaterTelephone } from '@/lib/telephone';
import { creerDemande } from './service';
import {
  FORMULAIRE_PERSONNEL,
  MENTION_ESTIMATION,
  estimer,
  formaterFCFA,
  texteEstimation,
  totalPersonnes,
  validerDemandePersonnel,
  type Estimation,
} from './formulaire-personnel';

/** Limitation de débit par IP (§3 étape 4) : 10 envois par fenêtre de 10 minutes. */
export const MAX_ENVOIS_IP = 10;
export const FENETRE_ENVOIS_MS = 10 * 60 * 1000;
const ACTION_ENVOI = 'formulaire.envoi';

/** Texte de la case de consentement, conservé avec la Demande. */
export const TEXTE_CONSENTEMENT = 'J’accepte que NEXCLEAN traite ces informations pour répondre à ma demande et me contacte sur WhatsApp.';
export const DELAI_RAPPEL = 'Un conseiller vous contacte sous 24 h ouvrées.';

export type ResultatEnvoi =
  | { ok: true; numero: string; lienSuivi: string; estimation: Estimation; doublon: boolean }
  | { ok: false; erreur: string; erreurs?: Record<string, string> };

async function envoisRecents(ip: string): Promise<number> {
  const j = schema.journalAudit;
  const [r] = await getDb()
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(j)
    .where(and(eq(j.action, ACTION_ENVOI), eq(j.ip, ip), gte(j.horodatage, new Date(Date.now() - FENETRE_ENVOIS_MS))));
  return r?.n ?? 0;
}

async function nomsLieu(villeId: number | null, quartierId: number | null) {
  const db = getDb();
  const [v] = villeId ? await db.select({ nom: schema.ville.nom }).from(schema.ville).where(eq(schema.ville.id, villeId)) : [];
  const [q] = quartierId ? await db.select({ nom: schema.quartier.nom }).from(schema.quartier).where(eq(schema.quartier.id, quartierId)) : [];
  return { ville: v?.nom ?? null, quartier: q?.nom ?? null };
}

export async function soumettreDemandePersonnel(entree: unknown, ctx: { ip: string | null }): Promise<ResultatEnvoi> {
  const brut = (entree && typeof entree === 'object' ? entree : {}) as Record<string, unknown>;

  // Champ piège : invisible pour un humain, rempli par les robots.
  if (typeof brut.siteWeb === 'string' && brut.siteWeb.trim()) {
    await journaliser({ acteurType: 'anonyme', action: 'formulaire.robot', ip: ctx.ip, details: { formulaire: FORMULAIRE_PERSONNEL } });
    return { ok: false, erreur: 'Envoi refusé.' };
  }
  if (ctx.ip && (await envoisRecents(ctx.ip)) >= MAX_ENVOIS_IP) {
    return { ok: false, erreur: 'Trop d’envois depuis cette connexion. Réessayez dans quelques minutes ou envoyez votre demande sur WhatsApp.' };
  }
  await journaliser({ acteurType: 'anonyme', action: ACTION_ENVOI, ip: ctx.ip, details: { formulaire: FORMULAIRE_PERSONNEL } });

  const v = validerDemandePersonnel(brut);
  if (!v.ok) return { ok: false, erreur: 'Certains champs sont à corriger.', erreurs: v.erreurs };
  const d = v.donnees;

  // RG-05 / RG-06 : l'estimation est recalculée avec le tarif en vigueur et conservée dans la Demande.
  const commission = await lireParametre('commission_par_personne');
  const estimation = estimer(commission, totalPersonnes(d.lignes));
  const commissionAffichee = typeof brut.commissionAffichee === 'number' ? brut.commissionAffichee : null;
  const { consentement: _c, ...saisie } = d;

  const r = await creerDemande(
    {
      type: 'REC',
      canal: 'site',
      formulaire: FORMULAIRE_PERSONNEL,
      client: { type: d.clientType, nom: d.clientType === 'entreprise' && d.entreprise ? d.entreprise : d.contact, contact: d.contact, whatsapp: d.whatsapp!, autreTelephone: d.autreTelephone, email: d.email },
      villeId: d.villeId,
      villeAutre: d.villeId ? null : d.villeAutre,
      quartierId: d.quartierId,
      quartierAutre: d.quartierId ? null : d.quartierAutre,
      lieu: d.lieu,
      secteur: d.secteur,
      description: d.precisions,
      lignes: d.lignes.map((l) => ({
        intitule: l.intitule,
        nombre: l.nombre,
        missions: l.missions,
        competences: l.competences,
        experience: l.experience,
        salaire: l.salaire,
        typeContrat: l.typeContrat,
        duree: l.duree,
        horaires: l.horaires,
        joursRepos: l.joursRepos,
        avantages: l.avantages,
        datePriseFonction: l.datePriseFonction,
        desQuePossible: l.desQuePossible,
      })),
      donnees: {
        ...saisie,
        estimation: { ...estimation, ...(commissionAffichee !== null && commissionAffichee !== commission ? { commissionAffichee } : {}) },
        consentement: { accepte: true, texte: TEXTE_CONSENTEMENT },
      },
    },
    null,
  );

  const lienSuivi = `${env().BETTER_AUTH_URL}/suivi/${r.jetonSuivi}`;

  // RG-09 : accusé de réception par e-mail ; un échec n'annule pas la demande.
  if (d.email && !r.doublon) {
    try {
      const lieu = await nomsLieu(d.villeId, d.quartierId);
      await envoyerEmail(accuseReception({ email: d.email, contact: d.contact, numero: r.numero, lienSuivi, estimation, lignes: d.lignes, ville: lieu.ville ?? d.villeAutre, quartier: lieu.quartier ?? d.quartierAutre, whatsapp: d.whatsapp! }));
    } catch (e) {
      console.error('Accusé de réception non envoyé', e);
      await journaliser({ acteurType: 'systeme', action: 'email.echec', objetType: 'dossier', objetId: r.dossierId, details: { modele: 'accuse_demande_personnel' } });
    }
  }
  return { ok: true, numero: r.numero, lienSuivi, estimation, doublon: r.doublon };
}

function accuseReception(p: {
  email: string;
  contact: string;
  numero: string;
  lienSuivi: string;
  estimation: Estimation;
  lignes: { intitule: string; nombre: number; typeContrat: string }[];
  ville: string | null;
  quartier: string | null;
  whatsapp: string;
}) {
  const postes = p.lignes.map((l) => `${l.nombre} × ${l.intitule} (${l.typeContrat})`);
  const lieu = [p.quartier, p.ville].filter(Boolean).join(', ');
  const text = [
    `Bonjour ${p.contact},`,
    '',
    `Nous avons bien reçu votre demande de personnel n° ${p.numero}.`,
    '',
    ...postes.map((x) => `- ${x}`),
    lieu ? `Lieu : ${lieu}` : '',
    '',
    texteEstimation(p.estimation),
    MENTION_ESTIMATION,
    '',
    DELAI_RAPPEL + ` Nous vous écrirons sur WhatsApp au ${formaterTelephone(p.whatsapp)}.`,
    '',
    `Suivre votre demande : ${p.lienSuivi}`,
    '',
    'NEXCLEAN SARL',
  ]
    .filter((l, i, t) => l !== '' || t[i - 1] !== '')
    .join('\n');
  const h = echapperHtml;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1f2937;max-width:560px">
<p>Bonjour ${h(p.contact)},</p>
<p>Nous avons bien reçu votre demande de personnel <strong>n° ${h(p.numero)}</strong>.</p>
<ul>${postes.map((x) => `<li>${h(x)}</li>`).join('')}</ul>
${lieu ? `<p>Lieu : ${h(lieu)}</p>` : ''}
<p><strong>${h(texteEstimation(p.estimation))}</strong><br><span style="color:#6b7280">${h(MENTION_ESTIMATION)}</span></p>
<p>${h(DELAI_RAPPEL)} Nous vous écrirons sur WhatsApp au ${h(formaterTelephone(p.whatsapp))}.</p>
<p><a href="${h(p.lienSuivi)}" style="display:inline-block;background:#3d7a1e;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Suivre ma demande</a></p>
<p>NEXCLEAN SARL</p>
</div>`;
  return { to: p.email, subject: `Votre demande de personnel n° ${p.numero} — ${formaterFCFA(p.estimation.montant)} estimés`, text, html };
}
