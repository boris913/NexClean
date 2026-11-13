// Raccordement d'un numéro WhatsApp à la Cloud API par l'inscription intégrée de Meta
// (Embedded Signup), en coexistence avec l'application WhatsApp Business (ADR 0025, option A).
//
// Le navigateur lance l'inscription (SDK JavaScript de Meta) et transmet au serveur le code
// d'échange (valable 30 s) et les identifiants reçus par message. Le serveur :
//  1. échange le code contre un jeton d'entreprise (jamais conservé, jamais renvoyé au navigateur) ;
//  2. abonne l'application au compte WhatsApp (webhooks) ;
//  3. relève les numéros du compte ;
//  4. en coexistence, demande la synchronisation des contacts puis de l'historique : Meta exige
//     ces deux demandes dans les 24 h suivant l'inscription, et chacune n'est possible qu'une fois.
// Le résultat est journalisé (`whatsapp.raccordement`) ; l'exploitation recopie ensuite les
// identifiants dans Coolify (docs/exploitation.md §9).
import { env } from '@/lib/env';
import { journaliser } from '@/lib/audit';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { identifiant, type NumeroRaccorde, type ResultatRaccordement, type SessionInscription } from '@/lib/whatsapp/inscription-meta';

export type { ResultatRaccordement, SessionInscription } from '@/lib/whatsapp/inscription-meta';
export { lireSessionInscription } from '@/lib/whatsapp/inscription-meta';


type Json = Record<string, unknown> & { error?: { message?: string; code?: number } };

async function graph(chemin: string, jeton: string, init?: { method: 'POST'; corps?: unknown }): Promise<Json> {
  const r = await fetch(`https://graph.facebook.com/${env().WHATSAPP_GRAPH_VERSION}/${chemin}`, {
    method: init?.method ?? 'GET',
    headers: { Authorization: `Bearer ${jeton}`, ...(init?.corps ? { 'Content-Type': 'application/json' } : {}) },
    body: init?.corps ? JSON.stringify(init.corps) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await r.json().catch(() => ({}))) as Json;
  // Erreur Meta affichée telle quelle à la Direction (aucun secret dans le message).
  if (!r.ok) throw new ErreurMetier(`Meta ${r.status}${json.error ? ` : ${json.error.code ?? ''} ${json.error.message ?? ''}` : ''}`.trim());
  return json;
}

/** Échange du code d'inscription contre un jeton d'entreprise (« business token »). */
async function echangerCode(code: string): Promise<string> {
  const { WHATSAPP_APP_ID: appId, WHATSAPP_APP_SECRET: secret, WHATSAPP_GRAPH_VERSION: version } = env();
  if (!appId || !secret) throw new ErreurMetier('WHATSAPP_APP_ID et WHATSAPP_APP_SECRET doivent être configurés.');
  const url = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
  url.search = new URLSearchParams({ client_id: appId, client_secret: secret, code }).toString();
  const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const json = (await r.json().catch(() => ({}))) as Json & { access_token?: string };
  if (!r.ok || !json.access_token) throw new ErreurMetier(`Échange du code refusé par Meta (${json.error?.message ?? r.status}). Le code n’est valable que 30 secondes : relancez l’inscription.`);
  return json.access_token;
}

/** Compte WhatsApp autorisé par le jeton, si la fenêtre d'inscription ne l'a pas transmis. */
async function wabaDuJeton(jeton: string): Promise<string | null> {
  const { WHATSAPP_APP_ID: appId, WHATSAPP_APP_SECRET: secret } = env();
  const r = await graph(`debug_token?input_token=${encodeURIComponent(jeton)}`, `${appId}|${secret}`);
  const portees = ((r.data as Json | undefined)?.granular_scopes ?? []) as { scope: string; target_ids?: string[] }[];
  return identifiant(portees.find((p) => p.scope === 'whatsapp_business_management')?.target_ids?.[0]) ?? null;
}

const messageErreur = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

export async function raccorderNumero(entree: { code: string; session: SessionInscription | null }, auteur: { id: string; ip?: string | null }): Promise<ResultatRaccordement> {
  const code = entree.code.trim();
  if (!/^[\w-]{10,2000}$/.test(code)) throw new ErreurMetier('Code d’inscription invalide.');
  const jeton = await echangerCode(code);
  const wabaId = entree.session?.wabaId ?? (await wabaDuJeton(jeton));
  if (!wabaId) throw new ErreurMetier('Meta n’a transmis aucun compte WhatsApp : relancez l’inscription jusqu’à l’écran final.');

  const abonnement = (await graph(`${wabaId}/subscribed_apps`, jeton, { method: 'POST' })).success === true;
  const liste = await graph(`${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,is_on_biz_app,platform_type`, jeton);
  const numeros: NumeroRaccorde[] = ((liste.data ?? []) as Record<string, unknown>[]).map((n) => ({
    id: String(n.id),
    numero: typeof n.display_phone_number === 'string' ? n.display_phone_number : null,
    nom: typeof n.verified_name === 'string' ? n.verified_name : null,
    coexistence: n.is_on_biz_app === true && n.platform_type === 'CLOUD_API',
    plateforme: typeof n.platform_type === 'string' ? n.platform_type : null,
  }));

  const synchronisations: ResultatRaccordement['synchronisations'] = [];
  if (entree.session?.issue === 'coexistence') {
    const cibles = numeros.filter((n) => n.coexistence || n.id === entree.session?.phoneNumberId);
    for (const n of cibles.length ? cibles : numeros) {
      // Ordre imposé par Meta : contacts d'abord, historique ensuite.
      for (const type of ['smb_app_state_sync', 'history'] as const) {
        try {
          const r = await graph(`${n.id}/smb_app_data`, jeton, { method: 'POST', corps: { messaging_product: 'whatsapp', sync_type: type } });
          synchronisations.push({ numero: n.id, type, requestId: typeof r.request_id === 'string' ? r.request_id : null, erreur: null });
        } catch (e) {
          synchronisations.push({ numero: n.id, type, requestId: null, erreur: messageErreur(e) });
        }
      }
    }
  }

  const resultat: ResultatRaccordement = { wabaId, numeros, abonnement, synchronisations };
  await journaliser({ acteurType: 'collaborateur', acteurId: auteur.id, action: 'whatsapp.raccordement', objetType: 'waba', objetId: wabaId, details: { issue: entree.session?.issue ?? null, ...resultat }, ip: auteur.ip ?? null });
  return resultat;
}
