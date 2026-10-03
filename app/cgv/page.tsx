import type { Metadata } from 'next';
import LegalPage from '@/components/ui/LegalPage';
import { COMPANY, CONTACT, PAYMENT_TERMS } from '@/lib/constants';
import { SHOP_INFO } from '@/content/products-data';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Conditions générales de vente',
  description: 'Conditions générales de vente des prestations, abonnements et produits NexClean.',
  path: '/cgv',
});

// ⚠️ Document à faire valider par la direction (et idéalement un juriste) avant publication définitive.
export default function CGVPage() {
  return (
    <LegalPage title="Conditions générales de vente" updated="octobre 2026">
      <p>
        Les présentes conditions s&apos;appliquent aux prestations de services, abonnements et ventes de produits proposés par{' '}
        {COMPANY.legalName}. Les conditions particulières figurant sur le devis ou le contrat prévalent sur les présentes.
      </p>

      <h2>1. Devis</h2>
      <p>
        Les tarifs affichés sur le site sont indicatifs. Le prix définitif est fixé par un devis établi après analyse du besoin
        (surface, état des lieux, accès, fréquence, moyens nécessaires). Le devis est gratuit.
      </p>

      <h2>2. Prestations ponctuelles</h2>
      <p>{PAYMENT_TERMS.ponctuel}</p>

      <h2>3. Abonnements</h2>
      <p>
        {PAYMENT_TERMS.abonnement} La fréquence, la durée, ainsi que les conditions de modification, de suspension et de
        résiliation sont précisées dans le contrat d&apos;abonnement.
      </p>

      <h2>4. Vente de produits</h2>
      <p>
        Les commandes sont passées via WhatsApp et confirmées par NexClean (disponibilité, prix, livraison). {PAYMENT_TERMS.produits}{' '}
        {SHOP_INFO.delivery}
      </p>

      <h2>5. Moyens de paiement</h2>
      <p>{PAYMENT_TERMS.methods.join(', ')}.</p>

      <h2>6. Report et annulation</h2>
      <p>
        Toute demande de report ou d&apos;annulation doit être signalée le plus tôt possible par WhatsApp ou téléphone. Les
        conditions applicables en cas d&apos;annulation tardive sont précisées sur le devis.
      </p>

      <h2>7. Réclamations</h2>
      <p>
        Toute réclamation concernant une prestation doit être signalée rapidement après l&apos;intervention, idéalement avec
        photos, au {CONTACT.phoneDisplay} ou à <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>. NexClean s&apos;engage
        à étudier chaque réclamation et à proposer une solution adaptée.
      </p>
    </LegalPage>
  );
}
