'use client';
// POST-05 : éditeur d'un modèle de document — blocs par section, ordre des sections déplaçables,
// variables, aperçu PDF avant enregistrement, historique des versions et retour arrière.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Lock } from 'lucide-react';
import { DOCUMENTS, erreursModele, memeContenu, type ContenuModele, type TypeDocument } from '@/lib/documents/personnalisation';
import { Alerte, Carte, classeAide, classeBouton, classeChamp, classeLibelle, type ResultatAction } from '@/components/backoffice/ui';
import * as actions from '../actions';

export interface LigneVersion {
  version: number;
  commentaire: string | null;
  restaureDe: number | null;
  auteur: string | null;
  le: string | null;
}

export default function EditeurDocument({ type, versionCourante, contenu, versions }: { type: TypeDocument; versionCourante: number; contenu: ContenuModele; versions: LigneVersion[] }) {
  const def = DOCUMENTS[type];
  const [blocs, setBlocs] = useState<Record<string, string>>(contenu.blocs);
  const [ordre, setOrdre] = useState<string[]>(contenu.ordre);
  const [commentaire, setCommentaire] = useState('');
  const [r, setR] = useState<ResultatAction | null>(null);
  const [occupe, setOccupe] = useState<'apercu' | 'enregistrer' | number | null>(null);
  const [apercuUrl, setApercuUrl] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const champs = useRef<Record<string, HTMLTextAreaElement | HTMLInputElement | null>>({});

  const saisi: ContenuModele = useMemo(() => ({ blocs, ordre }), [blocs, ordre]);
  const erreurs = useMemo(() => erreursModele(type, saisi), [type, saisi]);
  const modifie = !memeContenu(saisi, contenu);

  // Nouvelle version enregistrée ou restaurée (page revalidée) : la saisie repart du contenu en vigueur.
  useEffect(() => {
    setBlocs(contenu.blocs);
    setOrdre(contenu.ordre);
    setCommentaire('');
  }, [versionCourante, contenu]);

  // Libère l'aperçu précédent (URL d'objet) quand il change ou quand on quitte la page.
  useEffect(() => () => {
    if (apercuUrl) URL.revokeObjectURL(apercuUrl);
  }, [apercuUrl]);

  const changer = (k: string, v: string) => setBlocs((b) => ({ ...b, [k]: v }));

  /** RG-05 : échange avec la section déplaçable voisine (les sections verrouillées ne bougent pas). */
  const deplacer = (i: number, sens: -1 | 1) =>
    setOrdre((o) => {
      let j = i + sens;
      while (j >= 0 && j < o.length && def.sections[o[j]!]?.verrou) j += sens;
      if (j < 0 || j >= o.length) return o;
      const n = [...o];
      [n[i], n[j]] = [n[j]!, n[i]!];
      return n;
    });
  const peutDeplacer = (i: number, sens: -1 | 1) => {
    for (let j = i + sens; j >= 0 && j < ordre.length; j += sens) if (!def.sections[ordre[j]!]?.verrou) return true;
    return false;
  };

  const inserer = (variable: string) => {
    const cible = focus ?? Object.keys(def.blocs).find((k) => def.blocs[k]!.section !== 'page') ?? null;
    if (!cible) return;
    const el = champs.current[cible];
    const texte = blocs[cible] ?? '';
    const debut = el?.selectionStart ?? texte.length;
    const fin = el?.selectionEnd ?? texte.length;
    const ajout = `{{${variable}}}`;
    changer(cible, texte.slice(0, debut) + ajout + texte.slice(fin));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(debut + ajout.length, debut + ajout.length);
    });
  };

  const apercu = async () => {
    setOccupe('apercu');
    const res = await actions.apercu(type, saisi);
    setOccupe(null);
    if (!res.ok || !res.pdf) {
      setR(res.ok ? { ok: false, erreur: 'Aperçu indisponible.' } : res);
      return;
    }
    setR(null);
    const octets = Uint8Array.from(atob(res.pdf), (c) => c.charCodeAt(0));
    setApercuUrl(URL.createObjectURL(new Blob([octets], { type: 'application/pdf' })));
  };

  const enregistrer = async () => {
    setOccupe('enregistrer');
    const res = await actions.enregistrer(type, versionCourante, saisi, commentaire);
    setOccupe(null);
    setR(res);
  };

  const restaurer = async (version: number) => {
    if (!window.confirm(version === 0 ? 'Revenir au modèle d’origine ? Une nouvelle version sera créée.' : `Revenir à la version ${version} ? Une nouvelle version sera créée.`)) return;
    setOccupe(version);
    const res = await actions.restaurer(type, version);
    setOccupe(null);
    setR(res);
  };

  const blocsDe = (section: string) => Object.entries(def.blocs).filter(([, b]) => b.section === section);

  const champBloc = (k: string) => {
    const b = def.blocs[k]!;
    const id = `bloc-${k}`;
    const valeur = blocs[k] ?? '';
    const proprietes = {
      id,
      value: valeur,
      maxLength: b.max,
      required: b.obligatoire,
      onFocus: () => setFocus(k),
      className: classeChamp,
    };
    return (
      <div key={k}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label htmlFor={id} className={classeLibelle}>
            {b.libelle}
            {b.obligatoire && <span className="text-ink-500 font-normal"> (obligatoire)</span>}
          </label>
          {valeur !== b.defaut && (
            <button type="button" className="text-xs text-primary min-h-8 px-1" onClick={() => changer(k, b.defaut)}>
              Texte d’origine
            </button>
          )}
        </div>
        {b.multiligne ? (
          <textarea {...proprietes} ref={(el) => void (champs.current[k] = el)} rows={Math.min(8, Math.max(2, valeur.split('\n').length + 1))} onChange={(e) => changer(k, e.target.value)} />
        ) : (
          <input {...proprietes} ref={(el) => void (champs.current[k] = el)} onChange={(e) => changer(k, e.target.value)} />
        )}
        <p className={classeAide}>
          {b.aide ? `${b.aide} ` : ''}
          {valeur.length} / {b.max}
        </p>
      </div>
    );
  };

  const derniere = versions[0];

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-4 min-w-0">
        <Alerte type="info">
          {versionCourante === 0 ? 'Modèle d’origine en vigueur (aucune version enregistrée).' : `Version ${versionCourante} en vigueur${derniere?.le ? ` depuis le ${derniere.le}` : ''}${derniere?.auteur ? `, par ${derniere.auteur}` : ''}.`} Les numéros, montants, tableaux, mention TVA et références restent fixes ; les documents déjà émis ne changent pas.
        </Alerte>

        <Carte titre={def.sections.page!.libelle} description={def.sections.page!.verrou}>
          <div className="space-y-3">{blocsDe('page').map(([k]) => champBloc(k))}</div>
        </Carte>

        <ol className="space-y-4" aria-label="Sections du document, dans l’ordre">
          {ordre.map((s, i) => {
            const section = def.sections[s]!;
            const sesBlocs = blocsDe(s);
            return (
              <li key={s}>
                <Carte
                  titre={`${i + 1}. ${section.libelle}`}
                  description={
                    section.verrou ? (
                      <span className="inline-flex items-start gap-1.5">
                        <Lock aria-hidden className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>Section verrouillée : {section.verrou}</span>
                      </span>
                    ) : section.donnees ? (
                      'Toujours présente ; déplaçable.'
                    ) : (
                      'Facultative si ses textes sont vides ; déplaçable.'
                    )
                  }
                  actions={
                    !section.verrou && (
                      <>
                        <button type="button" className={classeBouton('fantome')} disabled={!peutDeplacer(i, -1)} onClick={() => deplacer(i, -1)} aria-label={`Monter « ${section.libelle} »`}>
                          <ArrowUp aria-hidden className="h-4 w-4" />
                        </button>
                        <button type="button" className={classeBouton('fantome')} disabled={!peutDeplacer(i, 1)} onClick={() => deplacer(i, 1)} aria-label={`Descendre « ${section.libelle} »`}>
                          <ArrowDown aria-hidden className="h-4 w-4" />
                        </button>
                      </>
                    )
                  }
                >
                  {sesBlocs.length ? <div className="space-y-3">{sesBlocs.map(([k]) => champBloc(k))}</div> : <p className="text-sm text-ink-500">Contenu fixe : données du document.</p>}
                </Carte>
              </li>
            );
          })}
        </ol>

        <Carte titre="Enregistrer">
          <div className="space-y-3">
            {erreurs.length > 0 && (
              <Alerte>
                <ul className="list-disc pl-4">
                  {erreurs.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </Alerte>
            )}
            {r && <Alerte type={r.ok ? 'succes' : 'erreur'}>{r.ok ? r.message : r.erreur}</Alerte>}
            <div>
              <label htmlFor="commentaire" className={classeLibelle}>
                Commentaire de version (facultatif)
              </label>
              <input id="commentaire" maxLength={200} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} placeholder="Ex. : nouvelle adresse du siège" className={classeChamp} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={classeBouton('secondaire')} disabled={erreurs.length > 0 || occupe !== null} onClick={apercu}>
                {occupe === 'apercu' ? 'Préparation…' : 'Aperçu PDF'}
              </button>
              <button type="button" className={classeBouton('principal')} disabled={!modifie || erreurs.length > 0 || occupe !== null} onClick={enregistrer}>
                {occupe === 'enregistrer' ? 'Enregistrement…' : 'Enregistrer une nouvelle version'}
              </button>
              {modifie && (
                <button
                  type="button"
                  className={classeBouton('fantome')}
                  onClick={() => {
                    setBlocs(contenu.blocs);
                    setOrdre(contenu.ordre);
                  }}
                >
                  Annuler les modifications
                </button>
              )}
            </div>
            {apercuUrl && (
              <div className="space-y-2">
                <p className="text-sm">
                  <a href={apercuUrl} target="_blank" rel="noopener" className="text-primary underline">
                    Ouvrir l’aperçu dans un nouvel onglet
                  </a>{' '}
                  <span className="text-ink-500">— données d’exemple, rien n’est enregistré.</span>
                </p>
                <iframe title="Aperçu PDF du modèle" src={apercuUrl} className="hidden sm:block w-full h-[36rem] rounded-lg border border-ink-200" />
              </div>
            )}
          </div>
        </Carte>
      </div>

      <aside className="space-y-4">
        <Carte titre="Variables" description={focus ? `Insérées dans « ${def.blocs[focus]?.libelle} ».` : 'Cliquez dans un texte, puis sur une variable.'}>
          <ul className="space-y-1.5 text-xs text-ink-600">
            {Object.entries(def.variables).map(([v, libelle]) => (
              <li key={v}>
                <button type="button" className="font-mono text-primary text-left break-all" onClick={() => inserer(v)}>{`{{${v}}}`}</button>
                <span className="block">{libelle}</span>
              </li>
            ))}
          </ul>
        </Carte>
        <Carte titre="Versions">
          <ol className="space-y-3 text-sm">
            {versions.map((v) => (
              <li key={v.version} className="border-b border-ink-100 pb-2 last:border-0">
                <p className="font-medium text-ink-900">
                  {v.version === 0 ? 'Modèle d’origine' : `Version ${v.version}`}
                  {v.version === versionCourante && <span className="text-leaf-700 font-normal"> · en vigueur</span>}
                </p>
                {v.le && (
                  <p className="text-xs text-ink-500">
                    {v.le}
                    {v.auteur ? ` · ${v.auteur}` : ''}
                  </p>
                )}
                {v.commentaire && <p className="text-xs text-ink-600">{v.commentaire}</p>}
                {v.version !== versionCourante && (
                  <button type="button" className="text-xs text-primary min-h-8" disabled={occupe !== null} onClick={() => restaurer(v.version)}>
                    {occupe === v.version ? 'Création…' : 'Revenir à cette version'}
                  </button>
                )}
              </li>
            ))}
          </ol>
        </Carte>
      </aside>
    </div>
  );
}
