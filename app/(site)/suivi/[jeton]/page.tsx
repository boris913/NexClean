// RG-24..29 : page de suivi client, sans compte, informations minimales, non indexée.
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Button from '@/components/ui/Button';
import { cardClasses } from '@/components/ui/Card';
import Section from '@/components/ui/Section';
import { ipDepuisEnTetes } from '@/lib/audit';
import { lireSuivi } from '@/lib/dossiers/service';
import { LIBELLE_CLIENT, phaseDe, type Phase } from '@/lib/dossiers/statuts';
import { DOSSIER_TYPES, FUSEAU } from '@/lib/domain/referentiels';
import { getWhatsAppLink } from '@/lib/constants';
import { blocageEnCours, chargerContexteSuivi, compterVisibles, estVerifie } from '@/lib/propositions/client';
import { devisEnvoyeExiste } from '@/lib/devis/client';
import SectionProfils from './SectionProfils';
import { SectionDevis, SectionDocuments } from './SectionDevis';
import { SectionPaiements } from './SectionPaiements';
import { FormulaireVerification } from './Interactions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Suivi de votre demande',
  referrer: 'no-referrer',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const ETAPES: Phase[] = ['nouveau', 'qualification', 'devis', 'accepte', 'execution', 'termine'];
const date = (d: Date) => new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, dateStyle: 'long' }).format(d);
const heure = (d: Date) => new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, hour: '2-digit', minute: '2-digit' }).format(d);

export default async function PageSuivi({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const vue = await lireSuivi(jeton, ipDepuisEnTetes(await headers()));

  if (!vue) {
    return (
      <Section tone="muted" spacing="sm" container="narrow" className="min-h-[70vh] text-center">
        <h1 className="font-display text-h2 text-ink-900 mb-3">Lien invalide ou expiré</h1>
        <p className="text-ink-600 mb-6">Contactez-nous sur WhatsApp en indiquant votre numéro de demande.</p>
        <Button href={getWhatsAppLink('Bonjour NEXCLEAN, je souhaite suivre ma demande.')} whatsappIcon>
          Nous écrire sur WhatsApp
        </Button>
      </Section>
    );
  }

  // Dossier de recrutement : devis (MVP2-04 RG-12), documents (RG-19) et profils transmis
  // (MVP2-03 RG-07), derrière une seule vérification des 4 chiffres pour toute la page.
  const ctx = vue.type === 'REC' ? await chargerContexteSuivi(jeton) : null;
  const [avecProfils, avecDevis, verifie] = ctx ? await Promise.all([compterVisibles(ctx).then((n) => n > 0), devisEnvoyeExiste(ctx), estVerifie(ctx)]) : [false, false, false];
  const bloque = ctx && !verifie ? await blocageEnCours(ctx.cle) : null;
  const objetVerification = [avecDevis && 'votre devis', 'vos documents', avecProfils && 'les profils proposés'].filter(Boolean).join(', ').replace(/, ([^,]*)$/, ' et $1');
  const phase = phaseDe(vue.statut);
  const rangActuel = ETAPES.indexOf(phase);
  return (
    <Section tone="muted" spacing="sm" container="narrow" className="min-h-[70vh]">
      <p className="text-sm text-muted mb-2">
        Dossier <span className="font-mono font-semibold text-ink-800">{vue.numero}</span> · Ce lien est personnel : ne le partagez pas.
      </p>
      <h1 className="font-display text-h2 text-ink-900 mb-3">{LIBELLE_CLIENT[phase]}</h1>
      <p className="text-ink-600 mb-6">
        Bonjour {vue.contact}. {DOSSIER_TYPES[vue.type]} — demande du {date(vue.creeLe)}, mise à jour le {date(vue.derniereActionLe)}.
      </p>
      {phase !== 'issue' && phase !== 'cloture' && (
        <ol className="space-y-3 mb-8">
          {ETAPES.map((e, i) => (
            <li key={e} className="flex items-center gap-3">
              <span aria-hidden className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${i < rangActuel ? 'bg-primary text-white' : i === rangActuel ? 'bg-cta text-ink-900 ring-4 ring-brand-100' : 'bg-ink-200 text-ink-700'}`}>
                {i < rangActuel ? '✓' : i + 1}
              </span>
              <span className={i === rangActuel ? 'font-semibold text-ink-900' : i < rangActuel ? 'text-ink-700' : 'text-muted'}>{LIBELLE_CLIENT[e]}</span>
              {i === rangActuel && <span className="sr-only">(étape actuelle)</span>}
            </li>
          ))}
        </ol>
      )}
      {ctx && !verifie && (
        <section aria-labelledby="section-verification" className={cardClasses({ padding: 'sm', className: 'mb-8' })}>
          <h2 id="section-verification" className="font-display text-h3 text-ink-900 mb-2">
            Vérification
          </h2>
          <p className="text-sm text-ink-600 mb-4">Pour protéger vos informations, confirmez votre identité avant d’afficher {objetVerification}.</p>
          <FormulaireVerification
            source="suivi"
            jeton={ctx.jeton}
            bloque={bloque ? `Trop d’essais. Réessayez après ${heure(bloque)} ou contactez NEXCLEAN sur WhatsApp.` : null}
            libelle={avecDevis ? 'Afficher mon devis' : 'Afficher mes documents'}
          />
        </section>
      )}
      {ctx && verifie && (
        <>
          <SectionDevis ctx={ctx} />
          <SectionPaiements ctx={ctx} />
          {avecProfils && <SectionProfils ctx={ctx} />}
          <SectionDocuments ctx={ctx} />
        </>
      )}
      <section aria-labelledby="section-question" className={cardClasses({ padding: 'sm' })}>
        <h2 id="section-question" className="font-display text-h3 text-ink-900 mb-3">
          Une question ?
        </h2>
        <Button href={getWhatsAppLink(`Bonjour NEXCLEAN, je vous contacte au sujet de ma demande n° ${vue.numero}.`)} whatsappIcon fullWidth>
          Écrire à mon référent
        </Button>
      </section>
    </Section>
  );
}
