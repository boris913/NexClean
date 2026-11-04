// Chargement d'une page du Back-Office : squelette aux proportions d'un en-tête et d'une liste de cartes.
import { Squelette } from '@/components/backoffice/ui';

export default function Chargement() {
  return (
    <div role="status" aria-label="Chargement">
      <Squelette className="h-8 w-56 mb-2" />
      <Squelette className="h-4 w-80 max-w-full mb-6" />
      <Squelette className="h-24 w-full mb-5 rounded-xl" />
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Squelette key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
