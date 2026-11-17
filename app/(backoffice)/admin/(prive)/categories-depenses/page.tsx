// POST-03 RG-02 : catégories de dépenses, paramétrables par la Direction (et l'Administrateur).
import { exigerCollaborateur } from '@/lib/authz/session';
import { listerCategories } from '@/lib/depenses/service';
import { Carte, TitrePage } from '@/components/backoffice/ui';
import { GestionCategories } from './Categories';

export const metadata = { title: 'Catégories de dépenses' };
export const dynamic = 'force-dynamic';

export default async function PageCategoriesDepenses() {
  await exigerCollaborateur({ permission: 'depense.categories' });
  const categories = await listerCategories();
  return (
    <>
      <TitrePage titre="Catégories de dépenses" description="Proposées à la saisie des dépenses, dans l’ordre indiqué. Une catégorie déjà utilisée se désactive (les dépenses existantes la gardent) ; seule une catégorie jamais utilisée peut être supprimée." />
      <Carte>
        <GestionCategories categories={categories} />
      </Carte>
    </>
  );
}
