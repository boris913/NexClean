// COM2-01 RG-08, RG-09 : liste des conversations WhatsApp (non traitées d'abord).
import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { exigerCollaborateur } from '@/lib/authz/session';
import { listerConversations, peutOuvrirMessagerie } from '@/lib/whatsapp/lecture';
import { peut } from '@/lib/authz/permissions';
import { formaterTelephone } from '@/lib/telephone';
import { libelleDuree } from '@/lib/commercial/indicateurs';
import { classeBouton, classeSurface, EtatVide, Pastille, TitrePage } from '@/components/backoffice/ui';
import Rafraichir from './Rafraichir';

export const metadata = { title: 'Messagerie' };
export const dynamic = 'force-dynamic';

export default async function Messagerie({ searchParams }: { searchParams: Promise<{ filtre?: string }> }) {
  const c = await exigerCollaborateur();
  if (!peutOuvrirMessagerie(c)) return <EtatVide titre="Accès réservé aux référents et à la Direction." />;
  const filtre = (await searchParams).filtre === 'non_traitees' ? 'non_traitees' : 'toutes';
  const conversations = await listerConversations(c, filtre);
  const maintenant = Date.now();
  return (
    <div className="space-y-4">
      <Rafraichir />
      <TitrePage titre="Messagerie" description="Messages reçus sur le WhatsApp commercial. Les réponses se font pour l’instant depuis le téléphone.">
        {peut(c.roles, 'whatsapp.raccorder') && (
          <Link href="/admin/messagerie/raccordement" className={classeBouton('secondaire')}>
            Raccorder un numéro
          </Link>
        )}
      </TitrePage>
      <nav aria-label="Filtre" className="flex w-fit gap-1 rounded-lg bg-ink-100/80 p-1">
        {(['toutes', 'non_traitees'] as const).map((f) => (
          <Link key={f} href={f === 'toutes' ? '?' : '?filtre=non_traitees'} aria-current={f === filtre ? 'page' : undefined} className={`rounded-md px-3 py-1.5 text-sm font-medium ${f === filtre ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600 hover:text-ink-900'}`}>
            {f === 'toutes' ? 'Toutes' : 'Non traitées'}
          </Link>
        ))}
      </nav>
      {conversations.length === 0 ? (
        <EtatVide icone={MessageCircle} titre={filtre === 'non_traitees' ? 'Aucune conversation en attente.' : 'Aucune conversation.'} />
      ) : (
        <ul className={`${classeSurface} divide-y divide-ink-100`} id="conversations">
          {conversations.map((x) => (
            <li key={x.id}>
              <Link href={`/admin/messagerie/${x.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-ink-50">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${x.nonTraitee ? 'bg-amber-500' : 'bg-transparent'}`} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink-900">{x.clientNom ?? x.nomProfil ?? formaterTelephone(x.numero)}</span>
                    {x.dossierNumero && <span className="font-mono text-xs text-ink-500">{x.dossierNumero}</span>}
                    {x.candidatId && <Pastille ton="bleu">Candidat</Pastille>}
                    {x.nonTraitee && x.dernierEntrantLe && <Pastille ton="orange">Sans réponse · {libelleDuree(Math.floor((maintenant - x.dernierEntrantLe.getTime()) / 60_000))}</Pastille>}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-ink-600">{x.dernierTexte || '—'}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
