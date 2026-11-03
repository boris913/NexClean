// MVP2-01 RG-06 : connexion des candidats par téléphone et mot de passe.
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { candidatConnecte } from '@/lib/candidats/session';
import Coque from '../Coque';
import FormulaireConnexion from './FormulaireConnexion';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Connexion candidat', robots: { index: false, follow: false } };

export default async function PageConnexion() {
  if (await candidatConnecte()) redirect('/candidat/espace');
  return (
    <Coque
      titre="Se connecter"
      intro={
        <p className="text-sm">
          Pas encore de compte ?{' '}
          <Link href="/candidat/inscription" className="text-primary underline font-semibold">
            Créer mon profil, c’est gratuit
          </Link>
        </p>
      }
    >
      <FormulaireConnexion />
    </Coque>
  );
}
