const https = require('https');
const http = require('http');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar-KW,ar;q=0.9,en;q=0.8',
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

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
      const items = (pp && (pp.listings && pp.listings.items || pp.items || pp.data && pp.data.listings)) || [];
      for (const item of items.slice(0, 30)) {
        const price = parseFloat(String(item.price || item.listing_price || 0).replace(/[^0-9.]/g, ''));
        if (!priceFilter(price, min_price, max_price)) continue;
        listings.push({
          id: String(item.id || item.listing_id || Math.random().toString(36).slice(2)),
          title: item.title || item.name || '',
          price,
          price_text: price ? price.toLocaleString('ar-KW') + ' د.ك' : 'غير محدد',
          year: item.year || item.model_year || '',
          km: item.mileage || item.kilometers || item.km || '',
          location: (item.area && item.area.name_ar) || item.location || item.city || 'الكويت',
          image: (item.images && item.images[0] && item.images[0].url) || item.thumbnail || item.image || '',
          url: item.url || item.link || ('https://www.4sale.com.kw/ar/listing/' + item.id),
          source: '4Sale',
        });
      }
      if (listings.length > 0) return listings;
    } catch (e) {}
  }
  const prices = [];
  const re = /(\d[\d,]+)\s*(?:KD|د\.ك|دينار)/gi;
  let px;
  while ((px = re.exec(html)) !== null) prices.push(parseFloat(px[1].replace(/,/g, '')));
  return { debug: { site: '4Sale', html_length: html.length, has_next_data: !!m, sample_prices: prices.slice(0, 5), snippet: html.substring(0, 400) } };
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
          price_text: price ? price.toLocaleString('ar-KW') + ' د.ك' : 'غير محدد',
          year: item.year || '',
          km: item.mileage || item.km || '',
          location: item.area || item.location || 'الكويت',
          image: item.image || item.thumbnail || '',
          url: item.url || ('https://www.q8car.com/listing/' + item.id),
          source: 'Q8Car',
        });
      }
      if (listings.length > 0) return listings;
    } catch (e) {}
  }
  const cardRe = /href="([^"]*\/(?:car|listing|ad)\/[^"]+)"[\s\S]{0,600}?(\d[\d,]+)\s*(?:KD|دينار|د\.ك)/gi;
  let cx;
  while ((cx = cardRe.exec(html)) !== null && listings.length < 20) {
    const price = parseFloat(cx[2].replace(/,/g, ''));
    if (!priceFilter(price, min_price, max_price)) continue;
    listings.push({
      id: Math.random().toString(36).slice(2),
      title: '', price,
      price_text: price.toLocaleString('ar-KW') + ' د.ك',
      year: '', km: '', location: 'الكويت', image: '',
      url: cx[1].startsWith('http') ? cx[1] : 'https://www.q8car.com' + cx[1],
      source: 'Q8Car',
    });
  }
  if (listings.length > 0) return listings;
  const prices = [];
  const re = /(\d[\d,]+)\s*(?:KD|د\.ك|دينار)/gi;
  let px;
  while ((px = re.exec(html)) !== null) prices.push(parseFloat(px[1].replace(/,/g, '')));
  return { debug: { site: 'Q8Car', html_length: html.length, has_next_data: !!m, sample_prices: prices.slice(0, 5), snippet: html.substring(0, 400) } };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const q = (req.query.q || '').trim() || 'سيارة';
  const min_price = req.query.min_price || '';
  const max_price = req.query.max_price || '';
  const out = { forsale: null, q8car: null };

  try {
    const url = 'https://www.4sale.com.kw/ar/q/' + encodeURIComponent(q) + '?cat=cars&seller_type=private&sort=date';
    const html = await fetchUrl(url);
    const parsed = parse4Sale(html, min_price, max_price);
    out.forsale = parsed.debug ? { source: '4Sale', listings: [], debug: parsed.debug } : { source: '4Sale', listings: parsed };
  } catch (e) {
    out.forsale = { source: '4Sale', listings: [], error: e.message };
  }

  try {
    const url = 'https://www.q8car.com/search?q=' + encodeURIComponent(q) + '&type=private';
    const html = await fetchUrl(url);
    const parsed = parseQ8Car(html, min_price, max_price);
    out.q8car = parsed.debug ? { source: 'Q8Car', listings: [], debug: parsed.debug } : { source: 'Q8Car', listings: parsed };
  } catch (e) {
    out.q8car = { source: 'Q8Car', listings: [], error: e.message };
  }

  res.status(200).json({ results: out });
};
