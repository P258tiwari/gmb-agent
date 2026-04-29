const router  = require('express').Router();
const auth    = require('../middleware/auth');
const ds      = require('../services/dataStore');
const gbp     = require('../services/gbp');
const claude  = require('../services/claude');
const email   = require('../services/email');

function getAgencyTokens() {
  const data = ds.getAgencyData();
  if (!data) return null;
  // Support both old flat format and new { tokens, profile } format
  return data.tokens || (data.access_token ? data : null);
}

// ─── Agency-level ─────────────────────────────────────────────────────────────

// GET /api/gbp/agency/status — connected status + profile info
router.get('/gbp/agency/status', auth, (req, res) => {
  const data = ds.getAgencyData();
  if (!data || (!data.tokens && !data.access_token)) {
    return res.json({ connected: false, profile: null });
  }
  res.json({ connected: true, profile: data.profile || {} });
});

// POST /api/gbp/agency/disconnect
router.post('/gbp/agency/disconnect', auth, (req, res) => {
  ds.saveAgencyData({});
  res.json({ success: true });
});

// GET /api/gbp/locations — list all GBP locations linked to agency account
router.get('/gbp/locations', auth, async (req, res) => {
  const tokens = getAgencyTokens();
  if (!tokens) return res.json({ locations: [], message: 'Agency Google account not connected' });
  try {
    const locations = await gbp.getMyGbpLocations(tokens);
    res.json(locations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Client-specific GBP routes ───────────────────────────────────────────────

// GET /api/clients/:clientId/gbp/status
router.get('/clients/:clientId/gbp/status', auth, (req, res) => {
  const client = ds.getClient(req.params.clientId);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const info   = ds.getClientInfo(req.params.clientId) || {};
  const tokens = client.gbpTokens || ds.getClientTokens(req.params.clientId);

  res.json({
    googleConnected: !!tokens,
    gbpProfile:      info.gbpProfile || null,
    pendingGbpUpdate: info.pendingGbpUpdate || {
      status: 'none', proposedChanges: null, createdAt: null, approvedAt: null
    }
  });
});

// POST /api/clients/:clientId/gbp/fetch
router.post('/clients/:clientId/gbp/fetch', auth, async (req, res) => {
  const client = ds.getClient(req.params.clientId);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const tokens     = client.gbpTokens || ds.getClientTokens(req.params.clientId);
  const accountId  = client.gbpAccountId  || client.accountId;
  const locationId = client.gbpLocationId || client.locationId;

  if (!tokens || !accountId || !locationId) {
    return res.status(400).json({
      error: 'GBP credentials not set. Connect Google and set Account ID + Location ID first.'
    });
  }

  try {
    const profile    = await gbp.fetchCurrentProfile(tokens, accountId, locationId);
    const gbpProfile = { ...profile, lastFetched: new Date().toISOString() };

    const info = ds.getClientInfo(req.params.clientId) || {};
    ds.saveClientInfo(req.params.clientId, { ...info, gbpProfile });

    res.json(gbpProfile);
  } catch (err) {
    console.error('[gbp/fetch]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clients/:clientId/gbp/optimize
router.post('/clients/:clientId/gbp/optimize', auth, async (req, res) => {
  const client = ds.getClient(req.params.clientId);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const info = ds.getClientInfo(req.params.clientId) || {};

  try {
    const proposedChanges = await claude.generateGbpOptimization({
      ...client,
      gbpProfile: info.gbpProfile || {}
    });

    ds.saveClientInfo(req.params.clientId, {
      ...info,
      pendingGbpUpdate: {
        status:          'pending',
        proposedChanges,
        createdAt:       new Date().toISOString(),
        approvedAt:      null
      }
    });

    res.json({ proposedChanges });
  } catch (err) {
    console.error('[gbp/optimize]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/clients/:clientId/gbp/approve
router.put('/clients/:clientId/gbp/approve', auth, async (req, res) => {
  const client = ds.getClient(req.params.clientId);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const info          = ds.getClientInfo(req.params.clientId) || {};
  const pendingUpdate = info.pendingGbpUpdate;

  if (!pendingUpdate || pendingUpdate.status !== 'pending') {
    return res.status(400).json({ error: 'No pending GBP update found' });
  }

  // Allow caller to send edited changes; fall back to stored proposedChanges
  const changes    = req.body.changes || pendingUpdate.proposedChanges;
  const tokens     = client.gbpTokens || ds.getClientTokens(req.params.clientId);
  const accountId  = client.gbpAccountId  || client.accountId;
  const locationId = client.gbpLocationId || client.locationId;

  try {
    if (tokens && accountId && locationId) {
      await gbp.applyGbpUpdate(tokens, accountId, locationId, changes);
    } else {
      console.log('[gbp/approve] GBP not connected — saving approval locally only');
    }

    const updatedInfo = {
      ...info,
      gbpProfile: {
        ...(info.gbpProfile || {}),
        name:                changes.name               || info.gbpProfile?.name,
        primaryCategory:     changes.primaryCategory    || info.gbpProfile?.primaryCategory,
        secondaryCategories: changes.secondaryCategories || info.gbpProfile?.secondaryCategories,
        description:         changes.description        || info.gbpProfile?.description,
        services:            changes.services           || info.gbpProfile?.services,
        lastFetched:         new Date().toISOString()
      },
      pendingGbpUpdate: {
        ...pendingUpdate,
        status:          'approved',
        approvedChanges: changes,
        approvedAt:      new Date().toISOString()
      }
    };
    ds.saveClientInfo(req.params.clientId, updatedInfo);

    // Send confirmation email (non-blocking)
    const contactEmail = client.contactEmail || client.email;
    if (contactEmail) {
      email.sendGbpUpdateConfirmation(contactEmail, client.businessName || client.name, changes, info.gbpProfile)
        .catch(e => console.error('[gbp/approve] email error:', e.message));
    }

    res.json({ success: true, message: 'GBP profile updated successfully' });
  } catch (err) {
    console.error('[gbp/approve]', err.message);
    ds.saveClientInfo(req.params.clientId, {
      ...info,
      pendingGbpUpdate: {
        ...pendingUpdate,
        status:    'failed',
        failedAt:  new Date().toISOString(),
        failError: err.message
      }
    });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/clients/:clientId/gbp/reject
router.put('/clients/:clientId/gbp/reject', auth, (req, res) => {
  const info = ds.getClientInfo(req.params.clientId) || {};
  ds.saveClientInfo(req.params.clientId, {
    ...info,
    pendingGbpUpdate: {
      ...(info.pendingGbpUpdate || {}),
      status:     'rejected',
      rejectedAt: new Date().toISOString()
    }
  });
  res.json({ success: true });
});

module.exports = router;
