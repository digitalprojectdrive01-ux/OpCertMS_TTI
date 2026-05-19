// ═══════════════════════════════════════════════════════════════
// OpCertMS — Supabase Proxy (Vercel Serverless)
// Key is stored in Vercel env vars, never exposed to browser
// ═══════════════════════════════════════════════════════════════

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_KEY; // service_role or anon key

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Prefer');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!SB_URL || !SB_KEY) {
    return res.status(500).json({ error: 'Supabase not configured in environment variables' });
  }

  // Parse: /api/db/{table}?{query}
  const { table } = req.query;
  if (!table) return res.status(400).json({ error: 'Missing table' });

  // Whitelist tables
  const ALLOWED = ['employees','employee_photos','departments','processes','certificates','app_config'];
  if (!ALLOWED.includes(table)) {
    return res.status(403).json({ error: 'Table not allowed' });
  }

  const queryString = Object.entries(req.query)
    .filter(([k]) => k !== 'table')
    .map(([k,v]) => `${k}=${v}`)
    .join('&');

  const url = `${SB_URL}/rest/v1/${table}${queryString ? '?'+queryString : ''}`;

  try {
    const sbRes = await fetch(url, {
      method: req.method,
      headers: {
        'Content-Type':  'application/json',
        'apikey':        SB_KEY,
        'Authorization': 'Bearer ' + SB_KEY,
        'Prefer':        req.headers['prefer'] || 'return=representation',
      },
      body: ['POST','PUT','PATCH'].includes(req.method)
        ? JSON.stringify(req.body)
        : undefined,
    });

    const text = await sbRes.text();
    const data = text ? JSON.parse(text) : [];
    return res.status(sbRes.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
