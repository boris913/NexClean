'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Alerte, Carte, Pastille } from '@/components/backoffice/ui';
import type { ListesLieux, SaisieAutre } from '@/lib/geo/service';
import Conversion from './Conversion';

/**
 * Liste des saisies à revoir. Les confirmations sont gardées ici : après un rattachement, la page est
 * rafraîchie et la carte de la saisie traitée disparaît, avec tout message qu'elle affichait.
 */
export default function ListeSaisies({ saisies, lieux }: { saisies: SaisieAutre[]; lieux: ListesLieux }) {
  const [faits, setFaits] = useState<string[]>([]);

  return (
    <div className="space-y-4">
      {faits.map((m, i) => (
        <Alerte key={i} type="succes">{m}</Alerte>
      ))}
      {saisies.length === 0 && <Alerte type="succes">Aucune saisie à revoir.</Alerte>}
      {saisies.map((s) => {
        const ville = lieux.find((v) => v.id === s.villeId);
        return (
          <Carte
            key={`${s.villeId}-${s.saisie}`}
            titre={`« ${s.saisie} »`}
            actions={
              <div className="flex items-center gap-2">
                <Pastille>{s.ville}</Pastille>
                <Pastille ton="orange">{s.nombreDossiers} dossier(s)</Pastille>
              </div>
            }
          >
            <p className="text-xs text-ink-500 mb-3">
              {s.numeros.map((n, i) => (
                <span key={n}>
                  {i > 0 && ' · '}
                  <Link href={`/admin/dossiers?q=${encodeURIComponent(n)}`} className="underline">{n}</Link>
                </span>
              ))}
              {s.nombreDossiers > s.numeros.length && ' …'}
            </p>
            {ville ? (
              <Conversion
                villeId={s.villeId}
                saisie={s.saisie}
                quartiers={ville.quartiers}
                arrondissements={ville.arrondissements}
                onFait={(message) => setFaits((f) => [`« ${s.saisie} » (${s.ville}) : ${message}`, ...f])}
              />
            ) : (
              <Alerte>La ville {s.ville} est désactivée : réactivez-la dans le référentiel pour rattacher cette saisie.</Alerte>
            )}
          </Carte>
        );
      })}
    </div>
  );
}
