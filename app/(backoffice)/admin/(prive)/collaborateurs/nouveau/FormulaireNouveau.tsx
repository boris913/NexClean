'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { Role } from '@/lib/domain/referentiels';
import { Alerte, Carte, classeBouton, classeChamp, classeLibelle } from '@/components/backoffice/ui';
import ChoixRoles from '../ChoixRoles';
import LienActivation from '../LienActivation';
import { creer } from '../actions';

export default function FormulaireNouveau() {
  const [erreur, setErreur] = useState<string | null>(null);
  const [cree, setCree] = useState<{ id: string; lien: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);

  if (cree)
    return (
      <Carte titre="Compte créé">
        <div className="space-y-4">
          <Alerte type="succes">Le lien d’activation (valable 48 h) a été envoyé par e-mail.</Alerte>
          <LienActivation lien={cree.lien} />
          <Link href={`/admin/collaborateurs/${cree.id}`} className={classeBouton('principal', true)}>
            Définir ses services et villes
          </Link>
        </div>
      </Carte>
    );

  return (
    <Carte>
      <form
        className="space-y-4"
        action={async (form) => {
          setEnvoi(true);
          setErreur(null);
          const r = await creer(String(form.get('nom') ?? ''), String(form.get('email') ?? ''), form.getAll('roles').map(String) as Role[]);
          setEnvoi(false);
          if (!r.ok) return setErreur(r.erreur);
          const [id, lien] = (r.message ?? '').split('|');
          setCree({ id: id!, lien: lien! });
        }}
      >
        {erreur && <Alerte>{erreur}</Alerte>}
        <div>
          <label htmlFor="nom" className={classeLibelle}>Nom complet</label>
          <input id="nom" name="nom" required minLength={2} maxLength={80} className={classeChamp} />
        </div>
        <div>
          <label htmlFor="email" className={classeLibelle}>E-mail professionnel</label>
          <input id="email" name="email" type="email" required className={classeChamp} />
        </div>
        <ChoixRoles selection={['referent']} />
        <button type="submit" disabled={envoi} className={classeBouton('principal', true)}>
          {envoi ? 'Création…' : 'Créer le compte'}
        </button>
      </form>
    </Carte>
  );
}
