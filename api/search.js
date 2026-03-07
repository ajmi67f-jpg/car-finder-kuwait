module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const q = (req.query.q || '').trim() || 'سيارة';
  const min_price = req.query.min_price || '';
  const max_price = req.query.max_price || '';
  const out = { forsale: null, q8car: null };

  try {
    const url = `https://www.4sale.com.kw/ar/q/${encodeURIComponent(q)}?cat=cars&seller_type=private&sort=date`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ar,en;q=0.9',
      }
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();
    const parsed = parse4Sale(html, min_price, max_price);
    out.forsale = parsed.debug
      ? { source: '4Sale', listings: [], debug: parsed.debug }
      : { source: '4Sale', listings: parsed };
  } catch (e) {
    out.forsale = { source: '4Sale', listings: [], error: e.message };
  }

  try {
    const url = `https://q8car.com/used-cars?search=${encodeURIComponent(q)}`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ar,en;q=0.9',
      }
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();
    const parsed = parseQ8Car(html, min_price, max_price);
    out.q8car = parsed.debug
      ? { source: 'Q8Car', listings: [], debug: parsed.debug }
      : { source: 'Q8Car', listings: parsed };
  } catch (e) {
    out.q8car = { source: 'Q8Car', listings: [], error: e.message };
  }

  res.status(200).json({ results: out });
};

function priceFilter(price, min, max) {
  if (min && price > 0 && price < parseFloat(min)) return false;
  if (max && price > 0 && price > parseFloat(max)) return false;
  return true;
}

function parse4Sale(html, min_price, max_price) {
  const listings = [];
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (m) {
    try {
      const d = JSON.parse(m[1]);
      const pp = d && d.props && d.props.pageProps;
      const items = (pp && (
        (pp.listings && pp.listings.items) || pp.items ||
        (pp.data && pp.data.listings)
      )) || [];
      for (const item of items.slice(0, 30)) {
        const price = parseFloat(String(item.price || item.listing_price || 0).replace(/[^0-9.]/g, ''));
        if (!priceFilter(price, min_price, max_price)) continue;
        listings.push({
          id: String(item.id || Math.random().toString(36).slice(2)),
          title: item.title || item.name || '',
          price,
          price_text: price ? price.toLocaleString() + ' د.ك' : 'غير محدد',
          year: item.year || item.model_year || '',
          km: item.mileage || item.kilometers || item.km || '',
          location: (item.area && item.area.name_ar) || item.location || 'الكويت',
          image: (item.images && item.images[0] && item.images[0].url) || item.thumbnail || '',
          url: item.url || `https://www.4sale.com.kw/ar/listing/${item.id}`,
          source: '4Sale',
        });
      }
      if (listings.length > 0) return listings;
    } catch (e) {}
  }
  const prices = [...html.matchAll(/(\d[\d,]+)\s*(?:KD|د\.ك|دينار)/gi)].map(x => parseFloat(x[1].replace(/,/g,'')));
  return { debug: { site: '4Sale', html_length: html.length, has_next_data: !!m, sample_prices: prices.slice(0,5), snippet: html.substring(0,400) } };
}

function parseQ8Car(html, min_price, max_price) {
  const listings = [];
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (m) {
    try {
      const d = JSON.parse(m[1]);
      const pp = d && d.props && d.props.pageProps;
      const items = (pp && (pp.listings || pp.cars || (pp.data && (pp.data.listings || pp.data.cars)))) || [];
      for (const item of items.slice(0, 30)) {
        const price = parseFloat(String(item.price || 0).replace(/[^0-9.]/g, ''));
        if (!priceFilter(price, min_price, max_price)) continue;
        listings.push({
          id: String(item.id || Math.random().toString(36).slice(2)),
          title: item.title || item.name || '',
          price,
          price_text: price ? price.toLocaleString() + ' د.ك' : 'غير محدد',
          year: item.year || '',
          km: item.mileage || item.km || '',
          location: item.area || item.location || 'الكويت',
          image: item.image || item.thumbnail || '',
          url: item.url || `https://q8car.com/listing/${item.id}`,
          source: 'Q8Car',
        });
      }
      if (listings.length > 0) return listings;
    } catch (e) {}
  }
  const prices = [...html.matchAll(/(\d[\d,]+)\s*(?:KD|د\.ك|دينار)/gi)].map(x => parseFloat(x[1].replace(/,/g,'')));
  return { debug: { site: 'Q8Car', html_length: html.length, has_next_data: !!m, sample_prices: prices.slice(0,5), snippet: html.substring(0,400) } };
}
