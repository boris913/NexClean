'use client';
// COM2-01 RG-07 : rattacher la conversation à un autre dossier (par son numéro).
import { useState } from 'react';
import { Alerte, classeBouton, classeChamp, type ResultatAction } from '@/components/backoffice/ui';
import { rattacher } from '../actions';

export default function Rattacher({ conversationId }: { conversationId: number }) {
  const [r, setR] = useState<ResultatAction | null>(null);
  const [envoi, setEnvoi] = useState(false);
  return (
    <form
      className="space-y-2"
      action={async (f) => {
        setEnvoi(true);
        setR(await rattacher(conversationId, String(f.get('numero') ?? '')));
        setEnvoi(false);
      }}
    >
      {r && (r.ok ? <Alerte type="succes">{r.message}</Alerte> : <Alerte>{r.erreur}</Alerte>)}
      <div className="flex gap-2">
        <input name="numero" required aria-label="Numéro du dossier" placeholder="REC-2026-00012" className={classeChamp} />
        <button type="submit" disabled={envoi} className={classeBouton('secondaire')}>Rattacher</button>
      </div>
    </form>
  );
}
