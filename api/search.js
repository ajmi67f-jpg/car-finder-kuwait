module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const q = req.query.q;
  if (!q) return res.status(400).json({ error: 'no query' });

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'no API key' });

  const prompt = `Search q84sale.com Kuwait for used cars matching: "${q}"
Find 10-15 listings and respond ONLY with valid JSON, no other text:
{"results":[{"title":"...","price_text":"...","year":"...","color":"...","km":"...","original_paint":"yes or no or —","location":"...","url":"https://www.q84sale.com/ar/listing/...","image":null}]}`;

  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await apiRes.json();

    if (!apiRes.ok) {
      return res.status(500).json({ error: data.error?.message || apiRes.status });
    }

    let text = '';
    for (const block of (data.content || [])) {
      if (block.type === 'text') text += block.text;
    }

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.status(200).json({ results: [] });

    return res.status(200).json(JSON.parse(match[0]));

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
