module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const q = (req.query.q || '').trim();
  if (!q) return res.status(200).json({ results: [] });

  try {
    const url = `https://www.4sale.com.kw/ar/q/${encodeURIComponent(q)}?cat=cars&seller_type=private&sort=date`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ar,en;q=0.9',
        'Referer': 'https://www.4sale.com.kw/',
      }
    });

    if (!resp.ok) return res.status(200).json({ results: [], error: `HTTP ${resp.status}` });

    const html = await resp.text();

    // Extract __NEXT_DATA__
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) {
      // return debug info
      const snippet = html.substring(0, 600);
      return res.status(200).json({ results: [], debug: { html_length: html.length, snippet } });
    }

    const nextData = JSON.parse(m[1]);
    const pp = nextData?.props?.pageProps;

    // Try multiple paths
    const items =
      pp?.listings?.items ||
      pp?.listings ||
      pp?.items ||
      pp?.data?.listings ||
      pp?.data?.items ||
      [];

    const results = items.slice(0, 50).map(item => {
      // Extract attributes
      const attrs = {};
      const attrList = item.attributes || item.attrs || item.specs || [];
      if (Array.isArray(attrList)) {
        attrList.forEach(a => {
          const key = (a.key || a.name || a.slug || '').toLowerCase();
          const val = a.value || a.val || '';
          attrs[key] = val;
        });
      }

      const price = parseFloat(String(item.price || item.listing_price || 0).replace(/[^0-9.]/g, ''));

      return {
        id: String(item.id || item.listing_id || ''),
        title: item.title || item.name || '',
        price,
        price_text: price ? price.toLocaleString() + ' د.ك' : '—',
        year: item.year || item.model_year || attrs['year'] || attrs['سنة'] || '—',
        color: item.color || attrs['color'] || attrs['اللون'] || attrs['colour'] || '—',
        km: item.mileage || item.kilometers || item.km || attrs['mileage'] || attrs['الكيلومترات'] || attrs['km'] || '—',
        original_paint: item.original_paint || attrs['original_paint'] || attrs['صبغ'] || attrs['original paint'] || '—',
        condition: item.condition || attrs['condition'] || attrs['الحالة'] || '—',
        location: item.area?.name_ar || item.location || item.city || '—',
        url: item.url || item.link || `https://www.4sale.com.kw/ar/listing/${item.id}`,
        image: item.images?.[0]?.url || item.thumbnail || item.image || '',
        raw_attrs: attrList.slice(0, 10),
      };
    });

    res.status(200).json({ results, total: results.length });

  } catch (e) {
    res.status(200).json({ results: [], error: e.message });
  }
};
