-- Modèles WhatsApp des propositions (MVP2-03) : textes identiques à MODELES_PROPOSITION_PAR_DEFAUT
-- (lib/propositions/service.ts) ; un modèle déjà présent (même nom) est conservé tel quel.
INSERT INTO "modele_message" ("nom", "types", "texte") VALUES
('Proposition de poste', '{}', 'Bonjour {{candidat.prenom}}, je suis {{referent.prenom}} de NEXCLEAN. Nous aimerions présenter votre profil pour le poste de {{poste.intitule}} chez {{proposition.client}}.

Donnez votre réponse (accepter ou refuser) dans votre espace candidat : {{candidat.lien_espace}}

Si vous acceptez, votre profil et votre CV (tel quel) seront transmis à ce client. Votre numéro ne lui sera pas communiqué sans votre accord.

{{referent.prenom}}, NEXCLEAN'),
('Convocation entretien', '{}', 'Bonjour {{candidat.prenom}}, bonne nouvelle : {{proposition.client}} souhaite vous rencontrer pour le poste de {{poste.intitule}}.

Date : {{entretien.date}}
Lieu : {{entretien.lieu}}

Merci de me confirmer votre présence.

{{referent.prenom}}, NEXCLEAN — {{referent.telephone}}'),
('Profil candidat', '{}', 'Bonjour {{client.contact}}, voici le profil de {{proposition.candidat}} pour le poste de {{poste.intitule}} (dossier {{dossier.numero}}) : {{proposition.lien_profil}}

Ce lien est personnel et valable 7 jours. Pour organiser un entretien, répondez-moi directement ici.

{{referent.prenom}}, NEXCLEAN'),
('Attestation de prise de poste', '{}', 'Bonjour {{client.contact}}, voici l’attestation de prise de poste de {{proposition.candidat}} ({{poste.intitule}}, dossier {{dossier.numero}}, prise de poste prévue le {{placement.date}}) : {{placement.lien_attestation}}

Merci de confirmer la prise de poste en ligne, ou de nous renvoyer l’attestation signée. Lien valable 7 jours.

{{referent.prenom}}, NEXCLEAN')
ON CONFLICT ("nom") DO NOTHING;
