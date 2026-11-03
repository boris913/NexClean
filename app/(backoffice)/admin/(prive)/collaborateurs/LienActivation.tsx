'use client';
import { useState } from 'react';
import { classeBouton, classeChamp } from '@/components/backoffice/ui';

/** Lien d'activation à transmettre si l'e-mail n'arrive pas (copie ou WhatsApp). */
export default function LienActivation({ lien }: { lien: string }) {
  const [copie, setCopie] = useState(false);
  const message = encodeURIComponent(`Bonjour, voici le lien pour activer votre compte NEXCLEAN Back-Office (valable 48 h) : ${lien}`);
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-600">Si l’e-mail n’arrive pas, transmettez ce lien personnellement :</p>
      <input readOnly value={lien} className={`${classeChamp} text-xs font-mono`} onFocus={(e) => e.currentTarget.select()} />
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className={classeBouton('secondaire')}
          onClick={async () => {
            await navigator.clipboard.writeText(lien);
            setCopie(true);
          }}
        >
          {copie ? 'Copié ✓' : 'Copier'}
        </button>
        <a href={`https://wa.me/?text=${message}`} target="_blank" rel="noopener noreferrer" className={classeBouton('secondaire')}>
          WhatsApp
        </a>
      </div>
    </div>
  );
}
