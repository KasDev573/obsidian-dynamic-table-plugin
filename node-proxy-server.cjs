const express = require('express');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const PORT = 3000;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

app.get('/proxy/:id', async (req, res) => {
  const { id } = req.params;
  // Support limit query param, default to 20 chapters if not provided
  const limit = req.query.limit || 5;

  const url = `https://api.mangadex.org/manga/${id}/feed?limit=${limit}&translatedLanguage[]=en&order[updatedAt]=desc`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch data', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Proxy server is running at http://localhost:${PORT}`);
});
