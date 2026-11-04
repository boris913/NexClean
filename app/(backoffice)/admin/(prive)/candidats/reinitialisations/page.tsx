// MVP2-01 RG-07 : demandes de réinitialisation assistée en attente. Référent : celles de ses
// candidats ; Direction : toutes, y compris celles des candidats sans référent.
import Link from 'next/link';
import { exigerAccesVivier } from '@/lib/candidats/acces-page';
import { listerDemandesReinitialisation } from '@/lib/candidats/fiche';
import { formatHorodatage } from '@/lib/audit-lecture';
import { formaterTelephone } from '@/lib/telephone';
import { Carte, Pastille, TitrePage, classeBouton } from '@/components/backoffice/ui';

export const metadata = { title: 'Mots de passe oubliés' };
export const dynamic = 'force-dynamic';

export default async function PageReinitialisations() {
  const c = await exigerAccesVivier('candidat.traiter');
  const demandes = await listerDemandesReinitialisation({ id: c.id, roles: c.roles, ip: c.ip });
  const direction = c.roles.includes('direction');
  return (
    <>
      <TitrePage titre="Mots de passe oubliés" retour={{ href: '/admin/candidats', libelle: 'Candidats' }} />
      <p className="text-sm text-ink-600 -mt-3 mb-4">
        Candidats sans e-mail qui demandent à réinitialiser leur mot de passe. Vérifiez leur identité (au moins 2 informations du profil), puis envoyez-leur un lien sur WhatsApp.
        {direction ? ' Vous voyez toutes les demandes, y compris celles des candidats non attribués.' : ' Seules les demandes de vos candidats apparaissent.'}
      </p>
      {demandes.length === 0 ? (
        <Carte>
          <p className="text-sm text-ink-600">Aucune demande en attente.</p>
        </Carte>
      ) : (
        <ul className="space-y-3">
          {demandes.map((d) => (
            <li key={d.id} className="bg-white border border-ink-200/70 rounded-xl p-3 shadow-sm text-sm space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="min-w-0 break-words">{d.prenom} {d.nom}</strong>
                {d.referentId ? <span className="text-xs text-ink-500">Référent : {d.referentNom ?? '—'}</span> : <Pastille ton="orange">Non attribué</Pastille>}
              </div>
              <p className="text-ink-600">
                {d.telephone ? formaterTelephone(d.telephone) : '—'} · demandé le {formatHorodatage(d.creeLe)}
              </p>
              <Link href={`/admin/candidats/${d.candidatId}#reinitialisation`} className={classeBouton('principal', true)}>
                Vérifier l’identité et générer le lien
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
