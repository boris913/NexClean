// Accueil du Back-Office. Les compteurs de dossiers arrivent avec MVP1-05.
import Link from 'next/link';
import { exigerCollaborateur } from '@/lib/authz/session';
import { peut } from '@/lib/authz/permissions';
import { Carte, TitrePage } from '@/components/backoffice/ui';

export default async function Accueil() {
  const c = await exigerCollaborateur();
  const raccourcis = [
    { href: '/admin/collaborateurs', titre: 'Collaborateurs', texte: 'Comptes, rôles, services et villes', visible: peut(c.roles, 'collaborateurs.gerer') || peut(c.roles, 'collaborateurs.attributs') },
    { href: '/admin/referentiel', titre: 'Référentiel géographique', texte: 'Villes, arrondissements, quartiers', visible: peut(c.roles, 'referentiel.gerer') },
    { href: '/admin/journal', titre: "Journal d'audit", texte: 'Actions sensibles et connexions', visible: peut(c.roles, 'audit.consulter') },
    { href: '/admin/securite', titre: 'Ma sécurité', texte: 'Double authentification, codes de secours', visible: true },
  ].filter((r) => r.visible);

  return (
    <>
      <TitrePage titre={`Bonjour ${c.nom.split(' ')[0]}`} />
      {!c.deuxFacteurs && (
        <div className="mb-4">
          <Carte>
            <p className="text-sm text-ink-700">
              Protégez votre compte : <Link href="/admin/securite" className="text-primary font-medium">activez la double authentification</Link>.
            </p>
          </Carte>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {raccourcis.map((r) => (
          <Link key={r.href} href={r.href} className="block bg-white border border-ink-100 rounded-xl p-4 shadow-sm hover:border-primary">
            <p className="font-semibold">{r.titre}</p>
            <p className="text-sm text-ink-600">{r.texte}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
