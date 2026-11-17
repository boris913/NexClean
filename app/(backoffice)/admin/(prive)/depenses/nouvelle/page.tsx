// POST-03 RG-01 : saisie d'une dépense (Responsable finances, Direction).
import Link from 'next/link';
import { exigerCollaborateur } from '@/lib/authz/session';
import { dateDuJour } from '@/lib/encaissements/domaine';
import { listerCategories, villesActives } from '@/lib/depenses/service';
import { Alerte, TitrePage } from '@/components/backoffice/ui';
import { FormulaireDepense } from '../Formulaire';

export const metadata = { title: 'Nouvelle dépense' };
export const dynamic = 'force-dynamic';

export default async function PageNouvelleDepense({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await exigerCollaborateur({ permission: 'depense.saisir' });
  const p = await searchParams;
  const [categories, villes] = await Promise.all([listerCategories({ actives: true }), villesActives()]);
  const aujourdhui = dateDuJour();
  const precedente = Number(p.enregistree) || null;
  return (
    <>
      <TitrePage titre="Nouvelle dépense" retour={{ href: '/admin/depenses', libelle: 'Dépenses' }} />
      {precedente && (
        <div className="mb-5">
          <Alerte type="succes">
            Dépense enregistrée. <Link href={`/admin/depenses/${precedente}`} className="font-semibold underline">La revoir</Link>
          </Alerte>
        </div>
      )}
      <FormulaireDepense
        // Nouvelle clé après chaque enregistrement : le formulaire repart vide.
        key={precedente ?? 'nouvelle'}
        aujourdhui={aujourdhui}
        categories={categories}
        villes={villes}
        depense={{ depenseLe: aujourdhui, categorieId: null, libelle: '', montant: null, moyen: 'especes', reference: null, villeId: null, dossierNumero: null, service: null, commentaire: null }}
      />
    </>
  );
}
