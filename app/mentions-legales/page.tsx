import type { Metadata } from 'next';
import LegalPage from '@/components/ui/LegalPage';
import { COMPANY, CONTACT } from '@/lib/constants';
import { SITE_URL, pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Mentions légales',
  description: 'Mentions légales du site nexclean.xyz édité par NEXCLEAN SARL.',
  path: '/mentions-legales',
});

export default function MentionsLegalesPage() {
  return (
    <LegalPage title="Mentions légales" updated="octobre 2026">
      <h2>Éditeur du site</h2>
      <p>
        Le site <a href={SITE_URL}>{SITE_URL.replace('https://', '')}</a> est édité par <strong>{COMPANY.legalName}</strong>,
        société à responsabilité limitée de droit camerounais.
      </p>
      <ul>
        <li>Siège : {CONTACT.address}</li>
        {COMPANY.rccm && <li>RCCM : {COMPANY.rccm}</li>}
        {COMPANY.niu && <li>NIU : {COMPANY.niu}</li>}
        {COMPANY.director && <li>Directeur de la publication : {COMPANY.director}</li>}
        <li>Téléphone : {CONTACT.phoneDisplay}</li>
        <li>E-mail : <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></li>
      </ul>

      <h2>Hébergement</h2>
      <p>Le site est hébergé par Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis — vercel.com.</p>

      <h2>Propriété intellectuelle</h2>
      <p>
        Les contenus du site (textes, logos, photographies, visuels) sont la propriété de {COMPANY.legalName} ou utilisés avec
        autorisation. Toute reproduction sans accord préalable est interdite.
      </p>

      <h2>Informations commerciales</h2>
      <p>
        Les tarifs affichés sont indicatifs et ne constituent pas une offre ferme. Seul le devis remis au client engage{' '}
        {COMPANY.legalName}. Voir les <a href="/cgv">conditions générales de vente</a>.
      </p>

      <h2>Données personnelles</h2>
      <p>
        Le traitement des données personnelles est décrit dans notre <a href="/confidentialite">politique de confidentialité</a>.
      </p>
    </LegalPage>
  );
}
