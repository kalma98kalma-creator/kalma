# Anime Radar — backend

Petit service qui va chercher automatiquement, toutes les 4h, les prochaines
sorties anime sur **AniList** (API publique, gratuite, pas de clé requise) et
les expose via une API REST simple pour l'appli mobile.

## Comment ça marche

```
AniList API  --(toutes les 4h)-->  cache.js (en mémoire)  --> server.js (routes)
```

- `anilist.js` — appelle l'API GraphQL d'AniList : les animes pas encore
  sortis (`UPCOMING_QUERY`) et les prochains épisodes des animes en cours
  (`AIRING_SCHEDULE_QUERY`).
- `cache.js` — tourne en tâche de fond, rafraîchit le cache toutes les 4h,
  et garde les anciennes données si AniList est indisponible (pas de crash
  côté appli).
- `server.js` — expose l'API que l'appli consomme. Aucune route ne parle
  directement à AniList : tout passe par le cache, donc les temps de
  réponse sont rapides et on ne risque pas de se faire limiter par AniList.

## Lancer le service

```bash
npm install
npm start
```

Le serveur démarre sur `http://localhost:3000` et charge les données dès le
démarrage (le premier chargement peut prendre quelques secondes).

## Routes disponibles

| Route | Description |
|---|---|
| `GET /api/upcoming` | Toutes les sorties à venir, triées par date |
| `GET /api/upcoming?type=new` | Uniquement les nouveaux animes (pas encore sortis) |
| `GET /api/upcoming?type=episode` | Uniquement les prochains épisodes de suites en cours |
| `GET /api/upcoming?within=14` | Uniquement ce qui sort dans les 14 prochains jours |
| `GET /api/status` | Vérifie l'état du cache (dernière mise à jour, erreurs éventuelles) |
| `POST /api/refresh` | Force un rafraîchissement immédiat (à protéger avant mise en prod) |

## Exemple de réponse

```json
{
  "lastUpdated": "2026-09-18T10:00:00.000Z",
  "count": 2,
  "results": [
    {
      "id": "episode-98444-5",
      "title": "Tokyo Revengers: War of the Three Titans",
      "type": "episode",
      "episode": 5,
      "date": "2026-10-02",
      "format": "TV",
      "genres": ["Action", "Drama"],
      "studio": "Liden Films",
      "coverUrl": "https://...",
      "accentColor": "#e15554",
      "url": "https://anilist.co/anime/98444"
    }
  ]
}
```

C'est exactement ce format que le prototype mobile (les maquettes qu'on a
faites) pourra brancher directement à la place des données statiques.

## Prochaines étapes possibles

- Remplacer le cache en mémoire par une petite base (SQLite/Postgres) si tu
  veux garder un historique ou ajouter des favoris utilisateur.
- Ajouter une route `/api/anime/:id` avec plus de détails (synopsis complet,
  bande-annonce, etc.) en piochant dans les champs AniList non utilisés ici.
- Héberger ce service (Render, Railway, Fly.io ont des offres gratuites
  suffisantes pour ce trafic) pour que l'appli mobile puisse l'appeler en
  production plutôt qu'en local.
