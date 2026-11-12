'use server';
// COM3-02 RG-03, RG-07, RG-08 : administration de l'agent (Direction), journalisée.
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { exigerCollaborateur } from '@/lib/authz/session';
import { executer } from '@/lib/actions';
import { changerModeAgent } from '@/lib/ia/agent';
import { enregistrerConnaissance, type schemaConnaissance } from '@/lib/ia/connaissance';
import { demarrerEvaluation, executerEvaluation } from '@/lib/ia/evaluation/service';
import type { z } from 'zod';

async function auteur() {
  const c = await exigerCollaborateur({ permission: 'agent.gerer' });
  return { id: c.id, ip: c.ip };
}

const LIBELLES = { desactive: 'Agent désactivé.', fantome: 'Mode fantôme : l’agent rédige sans rien envoyer.', hors_heures: 'L’agent répond seul en dehors des heures ouvrées.', permanent: 'L’agent répond en premier, avec passage à un conseiller.' } as const;

export async function definirMode(mode: keyof typeof LIBELLES) {
  return executer(async () => {
    if (!(mode in LIBELLES)) throw new Error('Mode inconnu');
    await changerModeAgent(mode, await auteur());
    revalidatePath('/admin/agent');
    return LIBELLES[mode];
  });
}

export async function enregistrerFiche(id: number | null, entree: z.input<typeof schemaConnaissance>) {
  return executer(async () => {
    await enregistrerConnaissance(id, entree, await auteur());
    revalidatePath('/admin/agent');
    return 'Fiche enregistrée. La base a changé : relancez l’évaluation avant toute mise en service.';
  });
}

/** RG-10 : lance le jeu d'évaluation en arrière-plan (appels facturés au fournisseur IA). */
export async function lancerEvaluation() {
  return executer(async () => {
    const id = await demarrerEvaluation(await auteur());
    after(() => executerEvaluation(id));
    revalidatePath('/admin/agent');
    return 'Évaluation lancée : comptez quelques minutes. La page se met à jour seule.';
  });
}
