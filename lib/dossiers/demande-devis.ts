// Enregistrement des demandes de devis du site avant l'ouverture de WhatsApp (MVP1-04).
// Séparé de l'action serveur pour être testable sans requête HTTP.
import type { Attribution } from '@/lib/acquisition/source';
import { env } from '@/lib/env';
import { FORMULAIRES_DEVIS } from '@/components/forms/quote-forms';
import { creerDemande } from './service';
import { controlerEnvoi } from './anti-abus';
import { typeDossierPour, validerDevis } from './formulaire-devis';
import { TEXTE_CONSENTEMENT } from './demande-personnel';
import type { DossierType } from '@/lib/domain/referentiels';

export type ResultatDevis =
  | { ok: true; numero: string; lienSuivi: string; type: DossierType; doublon: boolean }
  | { ok: false; erreur: string; erreurs?: Record<string, string> };

/** Types de site « Espaces verts » qui désignent une organisation plutôt qu'un particulier. */
const SITES_ORGANISATION = ['Entreprise', 'Hôtel', 'Administration', 'Résidence'];

export async function soumettreDemandeDevis(entree: unknown, ctx: { ip: string | null; attribution?: Attribution | null }): Promise<ResultatDevis> {
  const brut = (entree && typeof entree === 'object' ? entree : {}) as Record<string, unknown>;
  const config = typeof brut.formId === 'string' ? FORMULAIRES_DEVIS[brut.formId] : undefined;
  if (!config) return { ok: false, erreur: 'Formulaire inconnu.' };

  const refus = await controlerEnvoi(config.formId, brut.siteWeb, ctx.ip);
  if (refus) return { ok: false, erreur: refus };

  const v = validerDevis(config, brut);
  if (!v.ok) return { ok: false, erreur: 'Certains champs sont à corriger.', erreurs: v.erreurs };
  const { valeurs, lieu, whatsapp } = v.donnees;
  const type = typeDossierPour(config.formId, valeurs);

  // Client : entreprise (devis pro, ou site d'organisation pour les espaces verts), sinon particulier.
  const client =
    config.formId === 'devis-pro'
      ? { type: 'entreprise' as const, nom: valeurs.company!, contact: valeurs.contact ?? null }
      : config.formId === 'devis-espaces-verts'
        ? { type: SITES_ORGANISATION.includes(valeurs.siteType ?? '') ? ('entreprise' as const) : ('particulier' as const), nom: valeurs.name!, contact: null }
        : { type: 'particulier' as const, nom: valeurs.name!, contact: valeurs.name! };

  const r = await creerDemande({
    type,
    canal: 'site',
    formulaire: config.formId,
    source: ctx.attribution?.premier.source ?? 'inconnue',
    attribution: ctx.attribution ?? null,
    client: { ...client, nom: client.nom.length >= 2 ? client.nom : `${client.nom} (client)`, whatsapp, autreTelephone: null, email: null },
    ...lieu,
    lieu: null,
    secteur: valeurs.sector ?? valeurs.siteType ?? valeurs.service ?? null,
    description: valeurs.need ?? valeurs.message ?? null,
    lignes: [],
    donnees: { formulaire: config.formId, sujet: config.subject, valeurs, lieu, consentement: { accepte: true, texte: TEXTE_CONSENTEMENT } },
  });
  return { ok: true, numero: r.numero, lienSuivi: `${env().BETTER_AUTH_URL}/suivi/${r.jetonSuivi}`, type, doublon: r.doublon };
}
