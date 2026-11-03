import { forbidden, notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { exigerCollaborateur } from '@/lib/authz/session';
import { peut } from '@/lib/authz/permissions';
import { lireCollaborateur } from '@/lib/collaborateurs/lecture';
import { lireAttributs } from '@/lib/collaborateurs/service';
import { getDb, schema } from '@/lib/db';
import { Pastille, TitrePage } from '@/components/backoffice/ui';
import Fiche from './Fiche';

export const metadata = { title: 'Collaborateur' };

export default async function PageCollaborateur({ params }: { params: Promise<{ id: string }> }) {
  const c = await exigerCollaborateur();
  const gerer = peut(c.roles, 'collaborateurs.gerer');
  const attributs = peut(c.roles, 'collaborateurs.attributs');
  if (!gerer && !attributs) forbidden();

  const { id } = await params;
  const u = await lireCollaborateur(id);
  if (!u) notFound();
  const [attr, villes] = await Promise.all([
    lireAttributs(id),
    getDb().select({ id: schema.ville.id, nom: schema.ville.nom }).from(schema.ville).where(eq(schema.ville.actif, true)).orderBy(asc(schema.ville.ordre), asc(schema.ville.nom)),
  ]);

  return (
    <>
      <TitrePage titre={u.nom} retour={{ href: '/admin/collaborateurs', libelle: 'Collaborateurs' }}>
        <div className="flex gap-1">
          {!u.actif && <Pastille ton="rouge">Désactivé</Pastille>}
          {u.actif && !u.active && <Pastille ton="orange">Activation en attente</Pastille>}
          {u.deuxFacteurs ? <Pastille ton="vert">2FA activée</Pastille> : <Pastille>Sans 2FA</Pastille>}
        </div>
      </TitrePage>
      <p className="text-sm text-ink-600 mb-4 break-all">{u.email}</p>
      <Fiche collaborateur={u} attributs={attr} villes={villes} droits={{ gerer, attributs }} estMoi={u.id === c.id} />
    </>
  );
}
