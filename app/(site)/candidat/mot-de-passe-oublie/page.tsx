// MVP2-01 RG-07 : mot de passe oublié.
// [À CONFIRMER : canal d'envoi réel du lien (WhatsApp ou e-mail)] : voir docs/contenu.md.
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import Coque from '../Coque';
import FormulaireOubli from './FormulaireOubli';

export const metadata: Metadata = pageMetadata({
  title: 'Mot de passe oublié',
  description: 'Réinitialisez le mot de passe de votre espace candidat NEXCLEAN.',
  path: '/candidat/mot-de-passe-oublie',
  noindex: true,
});

export default function PageMotDePasseOublie() {
  return (
    <Coque titre="Mot de passe oublié" intro={<p>Indiquez votre numéro de téléphone : nous vous envoyons un lien pour choisir un nouveau mot de passe.</p>}>
      <FormulaireOubli />
    </Coque>
  );
}
