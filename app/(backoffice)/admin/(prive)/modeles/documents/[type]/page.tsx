// POST-05 : éditeur d'un modèle de document PDF (blocs, ordre des sections, aperçu, versions).
import { notFound } from 'next/navigation';
import { exigerCollaborateur } from '@/lib/authz/session';
import { formatHorodatage } from '@/lib/audit-lecture';
import { estTypeDocument, TYPES_DOCUMENT } from '@/lib/documents/personnalisation';
import { listerVersions } from '@/lib/documents/versions';
import { TitrePage } from '@/components/backoffice/ui';
import EditeurDocument from './EditeurDocument';

export const metadata = { title: 'Modèle de document' };
export const dynamic = 'force-dynamic';

export default async function PageModeleDocument({ params }: { params: Promise<{ type: string }> }) {
  await exigerCollaborateur({ permission: 'modeles.gerer' });
  const { type } = await params;
  if (!estTypeDocument(type)) notFound();
  const versions = await listerVersions(type);
  const courante = versions[0]!;
  return (
    <>
      <TitrePage titre={TYPES_DOCUMENT[type]} description="Modèle de document PDF" retour={{ href: '/admin/modeles/documents', libelle: 'Modèles de documents' }} />
      <EditeurDocument
        type={type}
        versionCourante={courante.version}
        contenu={courante.contenu}
        versions={versions.map((v) => ({ version: v.version, commentaire: v.commentaire, restaureDe: v.restaureDe, auteur: v.auteur, le: v.creeLe ? formatHorodatage(v.creeLe) : null }))}
      />
    </>
  );
}
