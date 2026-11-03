'use server';
import { headers } from 'next/headers';
import { activerCompte, ErreurMetier } from '@/lib/collaborateurs/service';
import { ipDepuisEnTetes } from '@/lib/audit';
import { executer } from '@/lib/actions';

export async function activer(jeton: string, motDePasse: string, confirmation: string) {
  return executer(async () => {
    if (motDePasse !== confirmation) throw new ErreurMetier('Les deux mots de passe ne correspondent pas.');
    await activerCompte(jeton, motDePasse, ipDepuisEnTetes(await headers()));
  });
}
