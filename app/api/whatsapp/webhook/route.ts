// COM2-01 RG-01, RG-02 : webhook WhatsApp Cloud API.
// GET : défi de vérification Meta. POST : signature vérifiée sur le corps brut AVANT toute lecture,
// stockage, réponse 200 immédiate ; le traitement suit la réponse (et la tâche planifiée reprend
// ce qui aurait échoué). Sans configuration (variables absentes) : 404.
import { after, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { journaliser } from '@/lib/audit';
import { signatureValide } from '@/lib/whatsapp/signature';
import { enregistrerWebhook, telechargerMediasEnAttente, traiterWebhooksEnAttente } from '@/lib/whatsapp/reception';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ipDe = (req: Request) => req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

export async function GET(req: Request) {
  const jeton = env().WHATSAPP_VERIFY_TOKEN;
  if (!jeton) return new NextResponse('Not found', { status: 404 });
  const p = new URL(req.url).searchParams;
  if (p.get('hub.mode') === 'subscribe' && p.get('hub.verify_token') === jeton) return new NextResponse(p.get('hub.challenge') ?? '', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(req: Request) {
  const secret = env().WHATSAPP_APP_SECRET;
  if (!secret) return new NextResponse('Not found', { status: 404 });
  const brut = await req.text();
  if (!signatureValide(brut, req.headers.get('x-hub-signature-256'), secret)) {
    await journaliser({ acteurType: 'systeme', action: 'whatsapp.signature_invalide', ip: ipDe(req), details: { taille: brut.length } });
    return new NextResponse('Unauthorized', { status: 401 });
  }
  let corps: unknown;
  try {
    corps = JSON.parse(brut);
  } catch {
    return new NextResponse('Bad request', { status: 400 });
  }
  await enregistrerWebhook(corps);
  after(async () => {
    try {
      await traiterWebhooksEnAttente();
      await telechargerMediasEnAttente();
    } catch (e) {
      console.error('[whatsapp] traitement différé', e);
    }
  });
  return new NextResponse('OK', { status: 200 });
}
