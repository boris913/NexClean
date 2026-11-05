// MVP2-01 RG-07 : nouveau mot de passe à partir d'un lien à usage unique (30 min).
import type { Metadata } from 'next';
import Link from 'next/link';
import { cardClasses } from '@/components/ui/Card';
import { lireJetonReinitialisation } from '@/lib/candidats/service';
import Coque from '../../Coque';
import FormulaireReinitialisation from './FormulaireReinitialisation';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Nouveau mot de passe', robots: { index: false, follow: false } };

export default async function PageReinitialiser({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const valide = await lireJetonReinitialisation(jeton);
  return (
    <Coque titre="Choisir un nouveau mot de passe" intro={valide ? <p>Bonjour {valide.prenom}, choisissez votre nouveau mot de passe.</p> : undefined}>
      {valide ? (
        <FormulaireReinitialisation jeton={jeton} />
      ) : (
        <div role="alert" className={cardClasses({ className: 'space-y-3' })}>
          <p className="text-ink-700">Lien invalide ou expiré.</p>
          <Link href="/candidat/mot-de-passe-oublie" className="text-primary underline">
            Refaire une demande
          </Link>
        </div>
      )}
    </Coque>
  );
}
