// Vercel serverless function: GET /api/cs2prices
// Proxy cacheado de Skinport (ver api/_lib/skinport.js). La CDN de Vercel
// retiene la respuesta 5 min (s-maxage) y sirve stale mientras revalida.

import { getCs2Prices } from './_lib/skinport.js';

export default async function handler(req, res) {
  try {
    const data = await getCs2Prices();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify(data));
  } catch (e) {
    res.status(502).json({ error: String(e.message ?? e) });
  }
}
