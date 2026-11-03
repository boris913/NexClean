'use client';
import { useState } from 'react';
import { DOSSIER_TYPES, DOSSIER_TYPE_CODES, type DossierType, type Role } from '@/lib/domain/referentiels';
import type { LigneCollaborateur } from '@/lib/collaborateurs/lecture';
import type { Attributs } from '@/lib/collaborateurs/service';
import { Alerte, Carte, classeBouton, classeChamp, classeLibelle, type ResultatAction } from '@/components/backoffice/ui';
import ChoixRoles from '../ChoixRoles';
import LienActivation from '../LienActivation';
import * as actions from '../actions';

interface Props {
  collaborateur: LigneCollaborateur;
  attributs: Attributs;
  villes: { id: number; nom: string }[];
  droits: { gerer: boolean; attributs: boolean };
  estMoi: boolean;
}

function Retour({ r }: { r: ResultatAction | null }) {
  if (!r) return null;
  return r.ok ? <Alerte type="succes">{r.message}</Alerte> : <Alerte>{r.erreur}</Alerte>;
}

export default function Fiche({ collaborateur: u, attributs: a, villes, droits, estMoi }: Props) {
  const [retours, setRetours] = useState<Record<string, ResultatAction | null>>({});
  const [lien, setLien] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState<string | null>(null);

  async function lancer(cle: string, fn: () => Promise<ResultatAction>): Promise<void> {
    setEnvoi(cle);
    const r = await fn();
    setEnvoi(null);
    setRetours((p) => ({ ...p, [cle]: r }));
  }

  const confirmer = (message: string) => window.confirm(message);

  return (
    <div className="space-y-4">
      {droits.gerer && (
        <Carte titre="Rôles">
          <form className="space-y-3" action={(f) => lancer('roles', () => actions.modifierRoles(u.id, f.getAll('roles').map(String) as Role[]))}>
            <Retour r={retours.roles ?? null} />
            <ChoixRoles selection={u.roles} />
            <button type="submit" disabled={envoi === 'roles'} className={classeBouton('principal', true)}>Enregistrer les rôles</button>
          </form>
        </Carte>
      )}

      {droits.attributs && (
        <Carte titre="Attribution des dossiers">
          <form
            className="space-y-4"
            action={(f) =>
              lancer('attributs', () =>
                actions.modifierAttributs(u.id, {
                  services: f.getAll('services').map(String) as DossierType[],
                  villeIds: f.getAll('villes').map(Number),
                  telephone: String(f.get('telephone') ?? '').trim() || null,
                  capacite: f.get('capacite') ? Number(f.get('capacite')) : null,
                  absentDu: String(f.get('absentDu') ?? '') || null,
                  absentAu: String(f.get('absentAu') ?? '') || null,
                }),
              )
            }
          >
            <Retour r={retours.attributs ?? null} />
            <fieldset>
              <legend className={classeLibelle}>Services traités</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {DOSSIER_TYPE_CODES.map((t) => (
                  <label key={t} className="flex items-center gap-3 min-h-11 cursor-pointer">
                    <input type="checkbox" name="services" value={t} defaultChecked={a.services.includes(t)} className="h-5 w-5 accent-primary" />
                    {DOSSIER_TYPES[t]}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className={classeLibelle}>Villes couvertes</legend>
              <div className="flex flex-wrap gap-x-5">
                {villes.map((v) => (
                  <label key={v.id} className="flex items-center gap-3 min-h-11 cursor-pointer">
                    <input type="checkbox" name="villes" value={v.id} defaultChecked={a.villeIds.includes(v.id)} className="h-5 w-5 accent-primary" />
                    {v.nom}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="telephone" className={classeLibelle}>Téléphone (WhatsApp)</label>
                <input id="telephone" name="telephone" type="tel" defaultValue={a.telephone ?? ''} className={classeChamp} />
              </div>
              <div>
                <label htmlFor="capacite" className={classeLibelle}>Capacité max. (dossiers ouverts)</label>
                <input id="capacite" name="capacite" type="number" min={1} max={500} inputMode="numeric" defaultValue={a.capacite ?? ''} placeholder="Illimitée" className={classeChamp} />
              </div>
              <div>
                <label htmlFor="absentDu" className={classeLibelle}>Absent du</label>
                <input id="absentDu" name="absentDu" type="date" defaultValue={a.absentDu ?? ''} className={classeChamp} />
              </div>
              <div>
                <label htmlFor="absentAu" className={classeLibelle}>au</label>
                <input id="absentAu" name="absentAu" type="date" defaultValue={a.absentAu ?? ''} className={classeChamp} />
              </div>
            </div>
            <button type="submit" disabled={envoi === 'attributs'} className={classeBouton('principal', true)}>Enregistrer</button>
          </form>
        </Carte>
      )}

      {droits.gerer && (
        <Carte titre="Compte">
          <div className="space-y-4">
            <Retour r={retours.compte ?? null} />

            {u.actif && !u.active && (
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={envoi === 'compte'}
                  className={classeBouton('secondaire', true)}
                  onClick={() =>
                    lancer('compte', async () => {
                      const r = await actions.regenererLien(u.id);
                      if (!r.ok) return r;
                      setLien(r.message ?? null);
                      return { ok: true, message: 'Nouveau lien envoyé par e-mail.' };
                    })
                  }
                >
                  Renvoyer un lien d’activation
                </button>
                {lien && <LienActivation lien={lien} />}
              </div>
            )}

            <form className="flex flex-col sm:flex-row gap-2" action={(f) => lancer('compte', () => actions.changerEmail(u.id, String(f.get('email') ?? '')))}>
              <label htmlFor="email" className="sr-only">Nouvel e-mail</label>
              <input id="email" name="email" type="email" required defaultValue={u.email} className={classeChamp} />
              <button type="submit" className={classeBouton('secondaire')}>Changer l’e-mail</button>
            </form>

            {u.deuxFacteurs && (
              <button
                type="button"
                className={classeBouton('secondaire', true)}
                onClick={() => confirmer('Réinitialiser la double authentification ? Le collaborateur sera déconnecté et devra la réactiver.') && lancer('compte', () => actions.reinitialiser2FA(u.id))}
              >
                Réinitialiser la double authentification (téléphone perdu)
              </button>
            )}

            {u.actif ? (
              <button
                type="button"
                disabled={estMoi}
                title={estMoi ? 'Vous ne pouvez pas désactiver votre propre compte' : undefined}
                className={classeBouton('danger', true)}
                onClick={() => confirmer(`Désactiver le compte de ${u.nom} ? Ses sessions seront fermées immédiatement.`) && lancer('compte', () => actions.desactiver(u.id))}
              >
                Désactiver le compte
              </button>
            ) : (
              <button type="button" className={classeBouton('secondaire', true)} onClick={() => lancer('compte', () => actions.reactiver(u.id))}>
                Réactiver le compte
              </button>
            )}
          </div>
        </Carte>
      )}
    </div>
  );
}
