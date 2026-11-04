'use server';
// Recherche rapide (palette Ctrl+K) : dossiers par numéro, client, contact ou téléphone.
// Mêmes règles d'accès que la liste des dossiers : un Référent ne trouve que ses dossiers
// (périmètre appliqué par listerDossiers), la Direction et les Finances voient tout.
import { exigerCollaborateur } from '@/lib/authz/session';
import { peut } from '@/lib/authz/permissions';
import { listerDossiers } from '@/lib/dossiers/lecture';
import { STATUTS } from '@/lib/dossiers/statuts';
import { DOSSIER_TYPES } from '@/lib/domain/referentiels';

export interface ResultatRechercheDossier {
  id: number;
  numero: string;
  client: string;
  type: string;
  statut: string;
  ville: string | null;
}

const MAX_RESULTATS = 8;

export async function rechercherDossiers(q: string): Promise<ResultatRechercheDossier[]> {
  const c = await exigerCollaborateur();
  const texte = q.trim().slice(0, 100);
  if (texte.length < 2) return [];
  if (!peut(c.roles, 'dossier.voir_siens') && !peut(c.roles, 'dossier.voir_tous')) return [];
  const { lignes } = await listerDossiers(c, { q: texte, tri: 'action' });
  return lignes.slice(0, MAX_RESULTATS).map((d) => ({
    id: d.id,
    numero: d.numero,
    client: d.clientNom,
    type: DOSSIER_TYPES[d.type],
    statut: STATUTS[d.statut],
    ville: d.ville ?? d.villeAutre,
  }));
}
