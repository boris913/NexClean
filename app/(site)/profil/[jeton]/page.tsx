// specs/MVP2-03 RG-10, RG-15 : lien d'accès temporaire à un profil précis ou à une attestation de
// prise de poste (7 jours, révocable), mêmes protections que la page de suivi. Non indexé.
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { ipDepuisEnTetes } from '@/lib/audit';
import { getWhatsAppLink } from '@/lib/constants';
import { FUSEAU } from '@/lib/domain/referentiels';
import { chargerContexteAcces, journaliserConsultationAcces } from '@/lib/propositions/client';
import SectionProfils from '../../suivi/[jeton]/SectionProfils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Profil transmis par NEXCLEAN',
  referrer: 'no-referrer',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const date = (d: Date) => new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, dateStyle: 'long' }).format(d);

export default async function PageAccesProfil({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const ctx = await chargerContexteAcces(jeton);

  if (!ctx) {
    return (
      <section className="max-w-lg mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-display font-semibold mb-3">Lien invalide ou expiré</h1>
        <p className="text-ink-600 mb-6">Ce lien n’est plus valable. Demandez un nouveau lien à votre référent NEXCLEAN.</p>
        <a href={getWhatsAppLink('Bonjour NEXCLEAN, le lien de profil que vous m’avez envoyé a expiré.')} className="inline-flex min-h-11 items-center px-5 rounded-full bg-cta font-semibold">
          Nous écrire sur WhatsApp
        </a>
      </section>
    );
  }

  await journaliserConsultationAcces(ctx, ipDepuisEnTetes(await headers()));
  const attestation = ctx.objet === 'attestation';
  return (
    <section className="max-w-lg mx-auto px-4 py-10">
      <p className="text-sm text-ink-500 mb-1">
        Demande n° <span className="font-mono font-semibold text-ink-800">{ctx.numero}</span>
      </p>
      <h1 className="text-2xl font-display font-semibold mb-1">{attestation ? 'Attestation de prise de poste' : 'Profil proposé par NEXCLEAN'}</h1>
      <p className="text-ink-600 mb-6">
        Lien réservé à {ctx.clientNom}, valable jusqu’au {date(ctx.expireLe!)}.
      </p>
      <SectionProfils ctx={ctx} titre={attestation ? 'Prise de poste' : 'Profil'} />
      <a href={getWhatsAppLink(`Bonjour NEXCLEAN, je vous contacte au sujet de ma demande n° ${ctx.numero}.`)} className="inline-flex w-full justify-center min-h-11 items-center px-5 rounded-full bg-cta font-semibold">
        Écrire à NEXCLEAN sur WhatsApp
      </a>
    </section>
  );
}
