// Écran Modèles : onglets « Messages WhatsApp » (MVP1-05) et « Documents PDF » (POST-05).
import { Onglets } from '@/components/backoffice/ui';

export default function OngletsModeles({ actif }: { actif: 'messages' | 'documents' }) {
  return (
    <Onglets
      libelle="Types de modèles"
      onglets={[
        { href: '/admin/modeles', libelle: 'Messages WhatsApp', actif: actif === 'messages' },
        { href: '/admin/modeles/documents', libelle: 'Documents PDF', actif: actif === 'documents' },
      ]}
    />
  );
}
