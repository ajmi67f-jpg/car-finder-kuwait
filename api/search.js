module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const q = (req.query.q || '').trim();
  if (!q) return res.status(200).json({ results: [] });

  try {
    const url = `https://api.opensooq.com/search?q=${encodeURIComponent(q)}&country_code=kw&category_id=2&lang=ar`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'ar',
        'Referer': 'https://kw.opensooq.com/',
      }
    });

    const data = await resp.json();
    const items = data?.data?.posts || data?.posts || data?.results || [];

    const results = items.slice(0, 50).map(item => {
      const price = parseFloat(String(item.price || 0).replace(/[^0-9.]/g, ''));
      return {
        title: item.title || item.subject || '',
        price_text: price ? price.toLocaleString() + ' د.ك' : '—',
        year: item.year || '—',
        color: item.color || '—',
        km: item.km || item.mileage || '—',
        original_paint: item.original_paint || '—',
        condition: item.condition || '—',
        location: item.city_label || item.area || '—',
        url: item.url || `https://kw.opensooq.com/post/${item.id}`,
        image: item.image || item.thumbnail || '',
      };
    });

    res.status(200).json({
      results,
      debug: results.length === 0 ? {
        status: resp.status,
        keys: Object.keys(data || {}),
        sample: JSON.stringify(data).substring(0, 500)
      } : undefined
    });

  } catch (e) {
    res.status(200).json({ results: [], error: e.message });
  }
};
