// Lecture côté serveur de l'attribution déposée par le site (COM1-01 RG-02).
import { cookies } from 'next/headers';
import { COOKIE_SOURCE, lireAttribution, type Attribution } from './source';

/** Attribution du visiteur, ou null (cookie absent, refusé ou falsifié : la demande part en « inconnue »). */
export async function attributionVisiteur(): Promise<Attribution | null> {
  return lireAttribution((await cookies()).get(COOKIE_SOURCE)?.value);
}
