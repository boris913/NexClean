// MVP2-04 RG-10 : pièces jointes des e-mails (PDF du devis) envoyées à Resend en base64.
import { afterEach, describe, expect, it, vi } from 'vitest';

process.env.DATABASE_URL ??= 'postgres://localhost/inutilise';
process.env.BETTER_AUTH_SECRET ??= 'secret-de-test-uniquement-0123456789abcdef';
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
process.env.RESEND_API_KEY = 're_test';

describe('envoyerEmail', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('joint les pièces en base64 (attachments Resend)', async () => {
    const appels = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', appels);
    const { envoyerEmail } = await import('@/lib/email');
    const pdf = new TextEncoder().encode('%PDF-1.4 test');
    await envoyerEmail({ to: 'client@exemple.cm', subject: 'Devis', html: '<p>x</p>', text: 'x', pieces: [{ nom: 'Devis-DEV-2026-00001-v1.pdf', contenu: pdf }] });
    const corps = JSON.parse(String((appels.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(corps.attachments).toEqual([{ filename: 'Devis-DEV-2026-00001-v1.pdf', content: Buffer.from(pdf).toString('base64') }]);
  });

  it('sans pièce jointe, aucun champ attachments', async () => {
    const appels = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', appels);
    const { envoyerEmail } = await import('@/lib/email');
    await envoyerEmail({ to: 'a@b.cm', subject: 's', html: 'h', text: 't' });
    const corps = JSON.parse(String((appels.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(corps).not.toHaveProperty('attachments');
  });
});
