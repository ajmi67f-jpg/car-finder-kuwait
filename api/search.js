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
      "condition": "ج
