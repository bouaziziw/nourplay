# Phase 14 — Analytiques de visionnage sur les profils enfants

**Date :** 2026-05-27  
**Commit :** `80c49f1 feat(phase-14): profile watch analytics — stats tab on profile detail page`  
**Statut :** Complétée

---

## Scope

Ajout d'un onglet "Statistiques" sur la page de détail d'un profil enfant, affichant les analytiques de visionnage agrégées à partir de `WatchHistory`. Aucun tracking comportemental fin — uniquement des agrégations accessibles aux adultes responsables du profil.

---

## Fonctionnalités implémentées

### Onglet Statistiques (`profiles/[id]/page.tsx`)

Ajout d'un 3ème onglet **Statistiques** sur la page de détail du profil (en plus de *Paramètres* et *Historique*).

**Métriques affichées :**

| Métrique | Description |
|---|---|
| Temps total de visionnage | Somme de `durationWatchedSec` sur la période sélectionnée |
| Temps moyen par session | `totalDuration / nombreDeSessions` |
| Nombre de vidéos vues | Nombre d'entrées `WatchHistory` uniques |
| Taux de complétion | % de vidéos regardées jusqu'au bout (`completed: true`) |
| Répartition par langue | Camembert des langues des vidéos regardées |
| Répartition par catégorie | Top 5 des catégories/playlists les plus regardées |
| Activité par jour | Histogramme des 30 derniers jours (minutes par jour) |
| Vidéos les plus regardées | Top 5 avec thumbnail, titre, temps total |

**Filtres de période :**
- 7 derniers jours / 30 derniers jours / 90 derniers jours / Tout

### Endpoint API

`GET /api/v1/users/me/profiles/:id/stats?period=30d`

Réponse :

```json
{
  "totalMinutes": 245,
  "avgMinutesPerSession": 18,
  "videosWatched": 14,
  "completionRate": 0.71,
  "byLanguage": [
    { "language": "fr", "minutes": 180 },
    { "language": "en", "minutes": 65 }
  ],
  "dailyActivity": [
    { "date": "2026-05-01", "minutes": 22 },
    ...
  ],
  "topVideos": [
    { "videoId": "...", "title": "...", "thumbnail": "...", "minutes": 45 }
  ]
}
```

**Requête Prisma :** agrégation `groupBy` + `_sum` sur `WatchHistory`, filtrée par `profileId` et plage de dates.

### Visualisations

Graphiques légers implémentés sans bibliothèque externe (SVG inline) :
- **Histogramme daily** : barres SVG proportionnelles avec tooltip au survol
- **Camembert langues** : SVG path arc calculé en JavaScript
- **Top vidéos** : liste avec barre de progression proportionnelle

> Le choix d'éviter Chart.js / Recharts réduit le bundle de ~300KB.

---

## Respect de la vie privée des enfants

Conformément au BRIEF et aux recommandations CNIL :

- Les statistiques sont **uniquement accessibles à l'adulte responsable** du profil (pas d'accès self-service par l'enfant)
- Les données sont **agrégées** — pas d'exportation des entrées `WatchHistory` brutes depuis cet écran
- Pas de comparaison entre profils d'enfants différents
- Pas de publicité ciblée ou de recommandations basées sur ces données
- Les données de visionnage sont couvertes par le droit à l'effacement (`DELETE /users/me/profiles/:id/history`)

---

## Choix techniques

| Décision | Choix | Raison |
|---|---|---|
| Agrégation côté API | Prisma `groupBy` + `_sum` | Évite de transférer les entrées brutes au client |
| Pas de bibliothèque graphique | SVG inline | Bundle réduit, pas de dépendance externe à maintenir |
| Pas de cache Redis | Requête directe PG | Volume faible au MVP — cache à ajouter en V1 si nécessaire |
| Période max | 90 jours | Équilibre utilité / performance des requêtes |

---

## Tests effectués

- Stats retournées correctement pour une période de 30 jours avec données variées (✓)
- Taux de complétion à 0% quand aucune vidéo complétée (✓)
- Histogramme daily : jours sans visionnage → barre absente (pas de valeur 0 fictive) (✓)
- Accès aux stats d'un profil appartenant à un autre utilisateur → 403 Forbidden (✓)
- Filtrage par période : `period=7d` vs `period=90d` → résultats différents (✓)

---

## Ce qui reste à faire (Phase 15+)

- Limites de temps et alertes dépassement (notification parent quand la limite journalière est approchée)
- Export PDF des statistiques pour les enseignants
- Tableau de bord agrégé multi-profils pour les familles avec plusieurs enfants
