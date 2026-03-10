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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: 'أنت مساعد بحث. ابحث دائماً ثم أرجع النتائج كـ JSON فقط بدون أي نص إضافي.',
        messages: [{
          role: 'user',
          content: `ابحث في 4sale.com.kw عن سيارات "${q}" من أفراد في الكويت.
بعد البحث أرجع JSON فقط بهذا الشكل:
{"results":[{"title":"اسم السيارة","price_text":"السعر","year":"السنة","color":"اللون","km":"الكيلومترات","original_paint":"صبغ الوكالة","condition":"الحالة","location":"المنطقة","url":"الرابط"}]}`
        }]
      })
    });

    const data = await response.json();

    let text = '';
    for (const block of data.content || []) {
      if (block.type === 'text') text += block.text;
    }

    const jsonMatch = text.match(/\{[\s\S]*"results"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return res.status(200).json(parsed);
    }

    res.status(200).json({
      results: [],
      debug: {
        content_types: (data.content || []).map(b => b.type),
        text_length: text.length,
        raw: text.substring(0, 800),
        stop_reason: data.stop_reason,
        api_error: data.error,
      }
    });

  } catch (e) {
    res.status(200).json({ results: [], error: e.message });
  }
};
