// Inscription intégrée Meta (ADR 0025) : lecture des messages de la fenêtre d'inscription et
// types du résultat. Module pur, utilisable dans le navigateur et testé unitairement.

export type IssueInscription = 'coexistence' | 'nouveau_numero' | 'compte_seul' | 'annule' | 'erreur';

export interface SessionInscription {
  issue: IssueInscription;
  wabaId: string | null;
  phoneNumberId: string | null;
  /** Étape de l'annulation, ou code et identifiant de session d'une erreur. */
  detail: string | null;
}

const EVENEMENTS: Record<string, IssueInscription> = {
  FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING: 'coexistence',
  FINISH: 'nouveau_numero',
  FINISH_ONLY_WABA: 'compte_seul',
  FINISH_GRANT_ONLY_API_ACCESS: 'compte_seul',
  CANCEL: 'annule',
  ERROR: 'erreur',
};

export const identifiant = (x: unknown) => (typeof x === 'string' && /^\d{5,25}$/.test(x) ? x : null);

/**
 * Lit un message `postMessage` de la fenêtre d'inscription Meta. Renvoie `null` pour tout ce qui
 * n'en est pas un (autres messages du SDK, chaînes non JSON…). Module pur, testé unitairement.
 */
export function lireSessionInscription(brut: unknown): SessionInscription | null {
  let m: unknown = brut;
  if (typeof brut === 'string') {
    try {
      m = JSON.parse(brut);
    } catch {
      return null;
    }
  }
  if (!m || typeof m !== 'object') return null;
  const o = m as { type?: unknown; event?: unknown; data?: Record<string, unknown> };
  if (o.type !== 'WA_EMBEDDED_SIGNUP' || typeof o.event !== 'string') return null;
  const issue = EVENEMENTS[o.event];
  if (!issue) return null;
  const d = o.data ?? {};
  const detail = issue === 'annule' ? (typeof d.current_step === 'string' ? d.current_step : null) : issue === 'erreur' ? [d.error_code, d.error_message, d.session_id].filter(Boolean).join(' · ') || null : null;
  return { issue, wabaId: identifiant(d.waba_id), phoneNumberId: identifiant(d.phone_number_id), detail };
}

export interface NumeroRaccorde {
  id: string;
  numero: string | null;
  nom: string | null;
  /** Coexistence confirmée par Meta : `is_on_biz_app` et `platform_type = CLOUD_API`. */
  coexistence: boolean;
  plateforme: string | null;
}

export interface ResultatRaccordement {
  wabaId: string;
  numeros: NumeroRaccorde[];
  abonnement: boolean;
  /** Identifiants des demandes de synchronisation (à fournir au support Meta en cas de souci). */
  synchronisations: { numero: string; type: 'smb_app_state_sync' | 'history'; requestId: string | null; erreur: string | null }[];
}
