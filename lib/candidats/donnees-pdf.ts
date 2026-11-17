// Export « Mes données » au format PDF (specs/POST-04 RG-10), même contenu que l'export JSON,
// mis en page avec le gabarit commun des documents (lib/documents/mise-en-page.ts). Module pur.
import { DocumentPdf, dateLongue } from '@/lib/documents/mise-en-page';
import { formaterTelephone } from '@/lib/telephone';
import type { ExportDonnees } from './donnees';

const date = (iso: string | null) => (iso ? dateLongue(new Date(iso)) : null);
const horodatage = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Douala', dateStyle: 'long', timeStyle: 'short' }).format(new Date(iso)) : null;
const jour = (j: string | null) => (j ? dateLongue(new Date(`${j}T12:00:00Z`)) : null);
const liste = (v: readonly string[]) => (v.length ? v.join(', ') : null);
const tel = (t: string | null) => (t ? formaterTelephone(t) : null);
const montant = (n: number | null) => (n == null ? null : `${new Intl.NumberFormat('fr-FR').format(n).replace(/\s/g, ' ')} FCFA`);
const TYPES_CONSENTEMENT: Record<string, string> = { traitement: 'Traitement du profil', contact: 'Prise de contact', majorite: 'Âge' };

export async function pdfMesDonnees(e: ExportDonnees, mentionsLegales: string): Promise<Uint8Array> {
  const p = e.profil;
  const doc = await DocumentPdf.creer({
    titreMeta: 'Mes données - NEXCLEAN',
    mentionsLegales,
    enTete: { titre: 'MES DONNÉES', references: [`${p.prenom} ${p.nom}`.trim(), `Export du ${horodatage(e.genereLe)}`] },
  });
  doc.paragraphe(
    `Ce document reprend les données personnelles que ${e.responsableDuTraitement.nom} conserve à votre sujet. Le même contenu est disponible au format JSON depuis votre espace candidat. Pour toute question : ${e.responsableDuTraitement.contact}.`,
    { taille: 10, apres: 10 },
  );

  doc.titre('Identité et contact');
  doc.champs([
    ['Nom', p.nom],
    ['Prénom', p.prenom],
    ['Téléphone', tel(p.telephone)],
    ['WhatsApp', tel(p.whatsapp)],
    ['E-mail', p.email],
  ]);
  doc.titre('Localisation');
  doc.champs([
    ['Ville', p.localisation.ville],
    ['Arrondissement', p.localisation.arrondissement],
    ['Quartier', p.localisation.quartier],
    ['Repère', p.localisation.repere],
    ['Zones acceptées', liste(p.localisation.zonesAcceptees)],
  ]);
  doc.titre('Emploi recherché');
  doc.champs([
    ['Métiers', liste(p.recherche.metiers)],
    ['Secteurs', liste(p.recherche.secteurs)],
    ['Contrats', liste(p.recherche.typesContrat)],
    ['Salaire minimum', montant(p.recherche.salaireMin)],
    ['Salaire maximum', montant(p.recherche.salaireMax)],
    ['En recherche', p.recherche.enRecherche ? 'Oui' : 'Non'],
    ['Disponibilité', p.disponibilite.disponibilite],
    ['Disponible le', jour(p.disponibilite.disponibleLe)],
    ['Préavis', p.disponibilite.preavis],
    ['Horaires', liste(p.disponibilite.horaires)],
  ]);
  doc.titre('Parcours');
  doc.champs([
    ['Niveau d’études', p.parcours.niveauEtudes],
    ['Qualifications', p.parcours.qualifications],
    ['Compétences', liste(p.parcours.competences)],
  ]);
  if (e.experiences.length) {
    doc.tableau(
      [
        { titre: 'Poste', part: 28 },
        { titre: 'Employeur', part: 22 },
        { titre: 'Ville', part: 15 },
        { titre: 'Durée', part: 13 },
        { titre: 'Missions', part: 32 },
      ],
      e.experiences.map((x) => [x.poste, x.employeur ?? '', x.ville ?? '', x.duree ?? '', x.missions ?? '']),
    );
  } else doc.paragraphe('Aucune expérience renseignée.', { taille: 10 });

  doc.titre('Compte');
  doc.champs([
    ['Inscription', `${horodatage(p.compte.inscritLe)} (${p.compte.canalInscription.toLowerCase()})`],
    ['Profil mis à jour', horodatage(p.compte.profilMisAJourLe)],
    ['Dernière connexion', horodatage(p.compte.derniereConnexionLe) ?? 'jamais'],
  ]);

  doc.titre('Consentements');
  if (e.consentements.length) {
    doc.tableau(
      [
        { titre: 'Consentement', part: 30 },
        { titre: 'Version', part: 18 },
        { titre: 'Canal', part: 14 },
        { titre: 'Donné le', part: 38 },
      ],
      e.consentements.map((x) => [TYPES_CONSENTEMENT[x.type] ?? x.type, x.version, x.canal === 'assiste' ? 'Assisté' : 'Site', horodatage(x.horodatage) ?? '']),
    );
    for (const x of e.consentements.filter((c) => c.texte)) doc.paragraphe(`${TYPES_CONSENTEMENT[x.type] ?? x.type} (version ${x.version}) : « ${x.texte} »`, { taille: 10, apres: 3 });
  } else doc.paragraphe('Aucun consentement enregistré.', { taille: 10 });

  doc.titre('Documents déposés');
  if (e.documents.length) {
    doc.tableau(
      [
        { titre: 'Type', part: 18 },
        { titre: 'Fichier', part: 50 },
        { titre: 'Déposé le', part: 32 },
      ],
      e.documents.map((x) => [x.categorie, `${x.nom} (${Math.ceil(x.tailleOctets / 1024)} Ko)`, date(x.deposeLe) ?? '']),
    );
    doc.paragraphe('Les fichiers eux-mêmes se téléchargent un par un depuis votre espace candidat.', { taille: 10 });
  } else doc.paragraphe('Aucun document.', { taille: 10 });

  doc.titre('Candidatures');
  if (e.candidatures.length) {
    doc.tableau(
      [
        { titre: 'Offre', part: 45 },
        { titre: 'Envoyée le', part: 30 },
        { titre: 'Statut', part: 25 },
      ],
      e.candidatures.map((x) => [x.offre, date(x.envoyeeLe) ?? '', x.statut]),
    );
    for (const x of e.candidatures.filter((c) => c.motivation)) doc.paragraphe(`Motivation pour « ${x.offre} » : ${x.motivation}`, { taille: 10, apres: 3 });
  } else doc.paragraphe('Aucune candidature.', { taille: 10 });

  doc.titre('Propositions et accords');
  if (e.propositions.length) {
    for (const x of e.propositions) {
      doc.paragraphe(`${x.poste} — ${x.client}`, { gras: true, taille: 11, apres: 2 });
      doc.champs([
        ['Statut', x.statut],
        ['Reçue le', date(x.recueLe)],
        ['Lieu', x.ville],
        ['Secteur', x.secteur],
        ['Contrat', x.typeContrat],
        ['Salaire', x.salaire],
        ['Votre accord', x.accord ? `${horodatage(x.accord.le)} — ${x.accord.mode}` : null],
        ['Numéro communiqué', x.accord ? (x.accord.numeroCommunicable ? 'Oui' : 'Non') : null],
        ['Votre réponse le', horodatage(x.reponseLe)],
        ['Entretien', x.entretien ? [horodatage(x.entretien.le), x.entretien.lieu].filter(Boolean).join(' — ') : null],
      ]);
    }
  } else doc.paragraphe('Aucune proposition.', { taille: 10 });

  doc.titre('Placements');
  if (e.placements.length) {
    doc.tableau(
      [
        { titre: 'Poste', part: 28 },
        { titre: 'Employeur', part: 24 },
        { titre: 'Statut', part: 18 },
        { titre: 'Prise de poste', part: 30 },
      ],
      e.placements.map((x) => [x.poste, x.client, x.statut, jour(x.datePriseDePoste) ?? `prévue le ${jour(x.datePrevue)}`]),
    );
  } else doc.paragraphe('Aucun placement.', { taille: 10 });

  doc.titre('Notifications reçues dans votre espace');
  if (e.notifications.length) {
    for (const x of e.notifications) doc.paragraphe(`${horodatage(x.recueLe)} — ${x.titre} : ${x.texte}`, { taille: 10, apres: 3 });
  } else doc.paragraphe('Aucune notification.', { taille: 10 });

  return doc.enregistrer();
}
