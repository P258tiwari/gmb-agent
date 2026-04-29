const router = require('express').Router();
const auth   = require('../middleware/auth');
const ds     = require('../services/dataStore');
const serp   = require('../services/serp');

const VALID_STATUSES = ['Pending', 'Submitted', 'Verified'];

// GET /api/citations/:clientId
router.get('/:clientId', auth, (req, res) => {
  res.json(ds.getCitations(req.params.clientId));
});

// PUT /api/citations/:clientId/:citationId/status
router.put('/:clientId/:citationId/status', auth, (req, res) => {
  const status = req.body.status;
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const citations = ds.getCitations(req.params.clientId);
  const idx = citations.findIndex(c => c.id === req.params.citationId);
  if (idx < 0) return res.status(404).json({ error: 'Citation not found' });

  citations[idx] = {
    ...citations[idx],
    status,
    ...(status === 'Submitted' ? { submittedAt: new Date().toISOString() } : {}),
    ...(status === 'Verified'  ? { verifiedAt:  new Date().toISOString() } : {})
  };
  ds.saveCitations(req.params.clientId, citations);
  res.json(citations[idx]);
});

// POST /api/citations/:clientId/scan
// Re-run directory discovery and regenerate instructions
router.post('/:clientId/scan', auth, async (req, res) => {
  const client = ds.getClient(req.params.clientId);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  try {
    // Preserve manually-set statuses from existing citations (keyed by URL)
    const existing    = ds.getCitations(req.params.clientId);
    const statusByUrl = Object.fromEntries(existing.map(c => [c.siteUrl, c.status]));

    const citations = await serp.findCitations(client);

    // Re-apply saved statuses so user progress isn't lost on rescan
    const merged = citations.map(c => ({
      ...c,
      status: statusByUrl[c.siteUrl] || c.status
    }));

    ds.saveCitations(req.params.clientId, merged);
    res.json(merged);
  } catch (err) {
    console.error('[citations/scan]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
