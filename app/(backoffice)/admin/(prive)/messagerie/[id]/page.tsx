// COM2-01 RG-07, RG-08 : fil d'une conversation WhatsApp, avec médias et liens Client / Dossier.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FileText, MapPin } from 'lucide-react';
import { exigerCollaborateur } from '@/lib/authz/session';
import { lireConversation, peutOuvrirMessagerie } from '@/lib/whatsapp/lecture';
import { formaterTelephone } from '@/lib/telephone';
import { formatHorodatage } from '@/lib/audit-lecture';
import { Alerte, Carte, EtatVide, TitrePage } from '@/components/backoffice/ui';
import Rafraichir from '../Rafraichir';
import Rattacher from './Rattacher';

export const dynamic = 'force-dynamic';
const STATUT = { envoye: 'envoyé', remis: 'remis', lu: 'lu', echec: 'échec' } as const;
const ORIGINE = { client: '', application: 'depuis le téléphone', back_office: 'depuis le Back-Office' } as const;

export default async function Conversation({ params }: { params: Promise<{ id: string }> }) {
  const c = await exigerCollaborateur();
  if (!peutOuvrirMessagerie(c)) return <EtatVide titre="Accès réservé aux référents et à la Direction." />;
  const id = Number((await params).id);
  const conv = Number.isInteger(id) ? await lireConversation(id, c) : null;
  if (!conv) notFound();
  const titre = conv.clientNom ?? conv.nomProfil ?? formaterTelephone(conv.numero);
  return (
    <div className="space-y-4">
      <Rafraichir />
      <TitrePage titre={titre} description={formaterTelephone(conv.numero)} retour={{ href: '/admin/messagerie', libelle: 'Messagerie' }}>
        {conv.dossierId && (
          <Link href={`/admin/dossiers/${conv.dossierId}`} className="rounded-lg bg-ink-100 px-3 py-2 font-mono text-sm font-semibold text-ink-800 hover:bg-brand-100">
            {conv.dossierNumero}
          </Link>
        )}
      </TitrePage>
      {conv.candidatId && (
        <Alerte type="info">
          Ce numéro est celui d’un candidat : la conversation n’ouvre pas de dossier client.{' '}
          <Link className="font-medium underline" href={`/admin/candidats/${conv.candidatId}`}>Voir la fiche candidat</Link>
        </Alerte>
      )}
      {conv.nonTraitee && conv.dernierEntrantLe && (
        <Alerte type="info">En attente de réponse depuis le {formatHorodatage(conv.dernierEntrantLe)}. Répondez depuis le téléphone : la conversation passera « traitée » automatiquement.</Alerte>
      )}
      <ol className="space-y-2" id="fil">
        {conv.messages.map((m) => {
          const sortant = m.sens === 'sortant';
          const src = `/admin/messagerie/media/${m.id}`;
          return (
            <li key={m.id} className={`flex ${sortant ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm sm:max-w-[70%] ${sortant ? 'rounded-br-sm bg-brand-100 text-ink-900' : 'rounded-bl-sm border border-ink-200/70 bg-white text-ink-900'}`}>
                {m.media && (
                  <div className="mb-1">
                    {m.media.cle && m.media.mime?.startsWith('image/') ? (
                      <a href={src} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt={m.texte || 'Image reçue'} className="max-h-72 rounded-lg" loading="lazy" />
                      </a>
                    ) : m.media.cle && m.media.mime?.startsWith('audio/') ? (
                      <audio controls preload="none" src={src} className="w-60 max-w-full" />
                    ) : m.media.cle ? (
                      <a href={src} className="inline-flex items-center gap-1.5 font-medium text-primary underline">
                        <FileText aria-hidden className="h-4 w-4" />
                        {m.media.nom ?? 'Fichier'}
                      </a>
                    ) : (
                      <span className="text-xs italic text-ink-500">{m.media.tropVolumineux ? (m.media.erreur ?? 'Fichier non conservé') : 'Média en cours de récupération…'}</span>
                    )}
                  </div>
                )}
                {m.type === 'location' && <MapPin aria-hidden className="mr-1 inline h-3.5 w-3.5 text-primary" />}
                {m.texte && <p className="whitespace-pre-line break-words">{m.texte}</p>}
                <p className="mt-1 text-right text-[11px] text-ink-500">
                  {formatHorodatage(m.horodatage)}
                  {ORIGINE[m.origine] && ` · ${ORIGINE[m.origine]}`}
                  {m.statut && ` · ${STATUT[m.statut]}`}
                </p>
                {m.erreur && <p className="text-[11px] text-red-700">{m.erreur}</p>}
              </div>
            </li>
          );
        })}
      </ol>
      {!conv.candidatId && (
        <Carte titre="Rattacher à un autre dossier" description="Si ce client écrit pour un dossier existant (autre numéro, dossier déjà ouvert…).">
          <Rattacher conversationId={conv.id} />
        </Carte>
      )}
    </div>
  );
}
