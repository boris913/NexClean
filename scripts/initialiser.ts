// Initialisation d'une installation (M1-AUT-09, M1-GEO-02), à exécuter sur le serveur :
//   npm run initialiser -- --nom "Prénom Nom" --email adresse@nexclean.xyz
// - insère le référentiel géographique initial (idempotent) ;
// - ajoute les modèles WhatsApp candidat manquants (MVP2-02, idempotent) ;
// - crée le premier compte Administrateur + Direction s'il n'existe aucun administrateur,
//   et affiche son lien d'activation (valable 48 h).
import { parseArgs } from 'node:util';
import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { initialiserReferentiel } from '@/lib/geo/service';
import { creerCollaborateur } from '@/lib/collaborateurs/service';
import { initialiserModelesCandidat } from '@/lib/candidats/fiche';

const { values } = parseArgs({ options: { nom: { type: 'string' }, email: { type: 'string' } } });

async function main() {
  const ref = await initialiserReferentiel();
  console.log(`Référentiel : ${ref.villes} ville(s), ${ref.arrondissements} arrondissement(s), ${ref.quartiers} quartier(s) ajoutés.`);
  console.log(`Modèles WhatsApp candidat : ${await initialiserModelesCandidat()} ajouté(s).`);

  const admins = await getDb()
    .select({ id: schema.user.id })
    .from(schema.user)
    .innerJoin(schema.collaborateurRole, eq(schema.collaborateurRole.userId, schema.user.id))
    .where(and(eq(schema.collaborateurRole.role, 'admin'), eq(schema.user.active, true)));

  if (admins.length > 0) {
    console.log('Un administrateur actif existe déjà : aucun compte créé.');
  } else if (!values.nom || !values.email) {
    console.error('Aucun administrateur : relancez avec --nom "Prénom Nom" --email adresse@exemple.cm');
    process.exitCode = 1;
  } else {
    const { lienActivation } = await creerCollaborateur({ nom: values.nom, email: values.email, roles: ['admin', 'direction'] }, { id: null });
    console.log(`Compte Administrateur + Direction créé pour ${values.email}.`);
    console.log(`Lien d'activation (48 h) : ${lienActivation}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
