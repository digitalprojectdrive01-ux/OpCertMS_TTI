/**
 * /api/email.js — OpCertMS Email Alert API
 * 
 * Handles:
 *   POST { action: 'send_alert', certs: [...], config: {...} }
 *   POST { action: 'test', to: 'email@example.com', config: {...} }
 *   POST { action: 'save_config', config: {...} }
 *   GET  { action: 'get_config' }
 * 
 * Uses Resend API (free tier: 3,000 emails/month)
 * Set env var: RESEND_API_KEY in Vercel dashboard
 * 
 * Supabase is used to persist email config (reuses existing /api/db pattern)
 */

const RESEND_URL = 'https://api.resend.com/emails';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function daysLeft(exp) {
  return Math.round((new Date(exp) - new Date()) / 86400000);
}

function certStatus(exp) {
  const d = daysLeft(exp);
  if (d < 0) return 'Expired';
  if (d <= 30) return 'Expiring Soon';
  return 'Valid';
}

// ── Email Template ────────────────────────────────────────────────────────────
function buildEmailHTML(certs, company = 'TTI Group', thresholdDays = 30) {
  const expiring = certs.filter(c => certStatus(c.exp) === 'Expiring Soon');
  const expired  = certs.filter(c => certStatus(c.exp) === 'Expired');
  const total    = expiring.length + expired.length;

  const certRows = (list, isExpired) => list.map(c => {
    const d = daysLeft(c.exp);
    const color = isExpired ? '#E74C3C' : '#E67E22';
    const statusText = isExpired ? 'EXPIRED / Đã hết hạn' : `Expiring in ${d} days / Còn ${d} ngày`;
    return `
      <tr style="border-bottom:1px solid #f0f0f0">
        <td style="padding:10px 14px;font-size:13px;color:#2c2c2c;font-weight:600">${c.enm || '—'}</td>
        <td style="padding:10px 14px;font-size:12px;color:#555">${c.pnm || '—'}</td>
        <td style="padding:10px 14px;font-size:12px;color:#555">${c.lv || '—'}</td>
        <td style="padding:10px 14px;font-size:12px;color:#555">${fDate(c.exp)}</td>
        <td style="padding:10px 14px">
          <span style="background:${color};color:#fff;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:700">${statusText}</span>
        </td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Calibri,'Segoe UI',Arial,sans-serif">

  <div style="max-width:680px;margin:0 auto;padding:24px 16px">

    <!-- Header -->
    <div style="background:#C0392B;border-radius:10px 10px 0 0;padding:28px 32px">
      <div style="display:flex;align-items:center;gap:16px">
        <div style="background:#fff;border-radius:7px;padding:6px 12px">
          <span style="font-size:22px;font-weight:900;color:#C0392B;font-family:Arial Black,Arial">TTI</span>
        </div>
        <div>
          <div style="font-size:18px;font-weight:700;color:#fff;letter-spacing:1px">Certificate Expiry Alert</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.75);margin-top:2px">Cảnh báo chứng chỉ sắp hết hạn / đã hết hạn</div>
        </div>
      </div>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:28px 32px;border:1px solid #e8e8e8">

      <!-- Summary -->
      <p style="margin:0 0 20px;font-size:14px;color:#444;line-height:1.6">
        Xin chào,<br>
        Hệ thống <strong>OpCertMS</strong> phát hiện <strong style="color:#C0392B">${total} chứng chỉ</strong> cần chú ý tại <strong>${company}</strong>.
        Vui lòng xem xét và thực hiện gia hạn kịp thời.
      </p>

      <!-- Stats -->
      <div style="display:flex;gap:12px;margin-bottom:24px">
        ${expired.length > 0 ? `
        <div style="flex:1;background:#FDEDEC;border:1px solid #F1948A;border-radius:8px;padding:14px;text-align:center">
          <div style="font-size:32px;font-weight:900;color:#C0392B">${expired.length}</div>
          <div style="font-size:12px;color:#922B21;font-weight:600">EXPIRED / Đã hết hạn</div>
        </div>` : ''}
        ${expiring.length > 0 ? `
        <div style="flex:1;background:#FEF9E7;border:1px solid #F9E79F;border-radius:8px;padding:14px;text-align:center">
          <div style="font-size:32px;font-weight:900;color:#E67E22">${expiring.length}</div>
          <div style="font-size:12px;color:#935116;font-weight:600">EXPIRING SOON / Sắp hết hạn</div>
        </div>` : ''}
      </div>

      <!-- Expired table -->
      ${expired.length > 0 ? `
      <h3 style="margin:0 0 10px;font-size:14px;color:#C0392B;border-left:4px solid #C0392B;padding-left:10px">
        ❌ Đã hết hạn (${expired.length})
      </h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px">
        <thead>
          <tr style="background:#f8f8f8">
            <th style="padding:9px 14px;text-align:left;font-size:11px;color:#888;font-weight:600">EMPLOYEE</th>
            <th style="padding:9px 14px;text-align:left;font-size:11px;color:#888;font-weight:600">PROCESS</th>
            <th style="padding:9px 14px;text-align:left;font-size:11px;color:#888;font-weight:600">LEVEL</th>
            <th style="padding:9px 14px;text-align:left;font-size:11px;color:#888;font-weight:600">EXPIRY DATE</th>
            <th style="padding:9px 14px;text-align:left;font-size:11px;color:#888;font-weight:600">STATUS</th>
          </tr>
        </thead>
        <tbody>${certRows(expired, true)}</tbody>
      </table>` : ''}

      <!-- Expiring Soon table -->
      ${expiring.length > 0 ? `
      <h3 style="margin:0 0 10px;font-size:14px;color:#E67E22;border-left:4px solid #E67E22;padding-left:10px">
        ⚠️ Sắp hết hạn trong ${thresholdDays} ngày (${expiring.length})
      </h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px">
        <thead>
          <tr style="background:#f8f8f8">
            <th style="padding:9px 14px;text-align:left;font-size:11px;color:#888;font-weight:600">EMPLOYEE</th>
            <th style="padding:9px 14px;text-align:left;font-size:11px;color:#888;font-weight:600">PROCESS</th>
            <th style="padding:9px 14px;text-align:left;font-size:11px;color:#888;font-weight:600">LEVEL</th>
            <th style="padding:9px 14px;text-align:left;font-size:11px;color:#888;font-weight:600">EXPIRY DATE</th>
            <th style="padding:9px 14px;text-align:left;font-size:11px;color:#888;font-weight:600">STATUS</th>
          </tr>
        </thead>
        <tbody>${certRows(expiring, false)}</tbody>
      </table>` : ''}

      <!-- CTA -->
      <div style="text-align:center;margin:24px 0 8px">
        <a href="https://opcertms.vercel.app" style="display:inline-block;background:#C0392B;color:#fff;text-decoration:none;padding:12px 28px;border-radius:7px;font-weight:700;font-size:14px">
          🔗 Vào OpCertMS để gia hạn
        </a>
      </div>

    </div>

    <!-- Footer -->
    <div style="background:#1A1A1A;border-radius:0 0 10px 10px;padding:16px 32px;text-align:center">
      <p style="margin:0;font-size:11px;color:#888">
        Email này được gửi tự động bởi <strong style="color:#ccc">OpCertMS</strong> — ${company}<br>
        <a href="https://opcertms.vercel.app" style="color:#aaa">opcertms.vercel.app</a>
      </p>
    </div>
  </div>

</body>
</html>`;
}

// ── Supabase helpers ──────────────────────────────────────────────────────────
function getSbHeaders() {
  return {
    'apikey': process.env.SUPABASE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
}

async function sbGet(table, filter = '') {
  const url = `${process.env.SUPABASE_URL}/rest/v1/${table}?${filter}`;
  const r = await fetch(url, { headers: getSbHeaders() });
  if (!r.ok) return [];
  return r.json();
}

async function sbUpsert(table, data) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/${table}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { ...getSbHeaders(), 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(data),
  });
  return r.ok;
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET: return email config
    if (req.method === 'GET') {
      const rows = await sbGet('app_config', 'key=like.email_%');
      const cfg = {};
      for (const row of rows) cfg[row.key.replace('email_', '')] = row.value;
      return res.json({ ok: true, config: cfg });
    }

    const { action, certs, config, to } = req.body || {};
    const RESEND_KEY = process.env.RESEND_API_KEY;

    // ── save_config ───────────────────────────────────────────────────────────
    if (action === 'save_config') {
      if (!process.env.SUPABASE_URL) return res.json({ ok: false, error: 'No Supabase configured' });
      const entries = Object.entries(config || {}).map(([k, v]) => ({ key: `email_${k}`, value: String(v) }));
      for (const e of entries) await sbUpsert('app_config', e);
      return res.json({ ok: true });
    }

    // ── test ─────────────────────────────────────────────────────────────────
    if (action === 'test') {
      if (!RESEND_KEY) return res.json({ ok: false, error: 'RESEND_API_KEY not set in Vercel env vars' });
      const fromEmail = config?.from_email || 'onboarding@resend.dev';
      const fromName  = config?.from_name  || 'OpCertMS';
      const r = await fetch(RESEND_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: [to],
          subject: '✅ OpCertMS — Test Email',
          html: `<div style="font-family:Calibri,Arial,sans-serif;padding:32px;max-width:500px">
            <h2 style="color:#C0392B">✅ Email Alert Configured!</h2>
            <p>This is a test email from <strong>OpCertMS</strong>.</p>
            <p>If you received this, your email alert system is working correctly.</p>
            <p style="color:#888;font-size:12px">Sent from opcertms.vercel.app</p>
          </div>`,
        }),
      });
      const data = await r.json();
      if (!r.ok) return res.json({ ok: false, error: data.message || 'Resend API error' });
      return res.json({ ok: true, id: data.id });
    }

    // ── send_alert ────────────────────────────────────────────────────────────
    if (action === 'send_alert') {
      if (!RESEND_KEY) return res.json({ ok: false, error: 'RESEND_API_KEY not set in Vercel env vars' });

      const recipients   = (config?.recipients || '').split(',').map(s => s.trim()).filter(Boolean);
      const company      = config?.company || 'TTI Group';
      const fromEmail    = config?.from_email || 'onboarding@resend.dev';
      const fromName     = config?.from_name  || 'OpCertMS Alert';
      const thresholdDays= parseInt(config?.threshold_days) || 30;

      if (!recipients.length) return res.json({ ok: false, error: 'No recipient emails configured' });

      // Filter certs that need alerting
      const alertCerts = (certs || []).filter(c => {
        const d = daysLeft(c.exp);
        return d < 0 || d <= thresholdDays;
      });

      if (!alertCerts.length) return res.json({ ok: true, sent: false, reason: 'No certificates to alert' });

      const html    = buildEmailHTML(alertCerts, company, thresholdDays);
      const expired = alertCerts.filter(c => daysLeft(c.exp) < 0).length;
      const soon    = alertCerts.filter(c => { const d = daysLeft(c.exp); return d >= 0 && d <= thresholdDays; }).length;
      const subject = `⚠️ OpCertMS Alert — ${expired > 0 ? `${expired} Expired, ` : ''}${soon} Expiring Soon`;

      const r = await fetch(RESEND_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: `${fromName} <${fromEmail}>`, to: recipients, subject, html }),
      });

      const data = await r.json();
      if (!r.ok) return res.json({ ok: false, error: data.message || 'Failed to send' });

      // Log to Supabase
      if (process.env.SUPABASE_URL) {
        await sbUpsert('app_config', { key: 'email_last_sent', value: new Date().toISOString() });
        await sbUpsert('app_config', { key: 'email_last_count', value: String(alertCerts.length) });
      }

      return res.json({ ok: true, sent: true, count: alertCerts.length, id: data.id });
    }

    return res.status(400).json({ ok: false, error: 'Unknown action' });

  } catch (err) {
    console.error('email.js error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
