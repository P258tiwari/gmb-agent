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
  if (!tokens) return res.json([]);
  try {
    const locations = await gbp.getMyGbpLocations(tokens);
    res.json(locations);
  } catch (err) {
    console.error('[gbp/locations]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gbp/debug — raw API check for diagnosing location list issues
router.get('/gbp/debug', auth, async (req, res) => {
  const tokens = getAgencyTokens();
  if (!tokens) return res.json({ error: 'No agency tokens' });
  try {
    const { google } = require('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    oauth2Client.setCredentials(tokens);

    const accountsRes = await oauth2Client.request({
      url: 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts'
    });
    const accounts = accountsRes.data.accounts || [];

    const result = [];
    for (const acc of accounts) {
      try {
        const locRes = await oauth2Client.request({
          url: `https://mybusinessbusinessinformation.googleapis.com/v1/${acc.name}/locations`,
          params: { readMask: 'name,title,storefrontAddress,primaryCategory,metadata' }
        });
        result.push({ account: acc.name, locations: locRes.data });
      } catch (e) {
        result.push({ account: acc.name, error: e.message, status: e.response?.status, details: e.response?.data });
      }
    }

    res.json({ accounts: accounts.map(a => a.name), details: result });
  } catch (err) {
    res.status(500).json({
      error: err.message,
      status: err.response?.status,
      details: err.response?.data
    });
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

  // Prefer client-level tokens, fall back to agency tokens
  const tokens = client.gbpTokens || ds.getClientTokens(req.params.clientId) || getAgencyTokens();
  let accountId  = client.gbpAccountId  || client.accountId;
  let locationId = client.gbpLocationId || client.locationId;

  if (!tokens) {
    return res.status(400).json({
      error: 'Google not connected. Connect Google in Agency Settings first.'
    });
  }

  // Auto-discover accountId + locationId from gbpPlaceId if missing
  if ((!accountId || !locationId) && client.gbpPlaceId) {
    try {
      const found = await gbp.findLocationByPlaceId(tokens, client.gbpPlaceId);
      if (found) {
        accountId  = found.accountId;
        locationId = found.locationId;
        ds.saveClient({ ...client, gbpAccountId: accountId, gbpLocationId: locationId });
      }
    } catch (err) {
      console.error('[gbp/fetch] placeId lookup:', err.message);
    }
  }

  if (!accountId || !locationId) {
    return res.status(400).json({
      error: 'GBP location not found. Make sure the Business ID is correct and Google is connected.'
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
  const tokens     = client.gbpTokens || ds.getClientTokens(req.params.clientId) || getAgencyTokens();
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

// POST /api/clients/:clientId/gbp/sync — fetch profile + reviews + insights in one call
router.post('/clients/:clientId/gbp/sync', auth, async (req, res) => {
  const client = ds.getClient(req.params.clientId);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const tokens     = client.gbpTokens || ds.getClientTokens(req.params.clientId) || getAgencyTokens();
  const accountId  = client.gbpAccountId  || client.accountId;
  const locationId = client.gbpLocationId || client.locationId;

  const result = { profile: null, reviewsSynced: 0, insights: null, errors: [] };

  if (!tokens || !accountId || !locationId) {
    return res.json({ ...result, message: 'GBP not fully linked — set account and location IDs first' });
  }

  // 1. GBP profile
  try {
    const profile    = await gbp.fetchCurrentProfile(tokens, accountId, locationId);
    const gbpProfile = { ...profile, lastFetched: new Date().toISOString() };
    const info       = ds.getClientInfo(req.params.clientId) || {};
    ds.saveClientInfo(req.params.clientId, { ...info, gbpProfile });
    result.profile = gbpProfile;
  } catch (err) {
    console.error('[gbp/sync] profile:', err.message);
    result.errors.push(`Profile: ${err.message}`);
  }

  // 2. Reviews
  try {
    const gbpReviews = await gbp.getReviews(tokens, accountId, locationId);
    const local      = ds.getReviews(req.params.clientId);
    const localById  = new Map(local.map(r => [r.id, r]));
    for (const r of gbpReviews) {
      const existing = localById.get(r.id);
      localById.set(r.id, existing
        ? { ...existing, ...r, reply: r.reply || existing.reply, repliedAt: r.repliedAt || existing.repliedAt }
        : r
      );
    }
    const merged = [...localById.values()].sort((a, b) => new Date(b.date) - new Date(a.date));
    ds.saveReviews(req.params.clientId, merged);
    result.reviewsSynced = gbpReviews.length;
  } catch (err) {
    console.error('[gbp/sync] reviews:', err.message);
    result.errors.push(`Reviews: ${err.message}`);
  }

  // 3. Insights / performance
  try {
    const insights = await gbp.getInsights(tokens, accountId, locationId);
    const saved    = ds.getClient(req.params.clientId);
    ds.saveClient({
      ...saved,
      performance: {
        ...(saved.performance || {}),
        profileViews:      insights.profileViews      || 0,
        phoneCalls:        insights.phoneCalls         || 0,
        directionRequests: insights.directionClicks    || 0,
        websiteClicks:     insights.websiteClicks      || 0,
        searchImpressions: insights.searchImpressions  || 0,
        lastSynced:        new Date().toISOString()
      }
    });
    result.insights = insights;
  } catch (err) {
    console.error('[gbp/sync] insights:', err.message);
    result.errors.push(`Insights: ${err.message}`);
  }

  res.json(result);
});

module.exports = router;
