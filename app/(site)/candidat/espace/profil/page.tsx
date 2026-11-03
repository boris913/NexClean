// MVP2-01 RG-10 : modification de toutes les rubriques du profil.
import type { Metadata } from 'next';
import Link from 'next/link';
import { listesLieux } from '@/lib/geo/service';
import { lireParametre } from '@/lib/parametres';
import { lireEspace, versBrouillon } from '@/lib/candidats/service';
import { exigerCandidat } from '@/lib/candidats/session';
import Coque from '../../Coque';
import FormulaireCandidat from '../../FormulaireCandidat';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Modifier mon profil', robots: { index: false, follow: false } };

export default async function PageProfil() {
  const session = await exigerCandidat();
  const [espace, listes, metiers] = await Promise.all([lireEspace(session.id), listesLieux(), lireParametre('metiers')]);
  return (
    <Coque
      titre="Modifier mon profil"
      large
      intro={
        <p className="text-sm">
          <Link href="/candidat/espace" className="text-primary underline">
            ← Mon espace
          </Link>
        </p>
      }
    >
      <FormulaireCandidat mode="modification" listes={listes} metiers={metiers} initial={versBrouillon(espace)} />
    </Coque>
  );
}
