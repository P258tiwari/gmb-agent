const router = require('express').Router();
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const authMiddleware = require('../middleware/auth');
const gbp    = require('../services/gbp');
const ds     = require('../services/dataStore');

// In-memory CSRF nonce store (cleared after use; fine for single-process server)
const pendingOAuth = new Map(); // nonce -> clientId

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (
    username === process.env.DASHBOARD_USERNAME &&
    password === process.env.DASHBOARD_PASSWORD
  ) {
    const token = jwt.sign(
      { username, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    return res.json({ token, username });
  }
  return res.status(401).json({ error: 'Invalid credentials' });
});

router.post('/logout', (req, res) => {
  // JWT is stateless — client drops the token; server just confirms
  res.json({ success: true });
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ username: req.user.username, role: req.user.role });
});

// GET /api/auth/google/agency — initiate agency-level Google OAuth
// Must be defined BEFORE /google/:clientId to prevent 'agency' matching as a clientId
router.get('/google/agency', (req, res) => {
  const nonce = crypto.randomBytes(16).toString('hex');
  pendingOAuth.set(nonce, 'agency');
  setTimeout(() => pendingOAuth.delete(nonce), 10 * 60 * 1000);

  const authUrl = gbp.getAuthUrl(
    Buffer.from(JSON.stringify({ clientId: 'agency', nonce })).toString('base64'),
    [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ]
  );
  res.redirect(authUrl);
});

// GET /api/auth/google/:clientId — initiate Google OAuth
// No JWT required: this is a browser redirect (no header support)
router.get('/google/:clientId', (req, res) => {
  const { clientId } = req.params;
  const client = ds.getClient(clientId);
  if (!client) return res.status(404).send('Client not found');

  const nonce = crypto.randomBytes(16).toString('hex');
  pendingOAuth.set(nonce, clientId);
  // Auto-expire nonce after 10 minutes
  setTimeout(() => pendingOAuth.delete(nonce), 10 * 60 * 1000);

  const authUrl = gbp.getAuthUrl(Buffer.from(JSON.stringify({ clientId, nonce })).toString('base64'));
  res.redirect(authUrl);
});

// GET /api/auth/callback — Google OAuth callback
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (error) {
    console.error('[auth/callback] OAuth error:', error);
    return res.redirect(`${frontendBase}/?oauth_error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return res.redirect(`${frontendBase}/?oauth_error=missing_params`);
  }

  let clientId;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
    clientId = decoded.clientId;
    const nonce = decoded.nonce;

    if (!pendingOAuth.has(nonce)) {
      return res.redirect(`${frontendBase}/?oauth_error=invalid_state`);
    }
    pendingOAuth.delete(nonce);
  } catch {
    return res.redirect(`${frontendBase}/?oauth_error=bad_state`);
  }

  // ── Agency connection ──────────────────────────────────────────────────────
  if (clientId === 'agency') {
    try {
      const tokens  = await gbp.getTokenFromCode(code);
      let profile   = {};
      try { profile = await gbp.getGoogleUserInfo(tokens); } catch {}
      ds.saveAgencyData({ tokens, profile });
      console.log(`[auth] Agency Google connected: ${profile.email || 'unknown'}`);
      return res.redirect(`${frontendBase}/?google_connected=1`);
    } catch (err) {
      console.error('[auth/callback] agency token error:', err.message);
      return res.redirect(`${frontendBase}/?oauth_error=${encodeURIComponent(err.message)}`);
    }
  }

  // ── Client connection ──────────────────────────────────────────────────────
  const client = ds.getClient(clientId);
  if (!client) return res.redirect(`${frontendBase}/?oauth_error=client_not_found`);

  try {
    const tokens = await gbp.getTokenFromCode(code);

    // Persist tokens on the client
    ds.saveClient({
      ...client,
      gbpTokens:      tokens,
      googleConnected: true,
      updatedAt:       new Date().toISOString()
    });

    // Also write a dedicated tokens.json for easy inspection / re-use
    ds.saveClientTokens(clientId, tokens);

    console.log(`[auth] Google connected for client ${client.businessName || client.name}`);
    res.redirect(`${frontendBase}/clients/${clientId}?connected=1`);
  } catch (err) {
    console.error('[auth/callback] token exchange error:', err.message);
    res.redirect(`${frontendBase}/clients/${clientId}?oauth_error=${encodeURIComponent(err.message)}`);
  }
});

module.exports = router;
