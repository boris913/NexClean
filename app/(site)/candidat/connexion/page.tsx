// MVP2-01 RG-06 : connexion des candidats par téléphone et mot de passe.
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { candidatConnecte } from '@/lib/candidats/session';
import { pageMetadata } from '@/lib/seo';
import Coque from '../Coque';
import FormulaireConnexion from './FormulaireConnexion';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = pageMetadata({
  title: 'Connexion candidat',
  description: 'Connectez-vous à votre espace candidat NEXCLEAN avec votre numéro de téléphone et votre mot de passe.',
  path: '/candidat/connexion',
  noindex: true,
});

/** Retour après connexion (ex. fiche d'offre pour postuler, MVP2-02) : chemin interne du site seulement. */
const retourSur = (r: string | undefined) => (r && /^\/(recrutement|candidat\/espace)([/#?]|$)/.test(r) ? r : '/candidat/espace');

export default async function PageConnexion({ searchParams }: { searchParams: Promise<{ retour?: string }> }) {
  const retour = retourSur((await searchParams).retour);
  if (await candidatConnecte()) redirect(retour);
  return (
    <Coque
      titre="Accéder à mon espace candidat"
      intro={
        <>
          <p>Connectez-vous avec votre numéro de téléphone et votre mot de passe.</p>
          <p className="text-sm mt-2">
            Pas encore de compte ?{' '}
            <Link href="/candidat/inscription" className="text-primary underline font-semibold">
              Créer mon profil candidat
            </Link>
          </p>
        </>
      }
    >
      <FormulaireConnexion retour={retour} />
    </Coque>
  );
}
