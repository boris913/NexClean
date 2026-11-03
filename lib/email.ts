// Envoi d'e-mails transactionnels via Resend (ADR 0005).
import { env } from '@/lib/env';

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export const echapperHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Envoie un e-mail. Sans RESEND_API_KEY (développement), l'e-mail est affiché dans
 * la console au lieu d'être envoyé. 3 tentatives en cas d'erreur (M1-NOT RG-13).
 */
export async function envoyerEmail(email: Email): Promise<void> {
  const { RESEND_API_KEY, BACKOFFICE_FROM_EMAIL } = env();
  if (!RESEND_API_KEY) {
    console.info(`[email non envoyé — RESEND_API_KEY absente] À : ${email.to}\nObjet : ${email.subject}\n${email.text}`);
    return;
  }
  let derniereErreur: unknown;
  for (let tentative = 1; tentative <= 3; tentative++) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: BACKOFFICE_FROM_EMAIL, to: [email.to], subject: email.subject, html: email.html, text: email.text }),
      });
      if (res.ok) return;
      derniereErreur = new Error(`Resend ${res.status}: ${await res.text()}`);
    } catch (e) {
      derniereErreur = e;
    }
    await new Promise((r) => setTimeout(r, 500 * tentative));
  }
  throw derniereErreur;
}
