// COM3-02 : assistant virtuel WhatsApp — mise en service (RG-08), base de connaissances (RG-03),
// activité récente et brouillons du mode fantôme à comparer aux réponses réelles (RG-08, RG-09).
import Link from 'next/link';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { exigerCollaborateur } from '@/lib/authz/session';
import { getDb, schema } from '@/lib/db';
import { lireParametre } from '@/lib/parametres';
import { iaActive } from '@/lib/ia/client';
import { listerConnaissances } from '@/lib/ia/connaissance';
import { MOTIFS_PASSAGE, type MotifPassage } from '@/lib/ia/agent-regles';
import { formatHorodatage } from '@/lib/audit-lecture';
import { Carte, ChiffreCle, Pastille, TitrePage } from '@/components/backoffice/ui';
import { Bot, Hand, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Fiche, ModeAgent } from './Formulaires';

export const metadata = { title: 'Assistant virtuel' };
export const dynamic = 'force-dynamic';

export default async function PageAgent() {
  await exigerCollaborateur({ permission: 'agent.gerer' });
  const depuis = new Date(Date.now() - 30 * 24 * 3600_000);
  const [mode, fiches, compte, motifs, recents] = await Promise.all([
    lireParametre('mode_agent'),
    listerConnaissances(),
    getDb().select({ type: schema.evenementAgent.type, n: sql<number>`count(*)::int`, conversations: sql<number>`count(distinct ${schema.evenementAgent.conversationId})::int` }).from(schema.evenementAgent).where(gte(schema.evenementAgent.creeLe, depuis)).groupBy(schema.evenementAgent.type),
    getDb().select({ motif: schema.evenementAgent.motif, n: sql<number>`count(*)::int` }).from(schema.evenementAgent).where(and(eq(schema.evenementAgent.type, 'passage'), gte(schema.evenementAgent.creeLe, depuis))).groupBy(schema.evenementAgent.motif),
    getDb()
      .select({ id: schema.evenementAgent.id, type: schema.evenementAgent.type, motif: schema.evenementAgent.motif, texte: schema.evenementAgent.texte, creeLe: schema.evenementAgent.creeLe, conversationId: schema.evenementAgent.conversationId, numero: schema.conversation.numero })
      .from(schema.evenementAgent)
      .innerJoin(schema.conversation, eq(schema.conversation.id, schema.evenementAgent.conversationId))
      .orderBy(desc(schema.evenementAgent.creeLe))
      .limit(30),
  ]);
  const n = (type: string) => compte.find((c) => c.type === type);
  return (
    <div className="space-y-5">
      <TitrePage titre="Assistant virtuel" description="Agent IA qui répond aux prospects sur WhatsApp dans un périmètre fermé, avec passage à un conseiller." />
      <ModeAgent mode={mode} iaConfiguree={iaActive()} />

      <section aria-label="Activité sur 30 jours" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <ChiffreCle icone={Bot} valeur={(n('reponse')?.conversations ?? 0) + (n('brouillon')?.conversations ?? 0)} libelle="conversations prises (30 j)" href="#activite" />
        <ChiffreCle icone={CheckCircle2} valeur={n('qualification_complete')?.n ?? 0} libelle="qualifications complètes" href="#activite" />
        <ChiffreCle icone={Hand} valeur={n('passage')?.n ?? 0} libelle="passages à un conseiller" href="#activite" />
        <ChiffreCle icone={ShieldAlert} valeur={n('bloque')?.n ?? 0} libelle="messages bloqués par le contrôle" href="#activite" alerte={(n('bloque')?.n ?? 0) > 0} />
      </section>
      {motifs.length > 0 && (
        <Carte titre="Passages à un conseiller, par motif (30 j)">
          <ul className="-my-1 divide-y divide-ink-100 text-sm">
            {motifs.map((m) => (
              <li key={m.motif ?? '-'} className="flex justify-between py-2">
                <span>{MOTIFS_PASSAGE[m.motif as MotifPassage] ?? m.motif}</span>
                <span className="font-semibold tabular-nums">{m.n}</span>
              </li>
            ))}
          </ul>
        </Carte>
      )}

      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Base de connaissances</h2>
      <p className="-mt-3 text-sm text-ink-600">Services, villes, horaires et garantie sont ajoutés automatiquement depuis le système. Ajoutez ici le déroulé d’un recrutement, les délais habituels, les questions fréquentes…</p>
      <div className="space-y-3">
        <Fiche fiche={null} />
        {fiches.map((f) => <Fiche key={`${f.id}-${f.version}`} fiche={f} />)}
      </div>

      <Carte titre="Activité récente">
        <ul id="activite" className="-my-1 divide-y divide-ink-100 text-sm">
          {recents.length === 0 && <li className="py-2 text-ink-500">Aucune activité.</li>}
          {recents.map((e) => (
            <li key={e.id} className="space-y-1 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <Pastille ton={e.type === 'bloque' ? 'rouge' : e.type === 'passage' ? 'orange' : e.type === 'brouillon' ? 'neutre' : 'vert'}>{e.type === 'brouillon' ? 'Brouillon (fantôme)' : e.type === 'bloque' ? 'Bloqué' : e.type === 'passage' ? 'Passage' : e.type === 'reponse' ? 'Réponse' : 'Qualification complète'}</Pastille>
                {e.motif && <span className="text-xs text-ink-600">{MOTIFS_PASSAGE[e.motif as MotifPassage] ?? e.motif}</span>}
                <Link href={`/admin/messagerie/${e.conversationId}`} className="font-mono text-xs text-primary hover:underline">{e.numero}</Link>
                <span className="text-xs text-ink-400">{formatHorodatage(e.creeLe)}</span>
              </div>
              {e.texte && <p className="whitespace-pre-line text-ink-700">{e.texte}</p>}
            </li>
          ))}
        </ul>
      </Carte>
    </div>
  );
}
