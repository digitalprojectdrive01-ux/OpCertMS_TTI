// ═══════════════════════════════════════════════════════════════
// OpCertMS — Supabase Proxy (Vercel Serverless)
// Credentials stored in Vercel env vars, never exposed to browser
// ═══════════════════════════════════════════════════════════════

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_KEY;

const ALLOWED_TABLES = [
  'employees','employee_photos','departments',
  'processes','certificates','app_config','app_users'
];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Prefer');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!SB_URL || !SB_KEY)
    return res.status(500).json({ error: 'Supabase not configured in environment variables' });

  const { table, ...queryParams } = req.query;
  if (!table) return res.status(400).json({ error: 'Missing table param' });
  if (!ALLOWED_TABLES.includes(table))
    return res.status(403).json({ error: 'Table not allowed: ' + table });

  const queryString = Object.entries(queryParams)
    .map(([k,v]) => `${k}=${v}`).join('&');

  const url = `${SB_URL}/rest/v1/${table}${queryString ? '?'+queryString : ''}`;

  try {
    const r = await fetch(url, {
      method: req.method,
      headers: {
        'Content-Type':  'application/json',
        'apikey':        SB_KEY,
        'Authorization': 'Bearer ' + SB_KEY,
        'Prefer':        req.headers['prefer'] || 'return=representation',
      },
      body: ['POST','PUT','PATCH'].includes(req.method)
        ? JSON.stringify(req.body) : undefined,
    });

    const text = await r.text();
    const data = text ? JSON.parse(text) : [];
    return res.status(r.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
