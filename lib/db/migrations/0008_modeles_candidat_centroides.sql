-- Modèles WhatsApp candidat (MVP2-02) : créés ici pour ne plus dépendre de « npm run initialiser »
-- sur les installations existantes. Textes identiques à MODELES_CANDIDAT_PAR_DEFAUT
-- (lib/candidats/fiche.ts) ; un modèle déjà présent (même nom) est conservé tel quel.
INSERT INTO "modele_message" ("nom", "types", "texte") VALUES
('Bienvenue candidat', '{}', 'Bonjour {{candidat.prenom}}, je suis {{referent.prenom}} de NEXCLEAN. Merci pour votre inscription ! Je suis votre interlocuteur pour vos recherches d’emploi. Votre espace candidat : {{candidat.lien_espace}}

L’inscription et la mise en relation sont 100 % gratuites.

{{referent.prenom}}, NEXCLEAN'),
('Compléter votre profil', '{}', 'Bonjour {{candidat.prenom}}, pour que nous puissions vous proposer des offres, merci de compléter votre profil (expériences, CV, disponibilité) ici : {{candidat.lien_profil}}

Je reste disponible au {{referent.telephone}}.

{{referent.prenom}}, NEXCLEAN'),
('Lien de réinitialisation', '{}', 'Bonjour {{candidat.prenom}}, voici votre lien pour choisir un nouveau mot de passe : {{candidat.lien_reinitialisation}}

Il est valable 30 minutes et ne fonctionne qu’une seule fois. Ne le transmettez à personne.

{{referent.prenom}}, NEXCLEAN')
ON CONFLICT ("nom") DO NOTHING;--> statement-breakpoint
-- Centroïdes approximatifs des quartiers (ADR 0021 §4, MVP2-02 RG-14), repris de
-- CENTROIDES_INITIAUX (lib/geo/donnees-initiales.ts). Ne remplit que les quartiers sans
-- coordonnées : une saisie faite dans le Référentiel n'est jamais écrasée.
UPDATE "quartier" AS q
SET "latitude" = v.lat, "longitude" = v.lon
FROM (VALUES
('Douala', 'Akwa', 4.05254, 9.69633),
('Douala', 'Bonanjo', 4.04302, 9.68650),
('Douala', 'Bonapriso', 4.02562, 9.69302),
('Douala', 'Bali', 4.03999, 9.69305),
('Douala', 'Deido', 4.06376, 9.71518),
('Douala', 'Koumassi', 4.03579, 9.69328),
('Douala', 'New Bell', 4.03148, 9.70576),
('Douala', 'Nkololoun', 4.03346, 9.71953),
('Douala', 'Kassalafam', 4.03391, 9.71283),
('Douala', 'Ngangue', 4.02077, 9.70682),
('Douala', 'Ndokoti', 4.04343, 9.74368),
('Douala', 'Logbaba', 4.03285, 9.76032),
('Douala', 'Nyalla', 4.03341, 9.77442),
('Douala', 'Japoma', 4.03233, 9.82269),
('Douala', 'Yassa', 3.99133, 9.81038),
('Douala', 'PK8', 4.04701, 9.75781),
('Douala', 'PK10', 4.04911, 9.77270),
('Douala', 'Bonabéri', 4.08221, 9.66497),
('Douala', 'Bojongo', 4.08661, 9.61904),
('Douala', 'Sodiko', 4.09774, 9.66236),
('Douala', 'Bonamoussadi', 4.09435, 9.73937),
('Douala', 'Makepe', 4.06381, 9.74096),
('Douala', 'Logpom', 4.07691, 9.77118),
('Douala', 'Ndogbong', 4.06447, 9.75213),
('Douala', 'Bépanda', 4.05654, 9.72272),
('Douala', 'Cité des Palmiers', 4.05427, 9.76406),
('Douala', 'Manoka', 3.86125, 9.62358),
('Yaoundé', 'Bastos', 3.89402, 11.51088),
('Yaoundé', 'Etoudi', 3.91498, 11.52528),
('Yaoundé', 'Nlongkak', 3.88701, 11.51897),
('Yaoundé', 'Omnisport', 3.95088, 11.54059),
('Yaoundé', 'Emana', 3.93283, 11.52233),
('Yaoundé', 'Ekoudou', 3.87828, 11.50785),
('Yaoundé', 'Tsinga', 3.88742, 11.49926),
('Yaoundé', 'Briqueterie', 3.87495, 11.50828),
('Yaoundé', 'Mokolo', 3.87563, 11.49841),
('Yaoundé', 'Madagascar', 3.87946, 11.49785),
('Yaoundé', 'Cité Verte', 3.87453, 11.48902),
('Yaoundé', 'Efoulan', 3.83435, 11.50644),
('Yaoundé', 'Nsam', 3.82902, 11.50904),
('Yaoundé', 'Obili', 3.85398, 11.48853),
('Yaoundé', 'Ngoa-Ekellé', 3.85874, 11.50596),
('Yaoundé', 'Mvolyé', 3.84392, 11.50441),
('Yaoundé', 'Ahala', 3.80365, 11.50097),
('Yaoundé', 'Kondengui', 3.85455, 11.54411),
('Yaoundé', 'Ekounou', 3.84162, 11.53409),
('Yaoundé', 'Mimboman', 3.86299, 11.55924),
('Yaoundé', 'Odza', 3.79860, 11.52912),
('Yaoundé', 'Nkomo', 3.84049, 11.55140),
('Yaoundé', 'Mvog-Mbi', 3.85140, 11.52029),
('Yaoundé', 'Essos', 3.87590, 11.54345),
('Yaoundé', 'Nkolmesseng', 3.88694, 11.56328),
('Yaoundé', 'Ngousso', 3.90262, 11.54908),
('Yaoundé', 'Mvog-Ada', 3.86352, 11.52839),
('Yaoundé', 'Biyem-Assi', 3.84047, 11.48648),
('Yaoundé', 'Mendong', 3.83464, 11.47270),
('Yaoundé', 'Etoug-Ebe', 3.85214, 11.47590),
('Yaoundé', 'Simbock', 3.80987, 11.47617),
('Yaoundé', 'Melen', 3.86459, 11.49640),
('Yaoundé', 'Nkolbisson', 3.87459, 11.45259),
('Yaoundé', 'Oyom-Abang', 3.87595, 11.47300),
('Yaoundé', 'Etetak', 3.87722, 11.48237)
) AS v(ville, nom, lat, lon)
JOIN "ville" AS vi ON vi."nom" = v.ville
WHERE q."ville_id" = vi."id" AND q."nom" = v.nom AND q."latitude" IS NULL AND q."longitude" IS NULL;
