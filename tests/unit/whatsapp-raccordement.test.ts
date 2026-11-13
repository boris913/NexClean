// ADR 0025 (option A) : raccordement par l'inscription intégrée Meta (coexistence).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lireSessionInscription } from '@/lib/whatsapp/inscription-meta';

process.env.DATABASE_URL ??= 'postgres://localhost/inutilise';
process.env.BETTER_AUTH_SECRET ??= 'secret-de-test-uniquement-0123456789abcdef';
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';

const { journal } = vi.hoisted(() => ({ journal: vi.fn() }));
vi.mock('@/lib/audit', () => ({ journaliser: (e: unknown) => journal(e) }));

describe('inscription Meta : messages de la fenêtre', () => {
  it('coexistence, nouveau numéro, annulation, erreur', () => {
    expect(lireSessionInscription(JSON.stringify({ type: 'WA_EMBEDDED_SIGNUP', event: 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING', data: { waba_id: '1234567890' } }))).toEqual({ issue: 'coexistence', wabaId: '1234567890', phoneNumberId: null, detail: null });
    expect(lireSessionInscription({ type: 'WA_EMBEDDED_SIGNUP', event: 'FINISH', data: { waba_id: '111111', phone_number_id: '222222' } })).toMatchObject({ issue: 'nouveau_numero', phoneNumberId: '222222' });
    expect(lireSessionInscription({ type: 'WA_EMBEDDED_SIGNUP', event: 'CANCEL', data: { current_step: 'PHONE_NUMBER_SETUP' } })).toMatchObject({ issue: 'annule', detail: 'PHONE_NUMBER_SETUP' });
    expect(lireSessionInscription({ type: 'WA_EMBEDDED_SIGNUP', event: 'ERROR', data: { error_code: '524126', session_id: 'abc' } })).toMatchObject({ issue: 'erreur', detail: '524126 · abc' });
  });

  it('ignore les autres messages et les identifiants douteux', () => {
    expect(lireSessionInscription('pas du json')).toBeNull();
    expect(lireSessionInscription({ type: 'AUTRE', event: 'FINISH' })).toBeNull();
    expect(lireSessionInscription({ type: 'WA_EMBEDDED_SIGNUP', event: 'INCONNU' })).toBeNull();
    expect(lireSessionInscription({ type: 'WA_EMBEDDED_SIGNUP', event: 'FINISH', data: { waba_id: '../me', phone_number_id: 42 } })).toMatchObject({ wabaId: null, phoneNumberId: null });
  });
});

describe('raccorderNumero', () => {
  const appels: { url: string; methode: string; corps: unknown; auth: string | null }[] = [];
  beforeEach(() => {
    process.env.WHATSAPP_APP_ID = '2403467077150693';
    process.env.WHATSAPP_APP_SECRET = '0123456789abcdef0123456789abcdef';
    appels.length = 0;
    journal.mockReset();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (entree: string | URL, init?: RequestInit) => {
        const url = String(entree);
        appels.push({ url, methode: init?.method ?? 'GET', corps: init?.body ? JSON.parse(String(init.body)) : null, auth: new Headers(init?.headers).get('authorization') });
        const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status });
        if (url.includes('/oauth/access_token')) return url.includes('code=perime') ? json({ error: { message: 'expired' } }, 400) : json({ access_token: 'JETON_ENTREPRISE', token_type: 'bearer' });
        if (url.includes('/debug_token')) return json({ data: { granular_scopes: [{ scope: 'whatsapp_business_management', target_ids: ['9988776655'] }] } });
        if (url.endsWith('/subscribed_apps')) return json({ success: true });
        if (url.includes('/phone_numbers')) return json({ data: [{ id: '5551112223', display_phone_number: '+237 6 96 37 04 79', verified_name: 'NEXCLEAN', is_on_biz_app: true, platform_type: 'CLOUD_API' }] });
        if (url.endsWith('/smb_app_data')) return (init?.body as string).includes('history') ? json({ error: { code: 2593109, message: 'refusé' } }, 400) : json({ request_id: 'req-1' });
        return json({}, 404);
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('coexistence : échange, abonnement, numéros, synchronisations dans l’ordre ; jeton jamais journalisé', async () => {
    const { raccorderNumero } = await import('@/lib/whatsapp/raccordement');
    const r = await raccorderNumero({ code: 'AQBcodeValide-123', session: { issue: 'coexistence', wabaId: '1234567890', phoneNumberId: null, detail: null } }, { id: 'u1' });
    expect(r).toMatchObject({ wabaId: '1234567890', abonnement: true, numeros: [{ id: '5551112223', coexistence: true }] });
    expect(r.synchronisations).toEqual([
      { numero: '5551112223', type: 'smb_app_state_sync', requestId: 'req-1', erreur: null },
      { numero: '5551112223', type: 'history', requestId: null, erreur: expect.stringMatching(/2593109/) },
    ]);
    expect(appels.map((a) => `${a.methode} ${new URL(a.url).pathname.replace(/^\/v[\d.]+/, '')}`)).toEqual(['GET /oauth/access_token', 'POST /1234567890/subscribed_apps', 'GET /1234567890/phone_numbers', 'POST /5551112223/smb_app_data', 'POST /5551112223/smb_app_data']);
    expect(appels.slice(1).every((a) => a.auth === 'Bearer JETON_ENTREPRISE')).toBe(true);
    expect(journal).toHaveBeenCalledWith(expect.objectContaining({ action: 'whatsapp.raccordement', objetId: '1234567890' }));
    expect(JSON.stringify(journal.mock.calls)).not.toContain('JETON_ENTREPRISE');
  });

  it('sans identifiant de compte transmis : relu dans le jeton ; nouveau numéro sans synchronisation', async () => {
    const { raccorderNumero } = await import('@/lib/whatsapp/raccordement');
    const r = await raccorderNumero({ code: 'AQBcodeValide-123', session: null }, { id: 'u1' });
    expect(r.wabaId).toBe('9988776655');
    expect(r.synchronisations).toEqual([]);
  });

  it('code expiré ou invalide : erreur explicite, rien d’autre n’est appelé', async () => {
    const { raccorderNumero } = await import('@/lib/whatsapp/raccordement');
    await expect(raccorderNumero({ code: 'perime-0123456789', session: null }, { id: 'u1' })).rejects.toThrow(/30 secondes/);
    await expect(raccorderNumero({ code: 'x y', session: null }, { id: 'u1' })).rejects.toThrow(/invalide/);
    expect(appels).toHaveLength(1);
    expect(journal).not.toHaveBeenCalled();
  });
});
