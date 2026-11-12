// COM4-01 RG-04, RG-05, RG-12 : sources de veille, dernier passage, rendement par requête.
import { exigerCollaborateur } from '@/lib/authz/session';
import { iaActive } from '@/lib/ia/client';
import { listerSources } from '@/lib/veille/sources';
import { indicateursVeille, requetesImproductives } from '@/lib/veille/indicateurs';
import { TYPES_AUTOMATISES, TYPES_SOURCE } from '@/lib/veille/domaine';
import { formatHorodatage } from '@/lib/audit-lecture';
import { Alerte, Carte, Pastille, TitrePage } from '@/components/backoffice/ui';
import { CollecterMaintenant, FormulaireSource } from './Formulaire';

export const metadata = { title: 'Sources de veille' };
export const dynamic = 'force-dynamic';

export default async function Sources() {
  await exigerCollaborateur({ permission: 'veille.gerer' });
  const maintenant = new Date();
  const [sources, ind, improductives] = await Promise.all([listerSources(), indicateursVeille({ du: new Date(maintenant.getTime() - 30 * 24 * 3600_000), au: maintenant }), requetesImproductives(maintenant)]);
  const parRequete = new Map(ind.parRequete.map((l) => [l.cle, l]));
  return (
    <div className="space-y-5">
      <TitrePage titre="Sources de veille" retour={{ href: '/admin/veille', libelle: 'Veille' }} description="Seuls les flux publics (RSS / Atom) sont collectés automatiquement. Les réseaux sociaux restent en saisie assistée." />
      {!iaActive() && <Alerte type="info">La clé de l’API IA n’est pas configurée : la collecte automatique est inactive.</Alerte>}
      {improductives.length > 0 && (
        <Alerte>
          Requêtes sans aucune piste retenue depuis 30 jours, à désactiver : {improductives.map((r) => `${r.source} — « ${r.requete} »`).join(' ; ')}
        </Alerte>
      )}
      <FormulaireSource source={null} />
      {sources.map((s) => (
        <Carte key={`${s.id}-${s.majLe.getTime()}`} titre={s.nom} actions={<FormulaireSource source={s} />}>
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Pastille ton={s.actif ? 'vert' : 'neutre'}>{s.actif ? 'Active' : 'Inactive'}</Pastille>
              <span className="text-ink-600">{TYPES_SOURCE[s.type]}</span>
              {TYPES_AUTOMATISES.includes(s.type) && <span className="text-xs text-ink-500">toutes les {s.frequenceHeures} h</span>}
            </div>
            {s.url && <p className="break-all text-xs text-ink-500">{s.url}</p>}
            {s.derniereCollecteLe && (
              <p className="text-xs text-ink-600">
                Dernier passage le {formatHorodatage(s.derniereCollecteLe)} : {s.dernierResultat}
              </p>
            )}
            {s.requetes.length > 0 && (
              <ul className="-my-1 divide-y divide-ink-100">
                {s.requetes.map((r) => {
                  const l = parRequete.get(`${s.id}:${r}`);
                  return (
                    <li key={r} className="flex flex-wrap justify-between gap-2 py-1.5">
                      <span>« {r} »</span>
                      <span className="tabular-nums text-ink-600">{l ? `${l.trouvees} trouvée(s) · ${l.retenues} retenue(s) · ${l.converties} convertie(s) (30 j)` : 'aucune piste (30 j)'}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            {s.actif && TYPES_AUTOMATISES.includes(s.type) && iaActive() && <CollecterMaintenant id={s.id} />}
          </div>
        </Carte>
      ))}
    </div>
  );
}
