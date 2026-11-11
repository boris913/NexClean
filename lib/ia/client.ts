// Copilote IA — socle (specs/COM3-01 RG-01..05, ADR 0026).
// Interface fournisseur unique, implémentation Claude. Chaque appel est journalisé ; toute panne,
// tout dépassement de délai (20 s) ou toute sortie invalide renvoie `null` : la fonction appelante
// continue sans IA (« suggestion indisponible »).
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';
import { getDb, schema } from '@/lib/db';
import { env } from '@/lib/env';

/** RG-05 : au-delà, l'interface affiche « suggestion indisponible ». */
export const DELAI_IA_MS = 20_000;

export interface Prompt {
  /** Version, journalisée avec chaque appel (RG-03). */
  version: string;
  systeme: string;
}

export interface Contexte {
  tache: string;
  dossierId?: number | null;
  collaborateurId?: string | null;
}

export interface Fournisseur {
  /** Sortie structurée validée par un schéma zod (RG-02) : extraction, classification. */
  extraire<S extends z.ZodType>(prompt: Prompt, contenu: string, schemaSortie: S, ctx: Contexte): Promise<z.infer<S> | null>;
  /** Texte libre : brouillon, résumé, commentaire. */
  rediger(prompt: Prompt, contenu: string, ctx: Contexte, options?: { maxTokens?: number }): Promise<string | null>;
}

export const iaActive = () => !!env().IA_API_KEY;

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  // Pas de nouvel essai automatique côté SDK : la règle « une nouvelle tentative » est appliquée ici (RG-02).
  client ??= new Anthropic({ apiKey: env().IA_API_KEY, timeout: DELAI_IA_MS, maxRetries: 0 });
  return client;
}

type Issue = 'ok' | 'invalide' | 'refus' | 'echec' | 'rejete';

export async function journaliserIa(e: { ctx: Contexte; modele: string; version: string; debut: number; issue: Issue; usage?: { input_tokens?: number | null; output_tokens?: number | null } | null; erreur?: string | null }) {
  try {
    await getDb()
      .insert(schema.journalIa)
      .values({
        tache: e.ctx.tache,
        modele: e.modele,
        versionPrompt: e.version,
        jetonsEntree: e.usage?.input_tokens ?? null,
        jetonsSortie: e.usage?.output_tokens ?? null,
        dureeMs: Date.now() - e.debut,
        issue: e.issue,
        erreur: e.erreur?.slice(0, 500) ?? null,
        dossierId: e.ctx.dossierId ?? null,
        collaborateurId: e.ctx.collaborateurId ?? null,
      });
  } catch (err) {
    console.error('[ia] journal', err);
  }
}

const messageErreur = (e: unknown) => (e instanceof Anthropic.APIError ? `${e.status ?? ''} ${e.name}` : e instanceof Error ? e.message : String(e));

class FournisseurClaude implements Fournisseur {
  async extraire<S extends z.ZodType>(prompt: Prompt, contenu: string, schemaSortie: S, ctx: Contexte): Promise<z.infer<S> | null> {
    if (!iaActive()) return null;
    const modele = env().IA_MODELE_LEGER;
    for (let essai = 0; essai < 2; essai++) {
      const debut = Date.now();
      try {
        const r = await anthropic().messages.parse({
          model: modele,
          max_tokens: 4000,
          output_config: { effort: 'low', format: zodOutputFormat(schemaSortie) },
          system: [{ type: 'text', text: prompt.systeme, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: contenu }],
        });
        if (r.stop_reason === 'refusal') {
          await journaliserIa({ ctx, modele, version: prompt.version, debut, issue: 'refus', usage: r.usage });
          return null;
        }
        const sortie = r.parsed_output ? schemaSortie.safeParse(r.parsed_output) : null;
        if (sortie?.success) {
          await journaliserIa({ ctx, modele, version: prompt.version, debut, issue: 'ok', usage: r.usage });
          return sortie.data as z.infer<S>;
        }
        await journaliserIa({ ctx, modele, version: prompt.version, debut, issue: 'invalide', usage: r.usage, erreur: `essai ${essai + 1}` });
      } catch (e) {
        await journaliserIa({ ctx, modele, version: prompt.version, debut, issue: 'echec', erreur: messageErreur(e) });
        return null; // panne ou délai : pas d'acharnement
      }
    }
    return null; // RG-02 : deux sorties invalides → abandon silencieux
  }

  async rediger(prompt: Prompt, contenu: string, ctx: Contexte, options: { maxTokens?: number } = {}): Promise<string | null> {
    if (!iaActive()) return null;
    const modele = env().IA_MODELE_REDACTION;
    const debut = Date.now();
    try {
      const r = await anthropic().beta.messages.create({
        model: modele,
        max_tokens: options.maxTokens ?? 2000,
        output_config: { effort: 'low' },
        // Refus d'un classifieur de sécurité : la requête est rejouée côté serveur sur un modèle de repli.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: [{ type: 'text', text: prompt.systeme, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: contenu }],
      });
      if (r.stop_reason === 'refusal') {
        await journaliserIa({ ctx, modele, version: prompt.version, debut, issue: 'refus', usage: r.usage });
        return null;
      }
      const texte = r.content
        .map((b) => (b.type === 'text' ? b.text : ''))
        .join('')
        .trim();
      await journaliserIa({ ctx, modele: r.model ?? modele, version: prompt.version, debut, issue: texte ? 'ok' : 'invalide', usage: r.usage });
      return texte || null;
    } catch (e) {
      await journaliserIa({ ctx, modele, version: prompt.version, debut, issue: 'echec', erreur: messageErreur(e) });
      return null;
    }
  }
}

let fournisseur: Fournisseur = new FournisseurClaude();
export const ia = (): Fournisseur => fournisseur;
/** Tests : fournisseur simulé. */
export function definirFournisseur(f: Fournisseur | null) {
  fournisseur = f ?? new FournisseurClaude();
}
