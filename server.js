// server.js
// Point d'entrée. Démarre le rafraîchissement automatique (cache.js) puis
// sert une API REST simple que l'appli mobile consomme.

const express = require('express');
const cors = require('cors');
const { startAutoRefresh, refresh, getState } = require('./cache');

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
