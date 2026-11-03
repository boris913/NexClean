'use client';
// RG-19 / RG-20 : saisie d'une demande reçue par téléphone, WhatsApp, e-mail ou visite.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DOSSIER_TYPES, DOSSIER_TYPE_CODES, type DossierType } from '@/lib/domain/referentiels';
import type { ListesLieux } from '@/lib/geo/service';
import type { LignePosteSaisie } from '@/lib/dossiers/service';
import ChampsLieu, { type ValeurLieu } from '@/components/backoffice/ChampsLieu';
import EditeurPostes, { ligneVide } from '@/components/backoffice/EditeurPostes';
import { Alerte, Carte, classeBouton, classeChamp, classeLibelle } from '@/components/backoffice/ui';
import { saisirDemande } from '../actions';

const CANAUX = { whatsapp: 'WhatsApp', telephone: 'Téléphone', email: 'E-mail', visite: 'Visite', autre: 'Autre' } as const;

export default function FormulaireSaisie({ listes }: { listes: ListesLieux }) {
  const router = useRouter();
  const [type, setType] = useState<DossierType>('NET');
  const [lieu, setLieu] = useState<ValeurLieu>({ villeId: listes[0]?.id ?? null, villeAutre: null, quartierId: null, quartierAutre: null });
  const [lignes, setLignes] = useState<LignePosteSaisie[]>([ligneVide()]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function envoyer(f: FormData) {
    setEnvoi(true);
    setErreur(null);
    const champ = (k: string) => String(f.get(k) ?? '').trim() || null;
    const client = {
      type: (f.get('clientType') === 'particulier' ? 'particulier' : 'entreprise') as 'entreprise' | 'particulier',
      nom: String(f.get('nom') ?? ''),
      contact: champ('contact'),
      whatsapp: String(f.get('whatsapp') ?? ''),
      autreTelephone: champ('autreTelephone'),
      email: champ('email'),
    };
    const canal = String(f.get('canal')) as keyof typeof CANAUX;
    const r = await saisirDemande({
      type,
      canal,
      formulaire: 'saisie',
      client,
      ...lieu,
      lieu: champ('lieu'),
      secteur: champ('secteur'),
      description: champ('description'),
      lignes: type === 'REC' ? lignes : [],
      donnees: { client, ...lieu, lieu: champ('lieu'), description: champ('description'), lignes: type === 'REC' ? lignes : [] },
      meLAttribuer: f.get('meLAttribuer') === 'on',
    });
    setEnvoi(false);
    if (!r.ok) return setErreur(r.erreur);
    router.push(`/admin/dossiers/${r.message}`);
  }

  return (
    <form action={envoyer} className="space-y-4">
      {erreur && <Alerte>{erreur}</Alerte>}
      <Carte titre="Demande">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="type" className={classeLibelle}>Type de dossier</label>
            <select id="type" value={type} onChange={(e) => setType(e.target.value as DossierType)} className={classeChamp}>
              {DOSSIER_TYPE_CODES.map((t) => <option key={t} value={t}>{DOSSIER_TYPES[t]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="canal" className={classeLibelle}>Reçue par</label>
            <select id="canal" name="canal" defaultValue="whatsapp" className={classeChamp}>
              {Object.entries(CANAUX).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
      </Carte>

      <Carte titre="Client">
        <div className="space-y-3">
          <div className="flex gap-5">
            {(['entreprise', 'particulier'] as const).map((t) => (
              <label key={t} className="flex items-center gap-2 min-h-11">
                <input type="radio" name="clientType" value={t} defaultChecked={t === 'entreprise'} className="h-5 w-5 accent-primary" />
                {t === 'entreprise' ? 'Entreprise' : 'Particulier'}
              </label>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="nom" className={classeLibelle}>Entreprise / nom</label>
              <input id="nom" name="nom" required minLength={2} className={classeChamp} />
            </div>
            <div>
              <label htmlFor="contact" className={classeLibelle}>Nom du contact</label>
              <input id="contact" name="contact" className={classeChamp} />
            </div>
            <div>
              <label htmlFor="whatsapp" className={classeLibelle}>Numéro WhatsApp</label>
              <input id="whatsapp" name="whatsapp" type="tel" inputMode="tel" required placeholder="6XX XX XX XX" className={classeChamp} />
            </div>
            <div>
              <label htmlFor="autreTelephone" className={classeLibelle}>Autre téléphone</label>
              <input id="autreTelephone" name="autreTelephone" type="tel" inputMode="tel" className={classeChamp} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="email" className={classeLibelle}>E-mail</label>
              <input id="email" name="email" type="email" className={classeChamp} />
            </div>
          </div>
        </div>
      </Carte>

      <Carte titre="Lieu">
        <div className="space-y-3">
          <ChampsLieu listes={listes} valeur={lieu} onChange={setLieu} />
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="lieu" className={classeLibelle}>Lieu d’affectation / repère</label>
              <input id="lieu" name="lieu" className={classeChamp} />
            </div>
            <div>
              <label htmlFor="secteur" className={classeLibelle}>Secteur d’activité</label>
              <input id="secteur" name="secteur" className={classeChamp} />
            </div>
          </div>
        </div>
      </Carte>

      {type === 'REC' && (
        <Carte titre="Postes">
          <EditeurPostes lignes={lignes} onChange={setLignes} />
        </Carte>
      )}

      <Carte titre="Précisions">
        <textarea name="description" rows={4} aria-label="Précisions" className={classeChamp} placeholder="Besoin, contraintes, informations utiles…" />
        <label className="flex items-center gap-3 min-h-11 mt-3">
          <input type="checkbox" name="meLAttribuer" defaultChecked className="h-5 w-5 accent-primary" />
          Me l’attribuer
        </label>
      </Carte>

      <button type="submit" disabled={envoi} className={classeBouton('principal', true)}>
        {envoi ? 'Enregistrement…' : 'Créer le dossier'}
      </button>
    </form>
  );
}
