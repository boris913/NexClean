# ADR 0021 – Référentiel géographique Ville / Arrondissement / Quartier, sans GPS

- **Statut :** accepté
- **Date :** 2026-11-02
- **Décideur :** Ange

## Contexte

Le brief demande de filtrer les candidats par ville, arrondissement, quartier et rayon géographique « si données disponibles ». Le code actuel n'a qu'une liste de villes (`lib/constants.ts`, `CITIES`, Yaoundé inactif) et une liste de quartiers de couverture du nettoyage à Douala (`content/zones-coverage.ts`). Le brief indique une implantation à Douala **et** Yaoundé.

## Décision

1. **Référentiel en base, administrable** : Ville → Arrondissement → Quartier ; pré-rempli pour Douala (Douala I–V) et Yaoundé (Yaoundé I–VII) avec leurs principaux quartiers. Indicateur « ville couverte » (remplace `CITIES` et `zones-coverage.ts`). **Douala et Yaoundé sont couvertes dès la V1.**
2. Formulaires : listes en cascade, option **« Autre quartier »** (texte libre, revu par l'administrateur pour enrichir le référentiel) et champ libre **point de repère**.
3. **Zones de travail acceptées** du candidat : sélection multiple d'arrondissements et/ou de quartiers.
4. **Pas de géolocalisation GPS** en V1. Chaque quartier peut porter des **coordonnées approximatives (centroïde)** saisies par l'administrateur ; le **filtre par rayon** est disponible pour les quartiers renseignés.
5. Calcul de distance en base (PostgreSQL), sans service cartographique payant.

## Conséquences

- La qualité du filtre par rayon dépend du renseignement progressif des centroïdes.
- Les données saisies en « Autre » doivent être normalisées régulièrement pour rester filtrables.
- L'activation de Yaoundé modifie l'affichage public de la couverture (pages services, zones) : à vérifier lors de la migration.
