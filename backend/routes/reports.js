const router = require('express').Router();
const auth   = require('../middleware/auth');
const ds     = require('../services/dataStore');
const email  = require('../services/email');
const { buildAndSendReport } = require('../jobs/report-sender');

// GET /api/reports/test-email — must be before /:clientId to avoid route collision
router.get('/test-email', auth, async (req, res) => {
  try {
    const target = process.env.ADMIN_EMAIL || 'info@ampwake.com';
    await email.sendTestEmail(target);
    res.json({ ok: true, sentTo: target });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/:clientId — list all past reports (metadata only, no HTML)
router.get('/:clientId', auth, (req, res) => {
  const reports = ds.getReports(req.params.clientId).map(r => {
    const { htmlContent, ...meta } = r; // strip any inline HTML if present
    return meta;
  });
  res.json(reports);
});

// GET /api/reports/:clientId/:monthYear — return saved HTML for a specific report
router.get('/:clientId/:monthYear', auth, (req, res) => {
  const { clientId, monthYear } = req.params;

  // Validate YYYY-MM format
  if (!/^\d{4}-\d{2}$/.test(monthYear)) {
    return res.status(400).json({ error: 'monthYear must be YYYY-MM format' });
  }

  const html = ds.getReportHtml(clientId, monthYear);
  if (!html) return res.status(404).json({ error: 'Report not found' });
  res.json({ monthYear, html });
});

async function triggerReport(req, res) {
  const client = ds.getClient(req.params.clientId);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  try {
    const now        = new Date();
    const monthYear  = req.body?.monthYear
      || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = new Date(monthYear + '-01').toLocaleString('en-IN', { month: 'long', year: 'numeric' });

    const report = await buildAndSendReport(client, monthYear, monthLabel);
    res.json(report);
  } catch (err) {
    console.error('[reports/send-now]', err.message);
    res.status(500).json({ error: err.message });
  }
}

// POST /api/reports/:clientId/send-now — manually trigger report generation + send
router.post('/:clientId/send-now', auth, triggerReport);

// Backward-compat alias
router.post('/:clientId/send', auth, triggerReport);

module.exports = router;
