// Stockage des documents (ADR 0003, M1-DOC-01) : interface compatible S3
// (put / get / delete par clé), implémentée sur disque en V1, hors racine web.
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, statfs, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '@/lib/env';

export interface Stockage {
  deposer(cle: string, octets: Uint8Array): Promise<void>;
  lire(cle: string): Promise<Uint8Array>;
  supprimer(cle: string): Promise<void>;
}

export class EspaceDisqueInsuffisant extends Error {
  constructor() {
    super('Espace de stockage insuffisant. Le fichier n’a pas été enregistré.');
  }
}

/** Marge minimale conservée sur le disque avant d'accepter un téléversement. */
const MARGE_OCTETS = 200 * 1024 * 1024;

const CLE_VALIDE = /^[a-z0-9][a-z0-9/_-]*\.[a-z0-9]{2,5}$/;

export class StockageDisque implements Stockage {
  constructor(private readonly racine: string) {}

  private chemin(cle: string): string {
    if (!CLE_VALIDE.test(cle) || cle.includes('..')) throw new Error(`Clé de stockage invalide : ${cle}`);
    const complet = path.resolve(this.racine, cle);
    if (!complet.startsWith(path.resolve(this.racine) + path.sep)) throw new Error('Clé hors du répertoire de stockage');
    return complet;
  }

  async deposer(cle: string, octets: Uint8Array): Promise<void> {
    const cible = this.chemin(cle);
    await mkdir(path.dirname(cible), { recursive: true });
    // Cas limite « disque plein » : refuser proprement plutôt que corrompre un fichier.
    const fs = await statfs(path.dirname(cible));
    if (fs.bavail * fs.bsize < octets.byteLength + MARGE_OCTETS) throw new EspaceDisqueInsuffisant();
    await writeFile(cible, octets, { flag: 'wx' });
  }

  async lire(cle: string): Promise<Uint8Array> {
    return readFile(this.chemin(cle));
  }

  async supprimer(cle: string): Promise<void> {
    await rm(this.chemin(cle), { force: true });
  }
}

let instance: Stockage | undefined;

export function getStockage(): Stockage {
  if (!instance) instance = new StockageDisque(path.resolve(env().STORAGE_DIR));
  return instance;
}

/** Clé interne aléatoire, classée par préfixe et par mois : « dossiers/2026-11/<uuid>.pdf ». */
export function nouvelleCle(prefixe: string, extension: string, date = new Date()): string {
  const mois = date.toISOString().slice(0, 7);
  return `${prefixe}/${mois}/${randomUUID()}.${extension}`;
}
