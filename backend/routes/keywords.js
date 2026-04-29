const router = require('express').Router();
const auth   = require('../middleware/auth');
const ds     = require('../services/dataStore');
const claude = require('../services/claude');
const { friendlyError } = require('../utils/apiError');

// GET /api/keywords/:clientId
router.get('/:clientId', auth, (req, res) => {
  res.json(ds.getKeywords(req.params.clientId));
});

// POST /api/keywords/:clientId/regenerate
router.post('/:clientId/regenerate', auth, async (req, res) => {
  const client = ds.getClient(req.params.clientId);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  try {
    const keywords = await claude.generateKeywords(client);
    ds.saveKeywords(req.params.clientId, keywords);
    res.json(keywords);
  } catch (err) {
    const { status, error } = friendlyError(err);
    res.status(status).json({ error });
  }
});

module.exports = router;
