// cache.js
// Toute la logique "récup automatique" vit ici : on interroge AniList
// périodiquement en arrière-plan, on garde le résultat en mémoire, et
// les routes de l'API ne font QUE lire ce cache — jamais d'appel AniList
// pendant qu'un utilisateur attend une réponse.

const { fetchUpcomingAnime, fetchAiringSchedule } = require('./anilist');

const REFRESH_INTERVAL_MS = 4 * 60 * 60 * 1000; // toutes les 4h

let state = {
  items: [],          // liste normalisée, prête à envoyer à l'appli
  lastUpdated: null,
  lastError: null,
  isRefreshing: false,
};

function normalize({ upcoming, schedule }) {
  const fromUpcoming = upcoming.map((m) => ({
    id: `media-${m.id}`,
    title: m.title.userPreferred || m.title.romaji || m.title.english,
    type: 'new',
    date: m.startDate?.year
      ? `${m.startDate.year}-${String(m.startDate.month || 1).padStart(2, '0')}-${String(m.startDate.day || 1).padStart(2, '0')}`
      : null,
    format: m.format,
    genres: m.genres,
    studio: m.studios?.nodes?.[0]?.name || null,
    coverUrl: m.coverImage?.large || null,
    accentColor: m.coverImage?.color || null,
    url: m.siteUrl,
  })).filter((item) => item.date); // on ignore les dates encore inconnues

  const fromSchedule = schedule.map((s) => ({
    id: `episode-${s.media.id}-${s.episode}`,
    title: s.media.title.userPreferred || s.media.title.romaji,
    type: 'episode',
    episode: s.episode,
    date: new Date(s.airingAt * 1000).toISOString().slice(0, 10),
    format: s.media.format,
    genres: s.media.genres,
    studio: s.media.studios?.nodes?.[0]?.name || null,
    coverUrl: s.media.coverImage?.large || null,
    accentColor: s.media.coverImage?.color || null,
    url: s.media.siteUrl,
  }));

  return [...fromUpcoming, ...fromSchedule].sort((a, b) => a.date.localeCompare(b.date));
}

async function refresh() {
  if (state.isRefreshing) return; // évite les refresh concurrents
  state.isRefreshing = true;
  try {
    const [upcoming, schedule] = await Promise.all([
      fetchUpcomingAnime({ maxPages: 3, perPage: 25 }),
      fetchAiringSchedule({ daysAhead: 60, perPage: 50 }),
    ]);
    state.items = normalize({ upcoming, schedule });
    state.lastUpdated = new Date().toISOString();
    state.lastError = null;
    console.log(`[cache] Rafraîchi : ${state.items.length} entrées (${state.lastUpdated})`);
  } catch (err) {
    state.lastError = err.message;
    console.error('[cache] Échec du rafraîchissement AniList :', err.message);
    // Important : on garde les anciennes données (state.items n'est pas vidé)
    // plutôt que de casser l'appli si AniList est temporairement indisponible.
  } finally {
    state.isRefreshing = false;
  }
}

function startAutoRefresh() {
  refresh(); // un premier chargement immédiat au démarrage
  setInterval(refresh, REFRESH_INTERVAL_MS);
}

function getState() {
  return state;
}

module.exports = { startAutoRefresh, refresh, getState };
