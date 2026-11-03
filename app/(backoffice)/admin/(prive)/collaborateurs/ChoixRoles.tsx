import { ROLES, ROLE_CODES, type Role } from '@/lib/domain/referentiels';

const AIDE: Record<Role, string> = {
  referent: 'Traite les dossiers qui lui sont attribués',
  finances: 'Encaissements, impayés, exports financiers',
  direction: 'Voit tout, réaffecte, valide, pilote',
  admin: 'Comptes, rôles, paramètres (sans accès aux données métier)',
};

/** Cases à cocher des rôles, lues via FormData (name="roles"). */
export default function ChoixRoles({ selection = [] }: { selection?: Role[] }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-ink-700 mb-1.5">Rôles (combinables)</legend>
      {ROLE_CODES.map((r) => (
        <label key={r} className="flex items-start gap-3 min-h-11 py-1 cursor-pointer">
          <input type="checkbox" name="roles" value={r} defaultChecked={selection.includes(r)} className="mt-1 h-5 w-5 accent-primary" />
          <span>
            <span className="font-medium">{ROLES[r]}</span>
            <span className="block text-xs text-ink-500">{AIDE[r]}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
