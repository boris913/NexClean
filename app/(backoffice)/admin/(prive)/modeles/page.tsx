// MVP1-05 RG-14..16 : bibliothèque de modèles de messages WhatsApp (Direction, Administrateur).
import { exigerCollaborateur } from '@/lib/authz/session';
import { listerModeles } from '@/lib/modeles/service';
import { TitrePage } from '@/components/backoffice/ui';
import EditeurModele from './EditeurModele';

export const metadata = { title: 'Modèles de messages' };

export default async function PageModeles() {
  await exigerCollaborateur({ permission: 'modeles.gerer' });
  const modeles = await listerModeles();
  return (
    <>
      <TitrePage titre="Modèles de messages WhatsApp" />
      <p className="text-sm text-ink-600 mb-4">
        Proposés dans chaque dossier (« Envoyer sur WhatsApp »). Le référent peut modifier le texte avant l’envoi ; aucun message n’est envoyé automatiquement.
      </p>
      <div className="space-y-3">
        <EditeurModele modele={null} />
        {modeles.map((m) => (
          <EditeurModele key={`${m.id}-${m.modifieLe.getTime()}`} modele={{ id: m.id, nom: m.nom, types: m.types, texte: m.texte, actif: m.actif }} />
        ))}
      </div>
    </>
  );
}
