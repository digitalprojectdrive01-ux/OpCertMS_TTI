/**
 * /api/cron-alert.js — OpCertMS Scheduled Email Alert
 * 
 * Called by Vercel Cron Jobs daily at 08:00 Vietnam time (01:00 UTC)
 * Add to vercel.json:
 *   "crons": [{ "path": "/api/cron-alert", "schedule": "0 1 * * *" }]
 * 
 * Reads all certs from Supabase, emails alert if any expiring/expired.
 * Skips if RESEND_API_KEY or SUPABASE_URL not set.
 */

function fDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function daysLeft(exp) {
  return Math.round((new Date(exp) - new Date()) / 86400000);
}

function getSbHeaders() {
  return {
    'apikey': process.env.SUPABASE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function sbGet(table, qs = '') {
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${table}?${qs}`, { headers: getSbHeaders() });
  if (!r.ok) return [];
  return r.json();
}

async function sbSet(key, value) {
  await fetch(`${process.env.SUPABASE_URL}/rest/v1/app_config`, {
    method: 'POST',
    headers: { ...getSbHeaders(), 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify({ key, value: String(value) }),
  });
}

export default async function handler(req, res) {
  // Security: only accept requests from Vercel Cron or with secret header
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  if (!process.env.RESEND_API_KEY || !process.env.SUPABASE_URL) {
    return res.json({ skipped: true, reason: 'RESEND_API_KEY or SUPABASE_URL not configured' });
  }

  try {
    // Load email config from Supabase
    const cfgRows = await sbGet('app_config', 'key=like.email_%');
    const cfg = {};
    for (const row of cfgRows) cfg[row.key.replace('email_', '')] = row.value;

    // Check if email alerts are enabled
    if (cfg.enabled !== 'true') {
      return res.json({ skipped: true, reason: 'Email alerts disabled in settings' });
    }

    const recipients    = (cfg.recipients || '').split(',').map(s => s.trim()).filter(Boolean);
    const thresholdDays = parseInt(cfg.threshold_days) || 30;
    const company       = cfg.company       || 'TTI Group';
    const fromEmail     = cfg.from_email    || 'no-reply@wiseorbit.app';
    const fromName      = cfg.from_name     || 'OpCertMS Alert';

    if (!recipients.length) {
      return res.json({ skipped: true, reason: 'No recipients configured' });
    }

    // Check schedule — only send on configured days (e.g., "1,3,5" = Mon,Wed,Fri)
    const sendDays = (cfg.send_days || '1,2,3,4,5').split(',').map(Number);
    const today = new Date().getDay(); // 0=Sun,1=Mon,...
    if (!sendDays.includes(today)) {
      return res.json({ skipped: true, reason: `Not a send day (today: ${today})` });
    }

    // Load certificates from Supabase
    const certs = await sbGet('certificates', 'order=exp.asc&limit=500');

    // Filter certificates that need alerting
    const alertCerts = certs.filter(c => {
      const d = daysLeft(c.exp);
      return d < 0 || d <= thresholdDays;
    });

    if (!alertCerts.length) {
      await sbSet('email_last_run', new Date().toISOString());
      await sbSet('email_last_count', '0');
      return res.json({ sent: false, reason: 'No certificates to alert', checked: certs.length });
    }

    // Build email
    const expired = alertCerts.filter(c => daysLeft(c.exp) < 0);
    const expiring = alertCerts.filter(c => { const d = daysLeft(c.exp); return d >= 0 && d <= thresholdDays; });
    const subject = `⚠️ OpCertMS Daily Alert — ${expired.length > 0 ? `${expired.length} Expired, ` : ''}${expiring.length} Expiring Soon [${new Date().toLocaleDateString('vi-VN')}]`;

    const certRows = (list, isExpired) => list.map(c => {
      const d = daysLeft(c.exp);
      const color = isExpired ? '#E74C3C' : '#E67E22';
      const label = isExpired ? `Expired ${Math.abs(d)} days ago` : `${d} days left`;
      return `<tr style="border-bottom:1px solid #f0f0f0">
        <td style="padding:9px 12px;font-size:13px;color:#2c2c2c;font-weight:600">${c.enm || '—'}</td>
        <td style="padding:9px 12px;font-size:12px;color:#555">${c.pnm || '—'}</td>
        <td style="padding:9px 12px;font-size:12px;color:#555">Level ${c.lv || '—'}</td>
        <td style="padding:9px 12px;font-size:12px;color:#555">${fDate(c.exp)}</td>
        <td style="padding:9px 12px"><span style="background:${color};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700">${label}</span></td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:Calibri,Arial,sans-serif">
<div style="max-width:660px;margin:0 auto;padding:20px 16px">
  <div style="background:#C0392B;border-radius:10px 10px 0 0;padding:24px 28px">
    <div style="font-size:20px;font-weight:700;color:#fff">⚠️ OpCertMS — Daily Certificate Alert</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.75);margin-top:4px">Cảnh báo chứng chỉ tự động • ${new Date().toLocaleDateString('vi-VN')}</div>
  </div>
  <div style="background:#fff;padding:24px 28px;border:1px solid #e8e8e8">
    <p style="margin:0 0 20px;font-size:14px;color:#444">
      Hệ thống <strong>OpCertMS</strong> phát hiện <strong style="color:#C0392B">${alertCerts.length} chứng chỉ</strong> cần xử lý tại <strong>${company}</strong>.
    </p>
    <div style="display:flex;gap:12px;margin-bottom:24px">
      ${expired.length > 0 ? `<div style="flex:1;background:#FDEDEC;border:1px solid #F1948A;border-radius:8px;padding:12px;text-align:center"><div style="font-size:30px;font-weight:900;color:#C0392B">${expired.length}</div><div style="font-size:11px;color:#922B21;font-weight:600">EXPIRED</div></div>` : ''}
      ${expiring.length > 0 ? `<div style="flex:1;background:#FEF9E7;border:1px solid #F9E79F;border-radius:8px;padding:12px;text-align:center"><div style="font-size:30px;font-weight:900;color:#E67E22">${expiring.length}</div><div style="font-size:11px;color:#935116;font-weight:600">EXPIRING SOON</div></div>` : ''}
    </div>
    ${expired.length > 0 ? `<h3 style="margin:0 0 10px;font-size:13px;color:#C0392B;border-left:3px solid #C0392B;padding-left:8px">Đã hết hạn (${expired.length})</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <thead><tr style="background:#f8f8f8">
        <th style="padding:8px 12px;text-align:left;font-size:10px;color:#888">EMPLOYEE</th>
        <th style="padding:8px 12px;text-align:left;font-size:10px;color:#888">PROCESS</th>
        <th style="padding:8px 12px;text-align:left;font-size:10px;color:#888">LEVEL</th>
        <th style="padding:8px 12px;text-align:left;font-size:10px;color:#888">EXPIRY</th>
        <th style="padding:8px 12px;text-align:left;font-size:10px;color:#888">STATUS</th>
      </tr></thead>
      <tbody>${certRows(expired, true)}</tbody>
    </table>` : ''}
    ${expiring.length > 0 ? `<h3 style="margin:0 0 10px;font-size:13px;color:#E67E22;border-left:3px solid #E67E22;padding-left:8px">Sắp hết hạn trong ${thresholdDays} ngày (${expiring.length})</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <thead><tr style="background:#f8f8f8">
        <th style="padding:8px 12px;text-align:left;font-size:10px;color:#888">EMPLOYEE</th>
        <th style="padding:8px 12px;text-align:left;font-size:10px;color:#888">PROCESS</th>
        <th style="padding:8px 12px;text-align:left;font-size:10px;color:#888">LEVEL</th>
        <th style="padding:8px 12px;text-align:left;font-size:10px;color:#888">EXPIRY</th>
        <th style="padding:8px 12px;text-align:left;font-size:10px;color:#888">STATUS</th>
      </tr></thead>
      <tbody>${certRows(expiring, false)}</tbody>
    </table>` : ''}
    <div style="text-align:center;margin-top:20px">
      <a href="https://opcert-tti.vercel.app" style="background:#C0392B;color:#fff;text-decoration:none;padding:11px 24px;border-radius:7px;font-weight:700;font-size:13px;display:inline-block">🔗 Vào OpCertMS để gia hạn</a>
    </div>
  </div>
  <div style="background:#1A1A1A;border-radius:0 0 10px 10px;padding:14px 28px;text-align:center">
    <p style="margin:0;font-size:11px;color:#888">Email tự động từ <strong style="color:#ccc">OpCertMS</strong> • ${company} • <a href="https://opcert-tti.vercel.app" style="color:#aaa">opcertms.vercel.app</a></p>
  </div>
</div></body></html>`;

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `${fromName} <${fromEmail}>`, to: recipients, subject, html }),
    });

    const data = await r.json();

    await sbSet('email_last_run', new Date().toISOString());
    await sbSet('email_last_count', String(alertCerts.length));

    if (!r.ok) return res.json({ sent: false, error: data.message });
    return res.json({ sent: true, count: alertCerts.length, recipients: recipients.length, id: data.id });

  } catch (err) {
    console.error('cron-alert error:', err);
    return res.status(500).json({ error: err.message });
  }
}
