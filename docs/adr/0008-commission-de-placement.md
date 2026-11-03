# ADR 0008 – Commission de placement : prix unique, administrable, figé au devis, TVA paramétrable

- **Statut :** accepté
- **Date :** 2026-11-02
- **Décideur :** Ange

## Contexte

Le brief fixe une commission de 5 000 FCFA par personne effectivement placée et une estimation = 5 000 × nombre total de personnes demandées. Le régime fiscal de NEXCLEAN SARL (réel avec TVA ou régime sans TVA) n'est pas connu à ce stade : la forme juridique SARL ne détermine pas à elle seule l'assujettissement à la TVA.

## Décision

1. La **Commission de placement** est le **seul prix** payé par le Client à NEXCLEAN pour un placement. Le salaire est versé directement par le Client (employeur) ; NEXCLEAN ne manipule pas de salaires dans ce modèle.
2. Son montant est un **tarif de la grille tarifaire** (défaut : 5 000 FCFA par personne, uniforme), modifiable par les rôles autorisés ; la grille pourra porter un montant par catégorie de poste.
3. Le tarif appliqué est **figé dans le Dossier au moment du devis** ; une modification ultérieure de la grille n'affecte pas les devis émis.
4. Les prix sont stockés **hors taxes** avec un **taux de TVA paramétrable** (0 % possible). Les documents affichent HT / TVA / TTC, ou la mention « TVA non applicable » si le taux est nul.
5. L'**Estimation** affichée au Client après soumission = commission en vigueur × nombre total de personnes demandées (toutes lignes de poste), présentée comme indicative.

## Conséquences

- Le régime fiscal doit être confirmé avant la première facture (question ouverte QO-2).
- La question d'un minimum de facturation par dossier reste ouverte (QO-3).
- La mise à disposition, si retenue, relèvera d'un autre modèle tarifaire.
