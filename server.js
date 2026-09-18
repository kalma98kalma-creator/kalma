// server.js
// Point d'entrée. Démarre le rafraîchissement automatique (cache.js) puis
// sert une API REST simple que l'appli mobile consomme.

const express = require('express');
const cors = require('cors');
const { startAutoRefresh, refresh, getState } = require('./cache');
const { searchAnime } = require('./anilist');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// GET /api/status — pour vérifier que le cache est bien alimenté
app.get('/api/status', (req, res) => {
  const { lastUpdated, lastError, items } = getState();
  res.json({
    ok: !lastError,
    lastUpdated,
    lastError,
    itemCount: items.length,
  });
});

// GET /api/upcoming — la route principale utilisée par l'appli
// Query params optionnels :
//   ?type=new|episode      filtre par type
//   ?within=30              ne garde que ce qui sort dans les X prochains jours
app.get('/api/upcoming', (req, res) => {
  const { items, lastUpdated } = getState();
  let result = items;

  if (req.query.type) {
    result = result.filter((i) => i.type === req.query.type);
  }
  if (req.query.within) {
    const days = parseInt(req.query.within, 10);
    const today = new Date().toISOString().slice(0, 10);
    const limit = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
    result = result.filter((i) => i.date >= today && i.date <= limit);
  }

  res.json({ lastUpdated, count: result.length, results: result });
});

// GET /api/search?q=... — recherche libre par nom, en direct sur AniList
// (pas de cache ici : c'est une requête à la demande, pas un flux périodique)
app.get('/api/search', async (req, res) => {
  const q = req.query.q || '';
  if (q.trim().length < 2) {
    return res.status(400).json({ error: 'Le paramètre q doit faire au moins 2 caractères.' });
  }
  try {
    const media = await searchAnime(q, { perPage: 12 });
    const results = media.map((m) => ({
      id: `media-${m.id}`,
      title: m.title.userPreferred || m.title.romaji || m.title.english,
      status: m.status, // NOT_YET_RELEASED | RELEASING | FINISHED | ...
      format: m.format,
      date: m.startDate?.year
        ? `${m.startDate.year}-${String(m.startDate.month || 1).padStart(2, '0')}-${String(m.startDate.day || 1).padStart(2, '0')}`
        : null,
      nextEpisode: m.nextAiringEpisode
        ? { episode: m.nextAiringEpisode.episode, date: new Date(m.nextAiringEpisode.airingAt * 1000).toISOString().slice(0, 10) }
        : null,
      genres: m.genres,
      studio: m.studios?.nodes?.[0]?.name || null,
      coverUrl: m.coverImage?.large || null,
      accentColor: m.coverImage?.color || null,
      description: m.description,
      url: m.siteUrl,
    }));
    res.json({ query: q, count: results.length, results });
  } catch (err) {
    res.status(502).json({ error: 'Recherche AniList indisponible pour le moment.', detail: err.message });
  }
});

// POST /api/refresh — force un rafraîchissement manuel (utile en debug ;
// à protéger ou retirer avant une mise en prod publique)
app.post('/api/refresh', async (req, res) => {
  await refresh();
  const { lastUpdated, lastError, items } = getState();
  res.json({ ok: !lastError, lastUpdated, lastError, itemCount: items.length });
});

app.listen(PORT, () => {
  console.log(`Anime Radar backend démarré sur http://localhost:${PORT}`);
  startAutoRefresh();
});
