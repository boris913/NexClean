// MVP2-01 RG-07 : nouveau mot de passe à partir d'un lien à usage unique (30 min).
import type { Metadata } from 'next';
import Link from 'next/link';
import { lireJetonReinitialisation } from '@/lib/candidats/service';
import Coque from '../../Coque';
import FormulaireReinitialisation from './FormulaireReinitialisation';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Nouveau mot de passe', robots: { index: false, follow: false } };

export default async function PageReinitialiser({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const valide = await lireJetonReinitialisation(jeton);
  return (
    <Coque titre="Nouveau mot de passe" intro={valide ? <p>Bonjour {valide.prenom}, choisissez votre nouveau mot de passe.</p> : undefined}>
      {valide ? (
        <FormulaireReinitialisation jeton={jeton} />
      ) : (
        <div role="alert" className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 space-y-3">
          <p className="text-slate-700">Lien invalide ou expiré.</p>
          <Link href="/candidat/mot-de-passe-oublie" className="text-primary underline">
            Refaire une demande
          </Link>
        </div>
      )}
    </Coque>
  );
}
