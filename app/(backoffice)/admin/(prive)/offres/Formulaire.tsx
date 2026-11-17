'use client';
// ADR 0013 : formulaire d'une offre (création / modification) et actions de statut.
import { useState } from 'react';
import { Alerte, Carte, classeAide, classeBouton, classeChamp, classeLibelle, type ResultatAction } from '@/components/backoffice/ui';
import { CATEGORIES_OFFRE, ORIGINES_OFFRE, slugifier, type EntreeOffre, type OrigineOffre, type StatutOffre } from '@/lib/offres/domaine';
import * as actions from './actions';

function Retour({ r }: { r: ResultatAction | null }) {
  return r ? r.ok ? r.message ? <Alerte type="succes">{r.message}</Alerte> : null : <Alerte>{r.erreur}</Alerte> : null;
}

const lignes = (v: FormDataEntryValue | null) =>
  String(v ?? '')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
const texte = (v: FormDataEntryValue | null) => String(v ?? '').trim() || null;

function Zone({ id, libelle, aide, valeur, lignesMin = 4, nom }: { id: string; nom: string; libelle: string; aide?: string; valeur?: string[] | string | null; lignesMin?: number }) {
  return (
    <div>
      <label htmlFor={id} className={classeLibelle}>{libelle}</label>
      <textarea id={id} name={nom} rows={lignesMin} defaultValue={Array.isArray(valeur) ? valeur.join('\n') : (valeur ?? '')} className={classeChamp} />
      {aide && <p className={classeAide}>{aide}</p>}
    </div>
  );
}

export interface OffreFormulaire extends EntreeOffre {
  id?: number;
  statut?: StatutOffre;
  slugFige?: boolean;
}

export function FormulaireOffre({ offre, ligne }: { offre: OffreFormulaire; ligne?: { libelle: string } | null }) {
  const [r, setR] = useState<ResultatAction | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [origine, setOrigine] = useState<OrigineOffre>(offre.origine);
  const [slug, setSlug] = useState(offre.slug);
  const [slugTouche, setSlugTouche] = useState(!!offre.id);
  const nouvelle = offre.id === undefined;

  return (
    <form
      className="space-y-5"
      action={async (f) => {
        setEnvoi(true);
        setR(null);
        const entree: EntreeOffre = {
          slug,
          titre: String(f.get('titre') ?? ''),
          categorie: String(f.get('categorie')) as EntreeOffre['categorie'],
          origine,
          lignePosteId: origine === 'placement' ? (offre.lignePosteId ?? null) : null,
          lieu: String(f.get('lieu') ?? ''),
          contrat: String(f.get('contrat') ?? ''),
          secteur: texte(f.get('secteur')),
          postes: Number(f.get('postes') || 1),
          description: String(f.get('description') ?? ''),
          exigences: lignes(f.get('exigences')),
          intro: texte(f.get('intro')),
          missions: lignes(f.get('missions')),
          profil: lignes(f.get('profil')),
          horaires: lignes(f.get('horaires')),
          salaire: {
            base: texte(f.get('salaireBase')),
            bonus: texte(f.get('salaireBonus')),
            target: texte(f.get('salaireCible')),
            note: texte(f.get('salaireNote')),
            fixed: f.get('salaireFixe') === 'on',
          },
          valableJusquau: texte(f.get('valableJusquau')),
          accordSalaireClient: f.get('accordSalaire') === 'on',
        };
        const res = nouvelle ? await actions.creer(entree) : await actions.modifier(offre.id!, offre.slug, entree);
        setEnvoi(false);
        setR(res);
        if (!res.ok) window.scrollTo({ top: 0, behavior: 'smooth' });
      }}
    >
      <Retour r={r} />

      <Carte titre="L’annonce">
        <div className="space-y-4">
          <div>
            <label htmlFor="o-titre" className={classeLibelle}>Titre du poste</label>
            <input
              id="o-titre"
              name="titre"
              required
              defaultValue={offre.titre}
              placeholder="Agent de caisse (H/F) — 2 postes"
              className={classeChamp}
              onChange={(e) => !slugTouche && setSlug(slugifier(e.target.value))}
            />
          </div>
          <div>
            <label htmlFor="o-slug" className={classeLibelle}>Adresse de la page</label>
            <div className="flex items-center gap-1 text-sm text-ink-500">
              <span className="shrink-0">/recrutement/</span>
              <input
                id="o-slug"
                value={slug}
                disabled={offre.slugFige}
                onChange={(e) => {
                  setSlugTouche(true);
                  setSlug(e.target.value.toLowerCase());
                }}
                className={classeChamp}
              />
            </div>
            <p className={classeAide}>{offre.slugFige ? 'Figée depuis la première publication : les candidatures et les liens partagés y sont rattachés.' : 'Générée depuis le titre. Elle ne pourra plus changer une fois l’offre publiée.'}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="o-cat" className={classeLibelle}>Catégorie</label>
              <select id="o-cat" name="categorie" defaultValue={offre.categorie} className={classeChamp}>
                {CATEGORIES_OFFRE.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="o-origine" className={classeLibelle}>Origine</label>
              <select id="o-origine" value={origine} onChange={(e) => setOrigine(e.target.value as OrigineOffre)} className={classeChamp}>
                {Object.entries(ORIGINES_OFFRE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <p className={classeAide}>
                {origine === 'placement'
                  ? ligne
                    ? `Liée à ${ligne.libelle} : l’offre se ferme seule quand la ligne est pourvue ou le dossier fermé.`
                    : 'Annonce anonyme : ne citez jamais le nom du client (secteur et quartier seulement).'
                  : 'Poste chez NEXCLEAN, sans client ni commission.'}
              </p>
            </div>
            <div>
              <label htmlFor="o-lieu" className={classeLibelle}>Lieu</label>
              <input id="o-lieu" name="lieu" required defaultValue={offre.lieu} placeholder="Akwa, Douala" className={classeChamp} />
            </div>
            <div>
              <label htmlFor="o-contrat" className={classeLibelle}>Contrat</label>
              <input id="o-contrat" name="contrat" required defaultValue={offre.contrat} placeholder="CDI, CDD 6 mois, À préciser…" className={classeChamp} />
            </div>
            <div>
              <label htmlFor="o-secteur" className={classeLibelle}>Secteur (facultatif)</label>
              <input id="o-secteur" name="secteur" defaultValue={offre.secteur ?? ''} placeholder="Cave – Vente de boissons" className={classeChamp} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="o-postes" className={classeLibelle}>Postes</label>
                <input id="o-postes" name="postes" type="number" min={1} max={500} defaultValue={offre.postes} className={classeChamp} />
              </div>
              <div>
                <label htmlFor="o-limite" className={classeLibelle}>Date limite</label>
                <input id="o-limite" name="valableJusquau" type="date" defaultValue={offre.valableJusquau ?? ''} className={classeChamp} />
              </div>
            </div>
          </div>
          <Zone id="o-desc" nom="description" libelle="Résumé (carte de la page Recrutement)" valeur={offre.description} lignesMin={3} aide="20 à 400 caractères. Repris dans Google et sur la page d’accueil." />
          <Zone id="o-exig" nom="exigences" libelle="Exigences clés (une par ligne)" valeur={offre.exigences} aide="3 à 5 points courts, affichés sur la carte." />
        </div>
      </Carte>

      <Carte titre="Détail de l’offre">
        <div className="space-y-4">
          <Zone id="o-intro" nom="intro" libelle="Introduction (facultatif)" valeur={offre.intro} />
          <Zone id="o-missions" nom="missions" libelle="Missions (une par ligne)" valeur={offre.missions} lignesMin={6} />
          <Zone id="o-profil" nom="profil" libelle="Profil recherché (une ligne par point)" valeur={offre.profil} lignesMin={6} aide="Si vide, les exigences clés sont affichées à la place." />
          <Zone id="o-horaires" nom="horaires" libelle="Horaires (facultatif, une ligne par créneau)" valeur={offre.horaires} lignesMin={3} />
        </div>
      </Carte>

      <Carte titre="Rémunération (facultatif)">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="o-sb" className={classeLibelle}>Salaire de base</label>
              <input id="o-sb" name="salaireBase" defaultValue={offre.salaire?.base ?? ''} placeholder="50 000 FCFA/mois" className={classeChamp} />
            </div>
            <div>
              <label htmlFor="o-sp" className={classeLibelle}>Prime</label>
              <input id="o-sp" name="salaireBonus" defaultValue={offre.salaire?.bonus ?? ''} placeholder="Jusqu’à 11 000 FCFA/mois" className={classeChamp} />
            </div>
            <div>
              <label htmlFor="o-sc" className={classeLibelle}>Rémunération cible</label>
              <input id="o-sc" name="salaireCible" defaultValue={offre.salaire?.target ?? ''} placeholder="51 000 FCFA/mois" className={classeChamp} />
            </div>
          </div>
          <Zone id="o-sn" nom="salaireNote" libelle="Précision" valeur={offre.salaire?.note} lignesMin={2} />
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="salaireFixe" defaultChecked={!!offre.salaire?.fixed} className="h-5 w-5 accent-primary" /> Salaire fixe (sans prime sur objectifs)
          </label>
          {origine === 'placement' && (
            <label className="flex min-h-11 items-start gap-2 text-sm">
              <input type="checkbox" name="accordSalaire" defaultChecked={offre.accordSalaireClient} className="mt-0.5 h-5 w-5 accent-primary" />
              <span>Le client a donné son accord pour publier ce salaire <span className="text-ink-500">(obligatoire pour afficher un salaire sur une offre de placement)</span></span>
            </label>
          )}
        </div>
      </Carte>

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={envoi} className={classeBouton('principal')}>
          {envoi ? 'Enregistrement…' : nouvelle ? 'Créer le brouillon' : 'Enregistrer'}
        </button>
        {nouvelle && <p className="self-center text-xs text-ink-500">L’offre est créée en brouillon : elle n’est visible sur le site qu’après publication.</p>}
      </div>
    </form>
  );
}

export function ActionsStatut({ id, statut, publieeAuMoinsUneFois, candidatures }: { id: number; statut: StatutOffre; publieeAuMoinsUneFois: boolean; candidatures: number }) {
  const [r, setR] = useState<ResultatAction | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const lancer = async (fn: () => Promise<ResultatAction>) => {
    setEnvoi(true);
    setR(await fn());
    setEnvoi(false);
  };
  return (
    <div className="space-y-2">
      <Retour r={r} />
      <div className="flex flex-wrap gap-2">
        {statut !== 'publiee' && (
          <button
            type="button"
            disabled={envoi}
            className={classeBouton('principal')}
            onClick={() => window.confirm(statut === 'fermee' ? 'Rouvrir cette offre ? Elle redevient visible et ouverte aux candidatures.' : 'Publier cette offre sur le site ?') && lancer(() => actions.changerStatut(id, 'publiee', null))}
          >
            {statut === 'fermee' ? 'Rouvrir' : 'Publier'}
          </button>
        )}
        {statut === 'publiee' && (
          <button
            type="button"
            disabled={envoi}
            className={classeBouton('secondaire')}
            onClick={() => {
              const motif = window.prompt('Motif de fermeture (ex. : poste pourvu)', 'Poste pourvu');
              if (motif !== null) lancer(() => actions.changerStatut(id, 'fermee', motif));
            }}
          >
            Fermer l’offre
          </button>
        )}
        {statut === 'brouillon' && !publieeAuMoinsUneFois && candidatures === 0 && (
          <button type="button" disabled={envoi} className={classeBouton('fantome')} onClick={() => window.confirm('Supprimer définitivement ce brouillon ?') && lancer(() => actions.supprimer(id))}>
            Supprimer le brouillon
          </button>
        )}
      </div>
    </div>
  );
}
