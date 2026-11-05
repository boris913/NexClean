# Contenu — plateforme de marque, navigation et copy page par page

> Branche : `feat/refonte-contenu`. Sources qui font foi : `docs/decisions.md` (validé), `docs/audit.md`, `CONTEXT.md`, ADR 0008 à 0014.
> Ce document fournit des textes prêts à intégrer. Il ne change aucune URL (D-05).
> Toute information manquante est notée `[À COMPLÉTER : …]` et tout point non tranché `[À CONFIRMER : …]`. Aucun chiffre n'est inventé.
> `{villes}` = libellé du référentiel géographique (`lireCouverture().libelle`, aujourd'hui « Douala et Yaoundé »). Ne jamais l'écrire en dur dans une page dynamique.

Sources de données déjà prêtes dans le code :

| Besoin | Export |
|---|---|
| Promesse, signature, sous-titre, alt OG | `BRAND` (`lib/constants.ts`) |
| Messages WhatsApp par contexte | `WHATSAPP_MESSAGES`, `WHATSAPP_MESSAGE_DEFAUT`, `…_SERVICE`, `…_RECRUTEMENT`, `…_EMPLOI`, `…_SUIVI`, `getPageWhatsAppMessage()` |
| FAQ | `FAQ` (générale), `FAQ_GENERAL`, `FAQ_PROPRETE`, `FAQ_RECRUTEMENT`, `FAQ_EMPLOI`, `FAQ_SUIVI` ; `faqSchema()` pour le JSON-LD |
| Conditions de paiement | `PAYMENT_TERMS` (dont `placement`) |
| Accueil complet | `content/home-data.ts` (`HERO`, `PILIERS`, `PARCOURS`, `FOCUS_RECRUTEMENT`, `FOCUS_PROPRETE`, `SUIVI_EN_LIGNE`, `EMPLOI_EN_TETE`, `TEMOIGNAGES_EN_TETE`, `ZONES_EN_TETE`, `FAQ_EN_TETE`, `CTA_FINAL`) |
| Metadata | `pageMetadata({ title, description, path, image?, twitter?, noindex? })` (`lib/seo.ts`) |
| JSON-LD offre d'emploi | `jobPostingSchema(job)` (`lib/seo.ts`), à poser sur `/recrutement/[slug]` si non nul |
| JSON-LD service de placement | `recrutementServiceSchema(villes)` (`lib/seo.ts`), pour `/recrutement/demander-du-personnel` |

---

## 1. Plateforme de marque

### Promesse
**« Vos espaces et vos équipes, entre de bonnes mains. »** (h1 de l'accueil, `BRAND.promesse`)

### Signature
**« Services aux entreprises et aux particuliers »** (meta, OG, footer, `BRAND.signature`)

### Sous-titre de référence
« Propreté, recrutement de personnel et espaces verts à {villes}, avec un suivi de chaque demande en ligne. » (`BRAND.sousTitre(villes)`)

### Ce que NEXCLEAN propose (D-01, rien d'autre)
- **Propreté & hygiène** : nettoyage de maisons, bureaux, fins de chantier, vitres, désinfection, abonnements d'entretien.
- **Recrutement & placement** : demande de personnel en ligne, estimation, devis, profils proposés, placements.
- **Espaces verts** : tonte, débroussaillage, désherbage, taille de haies, déchets verts.
- **Emploi** : offres publiées, candidature, profil et espace candidat gratuits.
- **Boutique** : produits d'entretien commandés sur WhatsApp.
- **Transversal** : suivi de dossier en ligne par lien sécurisé.

Ne pas présenter : mise à disposition de personnel, paiement en ligne Mobile Money, garantie de remplacement, non-contournement.

### Ton
- Professionnel, rassurant, concret. Phrases courtes. Une idée par phrase.
- On dit « vous » au client comme au candidat.
- Prix en FCFA, toujours qualifiés (« indicatif », « sur devis », « en vigueur »).
- On décrit ce qui se passe réellement : numéro de dossier, référent, devis, page de suivi, attestation de prise de poste.
- Vocabulaire du glossaire (`CONTEXT.md`) : Demande, Dossier, Devis, Estimation, Acompte, Placement confirmé, Candidat, Offre, Page de suivi. Un mot = un sens.

### Mots et formulations à éviter
| À éviter | Pourquoi | Préférer |
|---|---|---|
| « entreprise de nettoyage » pour parler de la marque entière | positionnement mono-activité | « services aux entreprises et aux particuliers » |
| « n°1 », « leader », « le meilleur », « impeccable », « irréprochable », « resplendissant » | superlatifs invérifiables | un fait : méthode, délai, document |
| « garanti », « garantie de remplacement », « satisfait ou remboursé » | non confirmé (CONTEXT.md, QO-4) | `[À CONFIRMER : …]` ou rien |
| « agence d'intérim », « mise à disposition », « nous sommes l'employeur » | hors V1 (ADR 0012) | « recrutement et placement » |
| « payez en ligne », « Mobile Money en ligne » | lot L5, non livré | « paiement en espèces, Mobile Money ou virement » |
| « gratuit » pour un client employeur | faux : commission | « estimation immédiate », « devis » |
| « devis gratuit » pour le recrutement | le devis engage un acompte | « estimation immédiate, puis devis » |
| « espace client », « compte client » | n'existe pas (ADR 0014) | « page de suivi », « lien de suivi » |
| « Douala » seul pour la couverture | incohérent avec le référentiel | « {villes} » ou « Douala et Yaoundé » |
| étincelles, « ça brille », « propreté éclatante » hors page Propreté | signale « ménage » (D-06) | — |
| lorem ipsum, chiffres clés inventés (« +500 clients ») | D-12 | `[À COMPLÉTER : …]` |

---

## 2. Navigation (D-05)

### Header (desktop dès `lg`)
| Entrée | Type | Liens |
|---|---|---|
| **Services** | menu ▾ | Propreté → `/services` · Espaces verts → `/espaces-verts` · Abonnements → `/abonnements` · Particuliers → `/particuliers` · Professionnels → `/professionnels` |
| **Recrutement** | menu ▾ (2 liens) | Demander du personnel → `/recrutement/demander-du-personnel` · Le placement en bref → `/recrutement#placement` |
| **Emploi** | menu ▾ | Offres d'emploi → `/recrutement` · Créer mon profil → `/candidat/inscription` · Espace candidat → `/candidat/connexion` |
| **Boutique** | lien | `/boutique` |
| **Réalisations** | lien | `/realisations` |
| **À propos** | lien | `/a-propos` |
| CTA principal | bouton | **Faire une demande** → `/contact` |
| Téléphone | icône | `tel:` (libellé accessible « Appeler NEXCLEAN ») |

Notes d'intégration :
- Le lien du logo vers `/` doit avoir le nom accessible « NEXCLEAN — Accueil ».
- Sous `/recrutement`, le **premier** lien « Se connecter » du DOM doit pointer vers `/candidat/connexion` (test `candidature.spec.ts`). Le menu Emploi utilise « Espace candidat » (et non « Se connecter ») pour ne pas interférer.
- Le premier lien « Créer mon profil candidat » de `/recrutement` doit pointer vers `/candidat/inscription` : le menu utilise « Créer mon profil » (libellé différent), sans risque.
- Menu mobile : mêmes groupes, puis bouton **Faire une demande**.
- `MobileCTABar` : `WhatsApp` (message `getPageWhatsAppMessage(pathname)`) · **Faire une demande** → `/contact` · Appeler. Sur `/candidat/*`, `/suivi/*`, `/profil/*`, remplacer « Faire une demande » par **Nous écrire** (WhatsApp, message emploi ou suivi), car un devis n'y a pas de sens.

### Footer (4 colonnes, logo blanc, signature)
Bandeau : logo blanc + « Services aux entreprises et aux particuliers » + « Propreté, recrutement de personnel et espaces verts à {villes}, Cameroun. »

| Services | Recrutement & emploi | Entreprise | Contact |
|---|---|---|---|
| Propreté — `/services` | Demander du personnel — `/recrutement/demander-du-personnel` | À propos — `/a-propos` | Téléphone (`CONTACT.phoneDisplay`) |
| Espaces verts — `/espaces-verts` | Offres d'emploi — `/recrutement` | Réalisations — `/realisations` | WhatsApp (message par défaut) |
| Abonnements — `/abonnements` | Créer mon profil — `/candidat/inscription` | Blog — `/blog` | E-mail (`CONTACT.email`) |
| Particuliers — `/particuliers` | Espace candidat — `/candidat/connexion` | Tarifs — `/tarifs` | Horaires (`BUSINESS_HOURS`) |
| Professionnels — `/professionnels` | | Boutique — `/boutique` | Faire une demande — `/contact` |

Ligne légale : © {année} NEXCLEAN SARL · Mentions légales · Confidentialité · CGV. Titres de colonnes en `h2` visuellement petits (corrige le saut h2→h4 de l'audit §1).

### CTA « Faire une demande »
Libellé unique du CTA global (header, barre mobile, CTA final). Il mène à `/contact`, qui oriente selon le besoin (voir la page `/contact` ci-dessous). Les CTA spécialisés gardent leur libellé : « Demander du personnel », « Demander un état des lieux », « Créer mon profil candidat », « Commander sur WhatsApp ».

---

## 3. Copy page par page

Convention : **Title** = valeur passée à `pageMetadata({ title })` (le suffixe « | NEXCLEAN SARL » est ajouté par le template). **Description** ≤ 160 caractères environ.

### `/` — Accueil
Données : `content/home-data.ts`. Metadata : `titreParDefaut(villes)` / `descriptionParDefaut(villes)` (déjà repositionnés).
- **Title (absolu)** : `NEXCLEAN — Propreté, recrutement & espaces verts à {villes}, Cameroun`
- **Description** : `Services aux entreprises et aux particuliers à {villes} : propreté, recrutement et placement de personnel, espaces verts, offres d'emploi. Suivi des demandes en ligne.`
- **H1** : Vos espaces et vos équipes, entre de bonnes mains.
- **Sous-titre** : Propreté, recrutement de personnel et espaces verts à {villes}, avec un suivi de chaque demande en ligne.
- **3 portes** (visibles sans défiler) : « J'ai besoin d'un service » → Voir les services · « Je recrute du personnel » → Demander du personnel · « Je cherche un emploi » → Voir les offres (`HERO.portes`).
- **H2 (dans l'ordre D-04)** :
  1. Un seul interlocuteur pour vos espaces et vos équipes (piliers)
  2. Un même parcours pour chaque demande
  3. Recrutez du personnel, payez les placements confirmés
  4. Des interventions préparées et contrôlées
  5. Votre dossier, consultable à tout moment
  6. Vous cherchez un emploi ?
  7. Ils nous ont fait confiance (masqué tant qu'aucun avis n'est vérifié ; encart « Laisser un avis » conservé)
  8. Zones : garder la phrase figée « Nous intervenons à {villes} » (voir §4)
  9. Vos questions, nos réponses (`FAQ` + `FAQ_SCHEMA`)
  10. Un service, du personnel ou un emploi ?
- **CTA** : Faire une demande · Écrire sur WhatsApp (`WHATSAPP_MESSAGE_DEFAUT`).

### `/services` — Propreté (index)
- **Title** : `Propreté et hygiène à {villes} : nettoyage, désinfection, abonnements`
- **Description** : `Nettoyage de maisons et bureaux, fin de chantier, vitres, désinfection et abonnements d'entretien à {villes}. Devis sur WhatsApp ou en ligne.`
- **Surtitre** : Propreté & hygiène
- **H1** : Propreté et hygiène à {villes}
- **Sous-titre** : Maisons, bureaux, commerces et fins de chantier : nous venons avec le matériel et les produits adaptés.
- **H2** : Choisissez votre prestation · Comment se déroule une intervention · Nous intervenons à {villes} · Un espace à remettre au propre ?
- **CTA** : Demander un devis (→ `/contact`, besoin « Service ») · WhatsApp (`WHATSAPP_MESSAGE_SERVICE`).
- Décor « étincelles » autorisé sur cette page uniquement (D-06).

### `/services/[slug]` — Fiche prestation (5 fiches)
Textes dans `content/services-data.ts` (`seo.title`, `seo.description`, `seo.h1`, `seo.intro`, `includes`, `idealFor`), désormais « à Douala et Yaoundé ».
- **H2** : Ce qui est inclus · Pour qui ? · Tarif · Comment se déroule une intervention · Autres prestations
- **CTA** : Demander un devis pour cette prestation (message `Bonjour NexClean, je souhaite un devis pour : {service.name}.` inchangé) · Voir les tarifs → `/tarifs`.

### `/particuliers`
- **Title** : `Particuliers à {villes} : ménage, jardin, personnel de maison`
- **Description** : `Nettoyage de votre logement, entretien de votre jardin, recrutement d'une nounou, d'un gardien ou d'une aide ménagère à {villes}. Devis et suivi en ligne.`
- **Surtitre** : Particuliers
- **H1** : Votre maison entretenue, votre personnel bien choisi
- **Sous-titre** : Ménage, grand nettoyage, vitres, jardin, et recrutement de personnel de maison : une seule demande, un seul suivi.
- **H2** : Votre devis en 3 étapes · Nos prestations pour votre logement · Besoin d'une nounou, d'un gardien ou d'une aide ménagère ? · Tarifs indicatifs · Questions fréquentes · Un logement à entretenir ?
- Encart recrutement : « Décrivez le poste, le nombre de personnes et le salaire proposé : vous obtenez une estimation immédiate. » → **Demander du personnel** (`/recrutement/demander-du-personnel`).
- **FAQ** : `FAQ_PROPRETE` + `FAQ_RECRUTEMENT[1]`.
- **CTA** : Demander un devis · Demander du personnel.

### `/professionnels`
- **Title** : `Entreprises à {villes} : propreté des locaux, recrutement, espaces verts`
- **Description** : `Entretien de bureaux et commerces, recrutement et placement de personnel, espaces verts pour les entreprises de {villes}. Visite technique, devis, suivi en ligne.`
- **Surtitre** : Professionnels
- **H1** : Vos locaux entretenus, vos postes pourvus
- **Sous-titre** : Nous étudions votre site, vos horaires et vos besoins en personnel avant de proposer un devis et un planning adaptés.
- **H2** : Les structures que nous accompagnons · Propreté de vos locaux · Besoin de personnel pour votre structure ? · Contrats d'entretien · Visite technique / devis professionnel · Un appel d'offres ou plusieurs sites ?
- Encart recrutement (remonté juste après les secteurs) : « Serveurs, agents d'entretien, gardiens, caissiers… Une commission par personne, facturée sur les seuls placements confirmés. » → **Demander du personnel**.
- Formulaire `#devis-pro` : inchangé (ids, libellés et bouton « Envoyer ma demande » figés).
- **CTA** : Demander une visite technique (ancre `#devis-pro`) · Demander du personnel.

### `/abonnements`
- **Title** : `Abonnements d'entretien à {villes} : logement, locaux, espaces verts`
- **Description** : `Formules d'entretien régulier à {villes} pour particuliers et entreprises : passages planifiés, tarif préférentiel, même équipe autant que possible.`
- **Surtitre** : Abonnements
- **H1** : L'entretien régulier, planifié pour vous
- **Sous-titre** : Des passages réguliers à tarif préférentiel, pour votre logement, vos locaux ou vos espaces verts.
- **H2** : Nos formules · Tarifs indicatifs · Questions fréquentes · Construisons votre formule
- **CTA** : Demander une formule (WhatsApp, `WHATSAPP_MESSAGES.abonnements`) · Faire une demande.

### `/espaces-verts`
- **Title** : `Entretien d'espaces verts à {villes}`
- **Description** : `Tonte, débroussaillage, désherbage, taille de haies et déchets verts à {villes}. Intervention ponctuelle ou contrat régulier, après état des lieux.`
- **Surtitre** : Espaces verts
- **H1** : Entretien des espaces verts à {villes}
- **Sous-titre** : Tonte, débroussaillage, désherbage, taille de haies et ramassage des déchets verts, en intervention ponctuelle ou en contrat régulier.
- **H2** : Nos prestations · Avant / Après (masquer tant qu'aucune réalisation espaces verts n'existe : `[À COMPLÉTER : photos avant/après espaces verts]`) · Demander un état des lieux / devis · Questions fréquentes · Un jardin ou un terrain à entretenir ?
- **CTA** : Demander un état des lieux (ancre `#devis-espaces-verts`) · WhatsApp (`WHATSAPP_MESSAGES.espacesVerts`).

### `/tarifs`
- **Title** : `Tarifs à {villes} : propreté, abonnements et recrutement`
- **Description** : `Prix indicatifs en FCFA : nettoyage de logements et bureaux, abonnements, et fonctionnement de la commission de placement. Devis après étude du besoin.`
- **Surtitre** : Tarifs
- **H1** : Nos tarifs
- **Sous-titre** : Des prix de départ indicatifs pour vous situer. Chaque devis est établi après étude de votre besoin.
- **H2** : Propreté : logements et bureaux · Abonnements · Recrutement & placement : une commission par personne · Comment se passe le paiement · Besoin d'un prix précis ?
- Bloc recrutement : texte `PAYMENT_TERMS.placement`. Montant : afficher la commission en vigueur lue via `lireParametre('commission_par_personne')` (comme le formulaire), jamais en dur.
- **CTA** : Faire une demande · Demander du personnel.

### `/realisations`
- **Title** : `Nos réalisations — avant / après à {villes}`
- **Description** : `Avant / après des interventions NEXCLEAN à {villes} : problème constaté, intervention réalisée, résultat.`
- **Surtitre** : Nos réalisations
- **H1** : Avant / Après : nos interventions
- **Sous-titre** : Chaque réalisation présente le problème rencontré, notre intervention et le résultat.
- **H2** : Nos équipes en intervention · Un espace à remettre au propre ?
- `[À COMPLÉTER : réalisations supplémentaires (bureaux, fin de chantier, espaces verts) ; une seule réalisation publiée à ce jour]`.
- **CTA** : Demander un devis (`WHATSAPP_MESSAGES.realisations`).

### `/a-propos`
- **Title** : `À propos`
- **Description** : `NEXCLEAN SARL, entreprise camerounaise de services aux entreprises et aux particuliers à {villes} : propreté, recrutement et placement, espaces verts. Mission et méthode.`
- **Surtitre** : À propos
- **H1** : NEXCLEAN, des services organisés pour vos espaces et vos équipes
- **Sous-titre** : NEXCLEAN SARL est une entreprise camerounaise implantée à {villes}. Nous accompagnons entreprises et particuliers pour la propreté de leurs espaces, le recrutement de leur personnel et l'entretien de leurs espaces verts.
- **H2** :
  - Notre mission — « Rendre simples et fiables les services du quotidien : un espace entretenu, un poste pourvu, une demande suivie de bout en bout. »
  - Notre vision — « Devenir l'interlocuteur de référence à {villes} pour les services aux entreprises et aux particuliers. » `[À CONFIRMER : formulation de la vision par la direction]`
  - Nos valeurs — Ponctualité · Honnêteté et discrétion · Clarté des prix · Respect des candidats
  - Notre méthode — un référent par dossier, un devis écrit, un suivi en ligne (`WHY_US`)
  - L'entreprise — RCCM, NIU, dirigeant : `[À COMPLÉTER : informations légales (COMPANY.rccm, COMPANY.niu, COMPANY.director)]`
  - Chiffres clés — `[À COMPLÉTER : chiffres réels (dossiers traités, placements confirmés, clients) — ne rien afficher sans source]`
- **CTA** : Faire une demande.

### `/contact` — Faire une demande (orientation)
- **Title** : `Faire une demande — service, recrutement, emploi ou suivi`
- **Description** : `Contactez NEXCLEAN à {villes} : devis de propreté ou d'espaces verts, demande de personnel, question sur une candidature ou suivi de dossier.`
- **Surtitre** : Faire une demande
- **H1** : Quelle est votre demande ?
- **Sous-titre** : Choisissez votre besoin : nous vous dirigeons vers le bon formulaire ou le bon interlocuteur.
- **Orientation** (4 cartes en tête de page, avant le formulaire) :

| Carte (h2) | Texte | CTA | Destination |
|---|---|---|---|
| Un service de propreté ou d'espaces verts | Ménage, bureaux, fin de chantier, jardin, abonnement. | Demander un devis | ancre `#contact` (section du formulaire existant `devis`, plus bas sur la page) ; espaces verts → `/espaces-verts#devis-espaces-verts` |
| Recruter du personnel | Décrivez vos postes, obtenez une estimation immédiate. | Demander du personnel | `/recrutement/demander-du-personnel` |
| Je cherche un emploi | Offres en cours et profil candidat gratuit. | Voir les offres | `/recrutement` (lien secondaire « Créer mon profil » → `/candidat/inscription`) |
| Suivre un dossier | Votre lien de suivi vous a été envoyé par WhatsApp. Vous ne le retrouvez pas ? Écrivez-nous avec votre numéro de dossier. | Nous écrire | WhatsApp, `WHATSAPP_MESSAGE_SUIVI` |

- **H2 suivants** : Demander un devis (formulaire `devis`, libellés figés) · Nous joindre directement (téléphone, WhatsApp, e-mail, horaires) · Nous intervenons à {villes} · Questions fréquentes (`FAQ`).
- **CTA** : WhatsApp (`WHATSAPP_MESSAGE_DEFAUT`) · Appeler.
- Note : un seul `role="status"` par page reste la règle si le formulaire est réutilisé ailleurs ; ne pas ajouter de second formulaire « Envoyer ma demande » sur `/professionnels`.

### `/boutique`
- **Title** : `Boutique — Produits d'entretien`
- **Description** : `Produits d'entretien NEXCLEAN : savon liquide multi-usage pour vaisselle, lessive et sols. Commande sur WhatsApp, livraison selon votre ville.`
- **Surtitre** : Boutique
- **H1** : Les produits NEXCLEAN
- **Sous-titre** : Les produits d'entretien utilisés par nos équipes, disponibles pour votre maison ou votre entreprise. Commande simple sur WhatsApp.
- **H2** : Paiement · Livraison & retrait · Professionnels & revendeurs
- **CTA** : Commander sur WhatsApp · Demander les tarifs revendeurs.

### `/boutique/[slug]`
- **Title** : `{product.name}` ; **Description** : `{tagline}. {description}` (tronquée à 160).
- **H1** : `{product.name}`
- **H2** : Usages · Surfaces compatibles · Mode d'emploi · Composition · Précautions · Conservation
- **CTA** : Commander sur WhatsApp (message `Bonjour NexClean, je souhaite commander :` inchangé).

### `/recrutement` — Offres d'emploi (et entrée placement)
- **Title** : `Offres d'emploi à {villes} — Recrutement`
- **Description** : `Offres d'emploi NEXCLEAN à {villes} : postes chez nos clients et chez NEXCLEAN. Créez votre profil candidat et postulez en ligne, gratuitement.`
- **Surtitre** : Emploi
- **H1** : Offres d'emploi et candidature
- **Sous-titre** : Consultez les offres en cours, postulez en ligne et créez votre profil candidat. L'inscription, la candidature et la mise en relation sont gratuites.
- **H2** :
  - Les offres en cours (compteur existant : « {n} offre(s) ouverte(s)… »)
  - Ce que nous attendons des candidats — valeurs reformulées pour un candidat placé : Ponctualité (« Vos futurs employeurs comptent sur vous à l'heure prévue. ») · Honnêteté & discrétion (« Vous travaillerez chez des particuliers et des entreprises. ») · Esprit d'équipe (« Vous rejoindrez une équipe en place. ») · Soin du détail (« La qualité de votre travail fait votre réputation. »)
  - Créer mon profil candidat (encart `#candidature`, libellé figé)
  - Vous cherchez du personnel ? (encart `#placement`) — « Entreprises et particuliers : décrivez vos postes, nous recherchons et présélectionnons des candidats. Une commission par personne, facturée sur les seuls placements confirmés. » → **Demander du personnel** (libellé figé)
- **CTA** : Créer mon profil candidat · Se connecter (→ `/candidat/connexion`) · Demander du personnel.

### `/recrutement/[slug]` — Fiche offre
- **Title** : `{job.title} — Offre d'emploi` ; **Description** : `{job.description}` (160 car.). Offre fermée : noindex (inchangé).
- **JSON-LD** : `jobPostingSchema(job)` (null si fermée). `[À COMPLÉTER : datePosted de chaque offre ouverte dans content/jobs-data.ts — requis par Google]`.
- **Surtitre** : Offre ouverte / Offre fermée
- **H1** : `{job.title}` ; **Sous-titre** : `{job.description}`
- **H2** : Vos missions · Profil recherché · Horaires · Rémunération · Postuler à cette offre (figé) · Offre pourvue (figé) · Autres offres
- **CTA** : Postuler / Envoyer ma candidature (figés) ; offre pourvue : lien figé « Offre pourvue — inscrivez-vous pour être contacté ».

### `/recrutement/demander-du-personnel`
- **Title** : `Demander du personnel — Recrutement & placement à {villes}`
- **Description** : `Agents d'entretien, serveurs, cuisiniers, gardiens, nounous… Décrivez vos postes : NEXCLEAN recrute et place des candidats présélectionnés à {villes}. Estimation immédiate.`
- **Surtitre** : Recrutement & placement
- **H1** : Demander du personnel (figé)
- **Sous-titre** : Décrivez votre besoin en quelques minutes. Vous obtenez une estimation immédiate, puis un conseiller vous rappelle avec un devis.
- **Encadré « Comment ça marche »** (au-dessus ou à côté du formulaire) : 1. Vous décrivez vos postes · 2. Un conseiller précise le besoin et vous envoie un devis · 3. Après l'acompte, nous recherchons et vous présentons des candidats sur votre page de suivi · 4. Vous ne payez au final que les placements confirmés à la prise de poste.
- **H2 du formulaire** : Lieu · Postes à pourvoir · Récapitulatif (figés).
- **JSON-LD** : `recrutementServiceSchema(villes)`.
- **CTA** : Continuer · Envoyer ma demande (figés).
- `[À CONFIRMER : garantie de remplacement (15 jours proposés) — ne pas afficher avant validation]`.

### `/candidat/inscription`
- **Title** : `Créer mon profil candidat — emploi à {villes}`
- **Description** : `Inscrivez-vous gratuitement : créez votre profil candidat, postulez aux offres et soyez présenté à des employeurs, toujours avec votre accord.`
- **H1** : Créer mon profil candidat (figé)
- **Sous-titre** : L'inscription, la candidature et la mise en relation sont 100 % gratuites. (`MENTION_GRATUITE`, figée)
- **H2 des étapes** : Localisation · Recherche · Parcours · Documents · Compte · Inscription réussie (figés).

### `/candidat/connexion`
- **Title** : `Connexion candidat` (noindex) · **H1** : Accéder à mon espace candidat · **Sous-titre** : Connectez-vous avec votre numéro de téléphone et votre mot de passe. · **CTA** : Se connecter (figé) · lien « Créer mon profil candidat ».

### `/candidat/espace`, `/candidat/espace/profil`, `/candidat/espace/supprimer`
- Titles inchangés (noindex) : `Mon espace candidat`, `Modifier mon profil`, `Supprimer mon compte`.
- **H1** : Bonjour {prénom} (figé) · Modifier mon profil · Supprimer mon compte.
- **H2** : Mon profil · Ma recherche · Propositions et candidatures.
- Libellés figés : « Je ne cherche plus », « Je suis toujours en recherche », « Se déconnecter », « Modifier mon profil », « Enregistrer », « Supprimer mon compte et mes données ».

### `/candidat/mot-de-passe-oublie`
- **Metadata à ajouter** : `pageMetadata({ title: 'Mot de passe oublié', description: 'Réinitialisez le mot de passe de votre espace candidat NEXCLEAN.', path: '/candidat/mot-de-passe-oublie', noindex: true })`.
- **H1** : Mot de passe oublié · **Sous-titre** : Indiquez votre numéro de téléphone : nous vous envoyons un lien pour choisir un nouveau mot de passe. `[À CONFIRMER : canal d'envoi réel du lien (WhatsApp ou e-mail)]` · **CTA** : Continuer (figé) · confirmation « Demande enregistrée. » (figée).

### `/candidat/reinitialiser/[jeton]`
- **Title** : `Nouveau mot de passe` (noindex) · **H1** : Choisir un nouveau mot de passe · **CTA** : Enregistrer mon mot de passe.

### `/suivi/[jeton]` — Page de suivi client
- **Title** : `Suivi de votre demande` (noindex, `referrer: no-referrer` à conserver).
- **H1** : libellé de phase (`LIBELLE_CLIENT[phase]`, ex. « En cours d’étude ») — un seul h1 (figé). Lien invalide : « Lien invalide ou expiré » (figé).
- **Sous-titre** : Dossier {numéro} · Ce lien est personnel : ne le partagez pas.
- **H2** : Vérification · Votre devis · Paiements · Profils proposés · Documents · Une question ?
- **CTA** : J'accepte le devis · Écrire à mon référent (WhatsApp, `WHATSAPP_MESSAGE_SUIVI`).

### `/profil/[jeton]` — Lien temporaire
- **Title** : `Profil transmis par NEXCLEAN` (noindex) · **H1** : Profil proposé par NEXCLEAN / Attestation de prise de poste / Lien invalide ou expiré (figés).

### `/blog`
- **Title** : `Blog — Conseils et actualités`
- **Description** : `Conseils pratiques de NEXCLEAN : entretien de la maison et des bureaux, espaces verts, recrutement de personnel et recherche d'emploi.`
- **H1** : Conseils et actualités
- **Sous-titre** : Des conseils concrets pour entretenir vos espaces et réussir vos recrutements.
- Canonical à ajouter (`/blog`). `[À COMPLÉTER : articles recrutement / emploi — les 8 articles actuels portent sur le nettoyage et le produit]`.

### `/blog/[slug]`
- **Title** : `{post.title}` (sans « | Blog NexClean » : le template ajoute déjà le suffixe) · **Description** : `{post.description}` · canonical `/blog/{slug}` · image de repli : `OG_IMAGE.url` (et non `og-image.png`, inexistant).
- **H1** : `{post.title}` · **CTA de fin d'article** : Faire une demande.

### `/mentions-legales`, `/confidentialite`, `/cgv`
- Titles inchangés : `Mentions légales`, `Politique de confidentialité`, `Conditions générales de vente`.
- Description CGV : `Conditions générales de vente NEXCLEAN : prestations, abonnements, produits, et recrutement & placement.`
- `[À COMPLÉTER : section CGV « Recrutement & placement » (commission, acompte, délai de recherche, solde, remboursement ou avoir) — à rédiger par la direction, hors périmètre technique]`.

---

## 4. Chaînes figées (ne pas modifier)

Reprises de D-09 et de `docs/audit.md` §9. Toute évolution impose de mettre à jour le test dans le même commit, avec justification.

### Formulaires et typage des dossiers
- `name` des services (`content/services-data.ts`) : **`Entretien Espaces Verts`**, **`Entretien Régulier (Abonnement)`**, **`Désinfection`**, **`Nettoyage de Bureaux`** (et les autres `name`), option **`Autre`**. Ils déterminent le type de dossier (`lib/dossiers/formulaire-devis.ts`).
- Slugs des services et des produits ; slugs d'offres **`agent-nettoyage`** (doit rester pourvue), **`agent-caisse-akwa`** et **`community-manager`** (ouvertes).
- Préfixe des messages de formulaire : `Bonjour NexClean,\n\n*{subject}*`.
- `formId` : `devis`, `devis-pro`, `devis-espaces-verts`. Ids `formId-champ` : `#devis-pro-location-ville`, `#devis-pro-company`, `#devis-pro-sector`, `#devis-pro-contact`, `#devis-pro-phone`, `#devis-pro-location-quartier`, `#devis-pro-need`.
- Libellés du formulaire `devis` : `Nom complet`, `Téléphone / WhatsApp`, `Service souhaité`, `Ville`, `Quartier`, `Date souhaitée`, `Précisions (surface, état, accès…)`.
- Libellés `devis-pro` : `Entreprise`, `Secteur d'activité`, `Nom du contact`, `Téléphone`, `Ville / quartier`, `Surface approximative`, `Fréquence souhaitée`, `Nombre de sites`, `Votre besoin`.
- Libellés `devis-espaces-verts` : `Nom / Entreprise`, `Type de site`, `Superficie approximative`, `Travaux souhaités`.
- Options testées : secteurs `Commerce`, `Bureaux` ; type de site `Hôtel`.
- Clé `localStorage` : `nexclean:inscription-candidat:v1`.

### Accueil et parcours (`e2e/parcours.spec.ts`)
- Un `h1` visible sur `/`.
- `#zones` contient **`Nous intervenons à Douala et Yaoundé`** et **`Bonapriso`**.
- Titre de l'accueil contenant **`Douala et Yaoundé`** (`titreParDefaut`).
- Pages en HTTP 200 sans défilement horizontal à 375 px : `/`, `/recrutement`, `/professionnels`, `/particuliers`, `/contact`, `/services`, `/tarifs`.
- Sur `/recrutement` : lien **`Demander du personnel`** (premier) → heading **`Demander du personnel`**.
- Formulaire personnel : bouton **`Continuer`** (unique), `p.text-red-700`, libellés `Entreprise / organisation`, `Nom du contact`, `Numéro WhatsApp`, `E-mail` ; ids `#dp-villeId`, `#dp-quartierId`, `#dp-secteur`, `#dp-lignes-0-{intitule,nombre,missions,experience,typeContrat,duree,salaire}` ; libellé `Dès que possible` ; headings `Lieu`, `Postes à pourvoir`, `Récapitulatif` ; bouton **`Envoyer ma demande`** ; case `J’accepte que NEXCLEAN…` ; texte `Demande envoyée` ; `p.font-mono` unique.
- `/professionnels#devis-pro` : bouton **`Envoyer ma demande`** unique sur la page ; un seul `role="status"` ; popup vers `wa.me` / `whatsapp.com`.
- `/suivi/jeton-inexistant` : **`Lien invalide ou expiré`**. Page de suivi : un seul `h1`, texte `En cours d’étude` ; `meta[name=robots]` contient `noindex`.

### Candidature (`e2e/candidature.spec.ts`)
- `/recrutement` : premier lien **`Créer mon profil candidat`** → `/candidat/inscription` ; premier lien contenant **`Se connecter`** → `/candidat/connexion`.
- `/recrutement/agent-nettoyage` : lien **`Offre pourvue — inscrivez-vous pour être contacté`** → `/candidat/inscription` ; aucun bouton `Envoyer ma candidature`.
- `/recrutement/agent-caisse-akwa` : heading **`Postuler à cette offre`** ; libellés `Métier recherché`, `Prénom`, `Nom`, `Téléphone`, `Ville`, `Quartier`, `Expérience`, `Disponibilité`, `CV`, `Message de motivation`, `Mot de passe de votre espace candidat` ; bouton `Envoyer ma candidature` ; heading `Candidature envoyée` ; liens `Compléter mon profil`, `Mon espace candidat` ; heading `Bonjour Awa` ; textes `Profil incomplet.`, `Reçue`, `Vous avez déjà postulé à cette offre.`
- `/recrutement/community-manager` : texte `Vous êtes connecté(e) en tant que`, bouton **`Postuler`**.
- Aucune requête vers un domaine externe pendant l'envoi.

### Espace candidat (`e2e/candidat.spec.ts`)
- `/candidat/inscription` : heading **`Créer mon profil candidat`** ; texte `100 % gratuites` (`MENTION_GRATUITE`) ; bouton `Continuer` (unique) ; headings `Localisation`, `Recherche`, `Parcours`, `Documents`, `Compte`, `Inscription réussie` ; bouton `Créer mon compte` ; lien `Recevoir la confirmation sur WhatsApp` (`wa.me`) ; lien `Accéder à mon espace`.
- `/candidat/espace` : heading `Bonjour Josiane`, `role=progressbar`, boutons `Je ne cherche plus` / `Je suis toujours en recherche`, `Se déconnecter`, lien `Modifier mon profil`, bouton `Enregistrer`, `role=status` « Profil enregistré ».
- `/candidat/connexion` : libellés exacts `Téléphone` et `Mot de passe` (uniques) ; bouton `Se connecter` ; `[role=alert]`.
- `/candidat/mot-de-passe-oublie` : bouton `Continuer`, texte `Demande enregistrée.`
- `/candidat/espace/supprimer` : bouton `Supprimer mon compte et mes données`.

---

## 5. Placeholders ouverts

| Placeholder | Où |
|---|---|
| `[À COMPLÉTER : datePosted de chaque offre ouverte]` | `content/jobs-data.ts` (champ `datePosted`, requis par Google pour `JobPosting`) |
| `[À COMPLÉTER : informations légales (RCCM, NIU, dirigeant)]` | `/a-propos`, mentions légales (`COMPANY`) |
| `[À COMPLÉTER : chiffres clés réels]` | `/a-propos` |
| `[À COMPLÉTER : photos avant/après espaces verts]` | `/espaces-verts` |
| `[À COMPLÉTER : réalisations supplémentaires]` | `/realisations` |
| `[À COMPLÉTER : témoignages vérifiés, dont recrutement]` | accueil (section masquée tant que vide) |
| `[À COMPLÉTER : articles recrutement / emploi]` | `/blog` |
| `[À COMPLÉTER : section CGV recrutement & placement]` | `/cgv` |
| `[À CONFIRMER : garantie de remplacement]` | `/recrutement/demander-du-personnel` (non affiché) |
| `[À CONFIRMER : formulation de la vision]` | `/a-propos` |
| `[À CONFIRMER : canal d'envoi du lien de réinitialisation]` | `/candidat/mot-de-passe-oublie` |
