// Numéro de dossier PRÉFIXE-AAAA-NNNNN (specs/MVP1-02 RG-01, RG-02).
import type { DossierType } from '@/lib/domain/referentiels';
import { FUSEAU } from '@/lib/domain/referentiels';

export function formaterNumero(type: DossierType, annee: number, sequence: number): string {
  return `${type}-${annee}-${String(sequence).padStart(5, '0')}`;
}

/** Année civile en Africa/Douala (une demande du 31/12 à 23 h 30 UTC relève de l'année suivante). */
export function anneeDouala(date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU, year: 'numeric' }).format(date));
}
