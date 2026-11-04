// RG-24..29 : page de suivi client, sans compte, informations minimales, non indexée.
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { ipDepuisEnTetes } from '@/lib/audit';
import { lireSuivi } from '@/lib/dossiers/service';
import { LIBELLE_CLIENT, phaseDe, type Phase } from '@/lib/dossiers/statuts';
import { DOSSIER_TYPES, FUSEAU } from '@/lib/domain/referentiels';
import { getWhatsAppLink } from '@/lib/constants';
import { chargerContexteSuivi, compterVisibles } from '@/lib/propositions/client';
import SectionProfils from './SectionProfils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Suivi de votre demande',
  referrer: 'no-referrer',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const ETAPES: Phase[] = ['nouveau', 'qualification', 'devis', 'accepte', 'execution', 'termine'];
const date = (d: Date) => new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, dateStyle: 'long' }).format(d);

export default async function PageSuivi({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const vue = await lireSuivi(jeton, ipDepuisEnTetes(await headers()));

  if (!vue) {
    return (
      <section className="max-w-lg mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-display font-semibold mb-3">Lien invalide ou expiré</h1>
        <p className="text-ink-600 mb-6">Contactez-nous sur WhatsApp en indiquant votre numéro de demande.</p>
        <a href={getWhatsAppLink('Bonjour NEXCLEAN, je souhaite suivre ma demande.')} className="inline-flex min-h-11 items-center px-5 rounded-full bg-cta font-semibold">
          Nous écrire sur WhatsApp
        </a>
      </section>
    );
  }

  // MVP2-03 RG-07 : profils transmis (dossier de recrutement), après vérification des 4 chiffres.
  const ctx = vue.type === 'REC' ? await chargerContexteSuivi(jeton) : null;
  const avecProfils = !!ctx && (await compterVisibles(ctx)) > 0;
  const phase = phaseDe(vue.statut);
  const rangActuel = ETAPES.indexOf(phase);
  return (
    <section className="max-w-lg mx-auto px-4 py-10">
      <p className="text-sm text-ink-500 mb-1">Demande n° <span className="font-mono font-semibold text-ink-800">{vue.numero}</span></p>
      <h1 className="text-2xl font-display font-semibold mb-1">{LIBELLE_CLIENT[phase]}</h1>
      <p className="text-ink-600 mb-6">
        Bonjour {vue.contact}. {DOSSIER_TYPES[vue.type]} — demande du {date(vue.creeLe)}, mise à jour le {date(vue.derniereActionLe)}.
      </p>
      {phase !== 'issue' && phase !== 'cloture' && (
        <ol className="space-y-3 mb-8">
          {ETAPES.map((e, i) => (
            <li key={e} className="flex items-center gap-3">
              <span aria-hidden className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${i < rangActuel ? 'bg-brand-500 text-white' : i === rangActuel ? 'bg-cta text-ink-900 ring-4 ring-brand-100' : 'bg-ink-100 text-ink-400'}`}>
                {i < rangActuel ? '✓' : i + 1}
              </span>
              <span className={i === rangActuel ? 'font-semibold' : i < rangActuel ? 'text-ink-700' : 'text-ink-400'}>{LIBELLE_CLIENT[e]}</span>
              {i === rangActuel && <span className="sr-only">(étape actuelle)</span>}
            </li>
          ))}
        </ol>
      )}
      {avecProfils && ctx && <SectionProfils ctx={ctx} />}
      <a href={getWhatsAppLink(`Bonjour NEXCLEAN, je vous contacte au sujet de ma demande n° ${vue.numero}.`)} className="inline-flex w-full justify-center min-h-11 items-center px-5 rounded-full bg-cta font-semibold">
        Écrire à NEXCLEAN sur WhatsApp
      </a>
    </section>
  );
}
