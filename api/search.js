export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'يرجى إدخال كلمة البحث' });

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'مفتاح API غير موجود' });

  const prompt = `ابحث في موقع q84sale.com الكويتي عن سيارات مستعملة للبيع تطابق: "${q}"

البحث في: https://www.q84sale.com/ar/automotive/used-cars/

مهم جداً:
- ابحث عن إعلانات أفراد فقط (وليس معارض)
- استخرج أكبر عدد ممكن من النتائج (10-20 نتيجة)
- لكل سيارة استخرج: العنوان، السعر، السنة، اللون، الكيلومترات، صبغ الوكالة، الحالة، الموقع، رابط الإعلان، رابط الصورة

أجب فقط بـ JSON بدون أي نص إضافي بهذا الشكل بالضبط:
{
  "results": [
    {
      "title": "عنوان الإعلان",
      "price_text": "السعر مثل 5,000 د.ك",
      "year": "2020",
      "color": "أبيض",
      "km": "50000",
      "original_paint": "نعم أو لا أو —",
      "condition": "جيدة",
      "location": "المنطقة",
      "url": "https://www.q84sale.com/ar/listing/...",
      "image": "https://... أو null"
    }
  ]
}

إذا لم تجد نتائج أرجع: {"results": []}`;

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

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      return res.status(500).json({ error: `خطأ في API: ${apiRes.status}`, debug: errText });
    }

    const data = await apiRes.json();

    let text = '';
    for (const block of data.content || []) {
      if (block.type === 'text') text += block.text;
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(200).json({ debug: { raw: text.slice(0, 500), model_stop: data.stop_reason } });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
