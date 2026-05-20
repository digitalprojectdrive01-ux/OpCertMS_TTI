// ═══════════════════════════════════════════════════════════════
// OpCertMS — Certificate Verification API (public, no auth)
// GET /api/verify?id=CERT-2024-0001
// ═══════════════════════════════════════════════════════════════

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing certificate ID' });

  if (!SB_URL || !SB_KEY) return res.status(500).json({ error: 'Server not configured' });

  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/certificates?id=eq.${encodeURIComponent(id)}&select=id,emp_name,emp_id,proc_name,level,issue_date,expiry_date`,
      { headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY } }
    );
    const certs = await r.json();
    if (!certs.length) return res.status(404).json({ error: 'Certificate not found', id });

    const c = certs[0];
    const now = new Date();
    const exp = new Date(c.expiry_date);
    const daysLeft = Math.round((exp - now) / 86400000);
    const status = daysLeft < 0 ? 'expired' : daysLeft <= 30 ? 'expiring_soon' : 'valid';

    return res.json({
      valid: status !== 'expired',
      status,
      days_left: daysLeft,
      certificate: {
        id:           c.id,
        employee:     c.emp_name,
        process:      c.proc_name,
        level:        c.level,
        issued:       c.issue_date,
        expires:      c.expiry_date,
      }
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
