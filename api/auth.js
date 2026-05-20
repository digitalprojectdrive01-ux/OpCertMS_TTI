// ═══════════════════════════════════════════════════════════════
// OpCertMS — Supabase Auth Proxy
// Handles login via Supabase Auth + app_users table for roles
// ═══════════════════════════════════════════════════════════════

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!SB_URL || !SB_KEY) return res.status(500).json({ error: 'Server not configured' });

  const { action, email, password, token } = req.body || {};

  // ── LOGIN ──────────────────────────────────────────────────────
  if (action === 'login') {
    try {
      const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SB_KEY },
        body: JSON.stringify({ email, password }),
      });
      const data = await r.json();
      if (!r.ok) return res.status(401).json({ error: data.error_description || 'Invalid credentials' });

      // Get user role from app_users table
      const userRes = await fetch(
        `${SB_URL}/rest/v1/app_users?email=eq.${encodeURIComponent(email)}&select=email,role,full_name`,
        { headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY } }
      );
      const users = await userRes.json();
      const appUser = users[0];

      return res.json({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user: {
          id:         data.user.id,
          email:      data.user.email,
          role:       appUser?.role || 'viewer',
          full_name:  appUser?.full_name || data.user.email,
        }
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── VERIFY TOKEN ───────────────────────────────────────────────
  if (action === 'verify') {
    try {
      const r = await fetch(`${SB_URL}/auth/v1/user`, {
        headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + token },
      });
      if (!r.ok) return res.status(401).json({ error: 'Invalid token' });
      const user = await r.json();

      const userRes = await fetch(
        `${SB_URL}/rest/v1/app_users?email=eq.${encodeURIComponent(user.email)}&select=email,role,full_name`,
        { headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY } }
      );
      const users = await userRes.json();
      const appUser = users[0];

      return res.json({
        id:        user.id,
        email:     user.email,
        role:      appUser?.role || 'viewer',
        full_name: appUser?.full_name || user.email,
      });
    } catch (e) {
      return res.status(401).json({ error: 'Token verification failed' });
    }
  }

  // ── LOGOUT ─────────────────────────────────────────────────────
  if (action === 'logout') {
    try {
      await fetch(`${SB_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + token },
      });
      return res.json({ ok: true });
    } catch (e) {
      return res.json({ ok: true }); // always succeed logout
    }
  }

  return res.status(400).json({ error: 'Unknown action' });
};
