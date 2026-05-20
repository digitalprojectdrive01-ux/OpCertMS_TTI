// ═══════════════════════════════════════════════════════════════
// OpCertMS — Certificate Verification API (public, no auth)
// GET /api/verify?id=CERT-2024-0001   → verify single cert
// GET /api/verify?emp=EMP-001          → all certs for employee
// ═══════════════════════════════════════════════════════════════

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_KEY;

function certStatus(expiry_date) {
  const days = Math.round((new Date(expiry_date) - new Date()) / 86400000);
  return {
    days_left: days,
    status: days < 0 ? 'expired' : days <= 30 ? 'expiring_soon' : 'valid',
    valid: days >= 0,
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!SB_URL || !SB_KEY) return res.status(500).json({ error: 'Server not configured' });

  const headers = { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY };

  // ── Verify by Certificate ID ──────────────────────────────────
  if (req.query.id) {
    const id = req.query.id.trim().toUpperCase();
    const r = await fetch(
      `${SB_URL}/rest/v1/certificates?id=eq.${encodeURIComponent(id)}&select=id,emp_id,emp_name,proc_name,level,issue_date,expiry_date,issued_by`,
      { headers }
    );
    const certs = await r.json();
    if (!certs.length) return res.status(404).json({ error: 'Certificate not found', id });
    const c = certs[0];
    const s = certStatus(c.expiry_date);
    return res.json({
      type: 'certificate',
      ...s,
      certificate: {
        id: c.id, employee: c.emp_name, employee_id: c.emp_id,
        process: c.proc_name, level: c.level,
        issued: c.issue_date, expires: c.expiry_date,
        issued_by: c.issued_by,
      }
    });
  }

  // ── Verify by Employee ID (all certs) ─────────────────────────
  if (req.query.emp) {
    const empId = req.query.emp.trim().toUpperCase();

    // Get employee info
    const er = await fetch(
      `${SB_URL}/rest/v1/employees?id=eq.${encodeURIComponent(empId)}&select=id,name,dept,pos`,
      { headers }
    );
    const emps = await er.json();
    if (!emps.length) return res.status(404).json({ error: 'Employee not found', emp: empId });
    const emp = emps[0];

    // Get all certs
    const cr = await fetch(
      `${SB_URL}/rest/v1/certificates?emp_id=eq.${encodeURIComponent(empId)}&select=id,proc_name,level,issue_date,expiry_date&order=expiry_date.desc`,
      { headers }
    );
    const certs = await cr.json();

    return res.json({
      type: 'employee',
      employee: { id: emp.id, name: emp.name, dept: emp.dept, position: emp.pos },
      certificates: certs.map(c => ({
        id: c.id, process: c.proc_name, level: c.level,
        issued: c.issue_date, expires: c.expiry_date,
        ...certStatus(c.expiry_date),
      }))
    });
  }

  return res.status(400).json({ error: 'Provide ?id= or ?emp= parameter' });
};
