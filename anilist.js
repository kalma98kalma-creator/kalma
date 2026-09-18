// anilist.js
// Petit client pour l'API GraphQL publique d'AniList (https://anilist.co).
// Pas besoin de clé d'API pour ces requêtes en lecture seule.

const fetch = require('node-fetch');

const ANILIST_URL = 'https://graphql.anilist.co';

// AniList applique un rate-limit (généralement 30 requêtes/minute pour les
// clients non authentifiés). On reste largement en dessous car ce service
// n'interroge l'API que toutes les quelques heures (voir cache.js), jamais
// à chaque requête utilisateur.
async function anilistQuery(query, variables = {}) {
  const res = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`AniList API error ${res.status}: ${text}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(`AniList GraphQL error: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

// 1) Anime pas encore sortis, triés par date de début (les vraies "nouveautés").
const UPCOMING_QUERY = `
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage }
    media(
      type: ANIME
      status: NOT_YET_RELEASED
      sort: START_DATE
      isAdult: false
    ) {
      id
      title { romaji english native userPreferred }
      startDate { year month day }
      format
      genres
      studios(isMain: true) { nodes { name } }
      coverImage { large color }
      description(asHtml: false)
      siteUrl
    }
  }
}`;

// 2) Prochains épisodes des animes en cours de diffusion (les "suites").
const AIRING_SCHEDULE_QUERY = `
query ($page: Int, $perPage: Int, $from: Int, $to: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage }
    airingSchedules(
      airingAt_greater: $from
      airingAt_lesser: $to
      sort: TIME
    ) {
      airingAt
      episode
      media {
        id
        title { romaji english native userPreferred }
        format
        genres
        studios(isMain: true) { nodes { name } }
        coverImage { large color }
        siteUrl
        status
      }
    }
  }
}`;

// 3) Recherche libre par nom (utilisée par la barre de recherche de l'appli).
// Contrairement aux deux requêtes ci-dessus, celle-ci part d'un texte tapé
// par l'utilisateur et n'est donc jamais mise en cache : elle est appelée
// à la demande, avec un petit debounce côté appli pour ne pas spammer AniList.
const SEARCH_QUERY = `
query ($search: String, $perPage: Int) {
  Page(page: 1, perPage: $perPage) {
    media(
      search: $search
      type: ANIME
      sort: POPULARITY_DESC
      isAdult: false
    ) {
      id
      title { romaji english native userPreferred }
      status
      format
      startDate { year month day }
      genres
      studios(isMain: true) { nodes { name } }
      coverImage { large color }
      description(asHtml: false)
      siteUrl
      nextAiringEpisode { airingAt episode }
    }
  }
}`;

async function searchAnime(search, { perPage = 12 } = {}) {
  if (!search || search.trim().length < 2) return [];
  const data = await anilistQuery(SEARCH_QUERY, { search: search.trim(), perPage });
  return data.Page.media;
}

async function fetchUpcomingAnime({ maxPages = 3, perPage = 25 } = {}) {
  const all = [];
  for (let page = 1; page <= maxPages; page++) {
    const data = await anilistQuery(UPCOMING_QUERY, { page, perPage });
    all.push(...data.Page.media);
    if (!data.Page.pageInfo.hasNextPage) break;
  }
  return all;
}

async function fetchAiringSchedule({ daysAhead = 60, perPage = 50 } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const to = now + daysAhead * 86400;
  const all = [];
  let page = 1;
  // On plafonne à 10 pages par sécurité pour éviter une boucle infinie
  // si l'API renvoie toujours hasNextPage: true.
  while (page <= 10) {
    const data = await anilistQuery(AIRING_SCHEDULE_QUERY, {
      page, perPage, from: now, to,
    });
    all.push(...data.Page.airingSchedules);
    if (!data.Page.pageInfo.hasNextPage) break;
    page++;
  }
  return all;
}

module.exports = { fetchUpcomingAnime, fetchAiringSchedule, searchAnime };
