// ============================================================
// API CANDIDATURE — réception des candidatures avec CV.
//
// Variables d'environnement :
//   RESEND_API_KEY          Clé API Resend (https://resend.com) — requis pour l'envoi d'e-mails
//   RECRUITMENT_EMAIL       Destinataire des candidatures (défaut : CONTACT.email)
//   RECRUITMENT_FROM_EMAIL  Expéditeur vérifié dans Resend (ex. "NexClean <recrutement@nexclean.xyz>")
//   CANDIDATURE_WEBHOOK_URL Optionnel : webhook (ex. Google Apps Script → Google Sheets)
//                           pour consulter / filtrer / exporter les candidatures.
//
// Sans RESEND_API_KEY ni webhook, l'API répond 503 et le formulaire bascule sur WhatsApp.
// ============================================================

import { NextResponse } from 'next/server';
import { CONTACT } from '@/lib/constants';
import { JOB_CATEGORIES, CV_MAX_SIZE_MB } from '@/content/jobs-data';

export const runtime = 'nodejs';

const MAX_BYTES = CV_MAX_SIZE_MB * 1024 * 1024;

const TEXT_FIELDS = {
  lastName: { label: 'Nom', required: true, max: 80 },
  firstName: { label: 'Prénom', required: true, max: 80 },
  city: { label: 'Ville', required: true, max: 80 },
  district: { label: 'Quartier', required: true, max: 80 },
  phone: { label: 'Téléphone / WhatsApp', required: true, max: 30 },
  email: { label: 'E-mail', required: false, max: 120 },
  position: { label: 'Poste recherché', required: true, max: 80 },
  experience: { label: 'Expérience', required: true, max: 80 },
  availability: { label: 'Disponibilité', required: true, max: 80 },
  license: { label: 'Permis de conduire', required: false, max: 40 },
  source: { label: 'Comment nous avez-vous connus ?', required: false, max: 80 },
  message: { label: 'Message de motivation', required: false, max: 3000 },
} as const;

type FieldName = keyof typeof TEXT_FIELDS;

// Limitation de débit basique (par instance) contre les envois massifs.
const hits = new Map<string, number[]>();
function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 10;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Vérifie la signature binaire réelle du fichier (pas seulement l'extension). */
function detectCvType(name: string, bytes: Uint8Array): 'pdf' | 'docx' | null {
  const ext = name.toLowerCase().split('.').pop();
  const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04; // PK..
  if (ext === 'pdf' && isPdf) return 'pdf';
  if (ext === 'docx' && isZip) {
    // Un .docx est une archive ZIP contenant "word/" ; une macro (.docm) contiendrait vbaProject.bin.
    const content = new TextDecoder('latin1').decode(bytes);
    if (!content.includes('word/') || /vbaProject\.bin/i.test(content)) return null;
    return 'docx';
  }
  return null;
}

async function sendEmail(payload: Record<string, unknown>) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

export async function POST(req: Request) {
  const resendConfigured = !!process.env.RESEND_API_KEY;
  const webhookUrl = process.env.CANDIDATURE_WEBHOOK_URL;
  if (!resendConfigured && !webhookUrl) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'Trop de tentatives. Réessayez dans quelques minutes.' }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Formulaire invalide ou fichier trop volumineux.' }, { status: 400 });
  }

  // Pot de miel anti-spam : champ invisible pour les humains.
  if (String(form.get('website') || '').trim()) {
    return NextResponse.json({ ok: true, reference: 'NC-0' });
  }

  const data = {} as Record<FieldName, string>;
  for (const [name, rule] of Object.entries(TEXT_FIELDS) as [FieldName, (typeof TEXT_FIELDS)[FieldName]][]) {
    const value = String(form.get(name) || '').trim();
    if (rule.required && !value) {
      return NextResponse.json({ error: `Le champ « ${rule.label} » est obligatoire.` }, { status: 400 });
    }
    if (value.length > rule.max) {
      return NextResponse.json({ error: `Le champ « ${rule.label} » est trop long.` }, { status: 400 });
    }
    data[name] = value;
  }

  if (!(JOB_CATEGORIES as readonly string[]).includes(data.position)) {
    return NextResponse.json({ error: 'Poste invalide.' }, { status: 400 });
  }
  if (!/^\+?[\d\s.-]{8,20}$/.test(data.phone)) {
    return NextResponse.json({ error: 'Numéro de téléphone invalide.' }, { status: 400 });
  }
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return NextResponse.json({ error: 'Adresse e-mail invalide.' }, { status: 400 });
  }
  if (form.get('consent') !== 'on') {
    return NextResponse.json({ error: 'Le consentement est requis.' }, { status: 400 });
  }

  const cv = form.get('cv');
  if (!(cv instanceof File) || cv.size === 0) {
    return NextResponse.json({ error: 'Merci de joindre votre CV (PDF ou DOCX).' }, { status: 400 });
  }
  if (cv.size > MAX_BYTES) {
    return NextResponse.json({ error: `Le CV dépasse ${CV_MAX_SIZE_MB} Mo.` }, { status: 400 });
  }
  const bytes = new Uint8Array(await cv.arrayBuffer());
  const cvType = detectCvType(cv.name, bytes);
  if (!cvType) {
    return NextResponse.json({ error: 'Format de CV non accepté. Formats autorisés : PDF ou DOCX.' }, { status: 400 });
  }

  const reference = `NC-${Date.now().toString(36).toUpperCase()}`;
  const fullName = `${data.firstName} ${data.lastName}`;
  const safeFileName = `CV_${fullName.replace(/[^a-zA-Z0-9À-ÿ_-]+/g, '_').slice(0, 60)}.${cvType}`;
  const receivedAt = new Date().toISOString();

  try {
    if (webhookUrl) {
      // Pas de CV dans le webhook : uniquement les données (tableur filtrable / exportable).
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference, receivedAt, ...data }),
      });
    }

    if (resendConfigured) {
      const from = process.env.RECRUITMENT_FROM_EMAIL || 'NexClean Recrutement <onboarding@resend.dev>';
      const rows = (Object.keys(TEXT_FIELDS) as FieldName[])
        .filter((k) => data[k])
        .map(
          (k) =>
            `<tr><td style="padding:4px 12px 4px 0;color:#64748b;vertical-align:top">${TEXT_FIELDS[k].label}</td><td style="padding:4px 0;white-space:pre-wrap">${escapeHtml(data[k])}</td></tr>`
        )
        .join('');

      await sendEmail({
        from,
        to: [process.env.RECRUITMENT_EMAIL || CONTACT.email],
        reply_to: data.email || undefined,
        subject: `[Candidature] ${data.position} — ${fullName} — ${data.city} (${reference})`,
        html: `<h2>Nouvelle candidature ${reference}</h2><table>${rows}</table><p style="color:#64748b">Reçue le ${receivedAt}. Consentement à la conservation des données : oui.</p>`,
        attachments: [{ filename: safeFileName, content: Buffer.from(bytes).toString('base64') }],
      });

      if (data.email) {
        await sendEmail({
          from,
          to: [data.email],
          subject: 'NexClean — Nous avons bien reçu votre candidature',
          html: `<p>Bonjour ${escapeHtml(data.firstName)},</p><p>Nous avons bien reçu votre candidature pour le poste <strong>${escapeHtml(
            data.position
          )}</strong> (référence ${reference}).</p><p>Notre équipe l'étudiera avec attention et vous recontactera si votre profil correspond à nos besoins.</p><p>L'équipe NexClean</p>`,
        }).catch((e) => console.error('Accusé de réception non envoyé', e));
      }
    }
  } catch (e) {
    console.error('Erreur envoi candidature', e);
    return NextResponse.json({ error: 'send_failed' }, { status: 502 });
  }

  return NextResponse.json({ ok: true, reference });
}
