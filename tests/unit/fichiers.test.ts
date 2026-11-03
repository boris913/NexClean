// M1-DOC-02 — contrôle du type réel et de la taille des fichiers.
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { TAILLE_MAX_OCTETS, validerFichier } from '@/lib/fichiers/validation';
import { nouvelleCle, StockageDisque } from '@/lib/fichiers/stockage';

const octets = (...valeurs: number[]) => new Uint8Array([...valeurs, ...new Array(32).fill(0)]);
const PDF = octets(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31);
const JPEG = octets(0xff, 0xd8, 0xff, 0xe0);
const PNG = octets(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const WEBP = octets(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50);
const EXE = octets(0x4d, 0x5a, 0x90, 0x00); // MZ
const zip = (contenu: string) => new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...new TextEncoder().encode(contenu)]);

describe('validerFichier (M1-DOC-02)', () => {
  it.each([
    ['cv.pdf', PDF, 'pdf'],
    ['photo.JPG', JPEG, 'jpeg'],
    ['photo.jpeg', JPEG, 'jpeg'],
    ['capture.png', PNG, 'png'],
    ['image.webp', WEBP, 'webp'],
    ['lettre.docx', zip('[Content_Types].xml word/document.xml'), 'docx'],
  ])('accepte %s', (nom, contenu, type) => {
    expect(validerFichier(nom, contenu)).toMatchObject({ ok: true, type });
  });

  it('refuse un exécutable renommé en .pdf (critère d’acceptation)', () => {
    expect(validerFichier('cv.pdf', EXE)).toEqual({ ok: false, erreur: 'Format de fichier non accepté.' });
  });

  it("refuse une extension qui ne correspond pas au contenu", () => {
    expect(validerFichier('cv.pdf', PNG)).toMatchObject({ ok: false });
  });

  it('refuse un DOCX contenant des macros', () => {
    expect(validerFichier('lettre.docx', zip('word/document.xml word/vbaProject.bin'))).toMatchObject({ ok: false });
  });

  it('refuse une archive ZIP qui n’est pas un DOCX', () => {
    expect(validerFichier('lettre.docx', zip('images/a.png'))).toMatchObject({ ok: false });
  });

  it('refuse un fichier de plus de 5 Mo', () => {
    const gros = new Uint8Array(TAILLE_MAX_OCTETS + 1);
    gros.set(PDF);
    expect(validerFichier('gros.pdf', gros)).toEqual({ ok: false, erreur: 'Fichier trop volumineux (5 Mo maximum).' });
  });

  it('accepte un fichier de 5 Mo exactement', () => {
    const limite = new Uint8Array(TAILLE_MAX_OCTETS);
    limite.set(PDF);
    expect(validerFichier('limite.pdf', limite)).toMatchObject({ ok: true });
  });

  it('refuse un fichier vide', () => {
    expect(validerFichier('vide.pdf', new Uint8Array())).toMatchObject({ ok: false });
  });
});

describe('StockageDisque (M1-DOC-01)', () => {
  let racine: string | undefined;
  afterAll(async () => {
    if (racine) await rm(racine, { recursive: true, force: true });
  });

  it('dépose, relit et supprime un fichier sous une clé aléatoire', async () => {
    racine = await mkdtemp(path.join(os.tmpdir(), 'nexclean-stockage-'));
    const stockage = new StockageDisque(racine);
    const cle = nouvelleCle('dossiers', 'pdf', new Date('2026-11-03T10:00:00Z'));
    expect(cle).toMatch(/^dossiers\/2026-11\/[0-9a-f-]{36}\.pdf$/);
    await stockage.deposer(cle, PDF);
    expect(Buffer.from(await stockage.lire(cle))).toEqual(Buffer.from(PDF));
    await stockage.supprimer(cle);
    expect(await readdir(path.join(racine, 'dossiers', '2026-11'))).toEqual([]);
  });

  it('refuse les clés qui sortent du répertoire de stockage', async () => {
    const stockage = new StockageDisque(racine ?? os.tmpdir());
    await expect(stockage.deposer('../evasion.pdf', PDF)).rejects.toThrow();
    await expect(stockage.lire('dossiers/../../etc.pdf')).rejects.toThrow();
  });
});
