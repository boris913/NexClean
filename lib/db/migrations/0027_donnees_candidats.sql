ALTER TABLE "candidat" ADD COLUMN "relance_inactivite_le" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "candidat" ADD COLUMN "conservation_confirmee_le" timestamp with time zone;--> statement-breakpoint
-- POST-04 RG-03 : modèle WhatsApp de relance d'inactivité, proposé sur la fiche candidat. Texte
-- identique à MODELE_RELANCE_INACTIVITE (lib/candidats/donnees.ts) ; un modèle déjà présent
-- (même nom) est conservé tel quel.
INSERT INTO "modele_message" ("nom", "types", "texte") VALUES
('Relance inactivité', '{}', 'Bonjour {{candidat.prenom}}, je suis {{referent.prenom}} de NEXCLEAN. Votre profil candidat n’a pas été utilisé depuis 2 ans. Pour le garder, connectez-vous à votre espace ou mettez votre profil à jour : {{candidat.lien_espace}}

Vous pouvez aussi simplement me répondre ici. Sans nouvelle de votre part sous 30 jours, votre profil sera anonymisé et vos documents (CV, justificatifs) supprimés.

{{referent.prenom}}, NEXCLEAN')
ON CONFLICT ("nom") DO NOTHING;