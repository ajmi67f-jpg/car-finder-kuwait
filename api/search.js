module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const q = (req.query.q || '').trim();
  if (!q) return res.status(200).json({ results: [] });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 4000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `ابحث في موقع 4sale.com.kw عن سيارات "${q}" للبيع من أفراد في الكويت.
أرجع النتائج كـ JSON فقط بهذا الشكل بدون أي نص إضافي:
{"results":[{"title":"","price_text":"","year":"","color":"","km":"","original_paint":"","condition":"","location":"","url":""}]}`
        }]
      })
    });

    const data = await response.json();

    let text = '';
    for (const block of data.content || []) {
      if (block.type === 'text') text += block.text;
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return res.status(200).json(parsed);
    }

    res.status(200).json({ results: [], debug: { raw: text.substring(0, 500) } });

  } catch (e) {
    res.status(200).json({ results: [], error: e.message });
  }
};
