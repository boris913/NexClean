// COM1-02 RG-09 : rapports hebdomadaires consultables (Direction : vue globale ; référent : ses dossiers).
import Link from 'next/link';
import { ChevronRight, FileBarChart } from 'lucide-react';
import { exigerCollaborateur } from '@/lib/authz/session';
import { peut } from '@/lib/authz/permissions';
import { listerRapports } from '@/lib/commercial/rapport-service';
import { titreRapport } from '@/lib/commercial/rapport';
import { formaterMontant } from '@/lib/devis/domaine';
import { classeSurface, EtatVide, TitrePage } from '@/components/backoffice/ui';

export const metadata = { title: 'Rapports hebdomadaires' };

export default async function Rapports() {
  const c = await exigerCollaborateur();
  if (!peut(c.roles, 'commercial.tableau_de_bord')) return <EtatVide titre="Accès réservé aux référents et à la Direction." />;
  const rapports = await listerRapports(c);
  return (
    <div className="space-y-4">
      <TitrePage titre="Rapports hebdomadaires" description="Générés chaque lundi à 7 h pour la semaine écoulée et envoyés par e-mail." retour={{ href: '/admin/commercial', libelle: 'Commercial' }} />
      {rapports.length === 0 ? (
        <EtatVide icone={FileBarChart} titre="Aucun rapport pour l’instant." description="Le premier sera généré lundi prochain à 7 h." />
      ) : (
        <ul className={`${classeSurface} divide-y divide-ink-100`}>
          {rapports.map((r) => (
            <li key={r.semaine}>
              <Link href={`/admin/commercial/rapports/${r.semaine}`} className="flex items-center gap-3 px-4 py-3 hover:bg-ink-50">
                <FileBarChart aria-hidden className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink-900">{titreRapport(r.contenu)}</span>
                  <span className="block text-xs text-ink-500 tabular-nums">
                    {r.contenu.actuel.nouveaux} prospect(s) · {r.contenu.actuel.devisAcceptes} accepté(s) · {formaterMontant(r.contenu.actuel.encaisse)} encaissés
                  </span>
                </span>
                <ChevronRight aria-hidden className="h-4 w-4 text-ink-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
