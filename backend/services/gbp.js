const { google } = require('googleapis');

const GBP      = 'https://mybusiness.googleapis.com/v4';
const ACCT_API = 'https://mybusinessaccountmanagement.googleapis.com/v1';
const BIZ_API  = 'https://mybusinessbusinessinformation.googleapis.com/v1';

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function authClient(tokens) {
  const c = getOAuthClient();
  c.setCredentials(tokens);
  return c;
}

function getAuthUrl(state, extraScopes = []) {
  const oauth2Client = getOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt:      'consent',
    scope: [
      'https://www.googleapis.com/auth/business.manage',
      'https://www.googleapis.com/auth/plus.business.manage',
      ...extraScopes
    ],
    ...(state ? { state } : {})
  });
}

async function getGoogleUserInfo(tokens) {
  const c = authClient(tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: c });
  const { data } = await oauth2.userinfo.get();
  return {
    name:    data.name    || '',
    email:   data.email   || '',
    picture: data.picture || ''
  };
}

async function getTokenFromCode(code) {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

// ─── Direct HTTP helpers ──────────────────────────────────────────────────────

async function gbpGet(tokens, path) {
  const c = authClient(tokens);
  const { data } = await c.request({ url: `${GBP}/${path}` });
  return data;
}

async function gbpPost(tokens, path, body) {
  const c = authClient(tokens);
  const { data } = await c.request({ url: `${GBP}/${path}`, method: 'POST', data: body });
  return data;
}

async function gbpPatch(tokens, path, body, updateMask) {
  const c = authClient(tokens);
  const url = updateMask ? `${GBP}/${path}?updateMask=${updateMask}` : `${GBP}/${path}`;
  const { data } = await c.request({ url, method: 'PATCH', data: body });
  return data;
}

async function gbpPut(tokens, path, body) {
  const c = authClient(tokens);
  const { data } = await c.request({ url: `${GBP}/${path}`, method: 'PUT', data: body });
  return data;
}

// ─── Posts ────────────────────────────────────────────────────────────────────

async function createPost(tokens, accountId, client_data, post) {
  const acctId = accountId || client_data.gbpAccountId || client_data.accountId;
  const locId  = client_data.gbpLocationId || client_data.locationId;

  if (!tokens || !acctId) {
    console.log(`[gbp] createPost skipped — no tokens/accountId for ${client_data.businessName || client_data.name}`);
    return { status: 'skipped' };
  }

  const locationName = `accounts/${acctId}/locations/${locId}`;
  const postBody = {
    summary: `${post.title}\n\n${post.body}`,
    callToAction: {
      actionType: 'CALL',
      url: client_data.website || process.env.APP_URL
    }
  };

  if (post.imageUrl && (post.imageUrl.startsWith('/uploads/') || post.imageUrl.startsWith('http'))) {
    const imageSource = post.imageUrl.startsWith('http')
      ? post.imageUrl
      : `${process.env.APP_URL}${post.imageUrl}`;
    postBody.media = [{ mediaFormat: 'PHOTO', sourceUrl: imageSource }];
  }

  return gbpPost(tokens, `${locationName}/localPosts`, postBody);
}

async function publishPost(client_data, post, tokens) {
  return createPost(tokens, client_data.accountId, client_data, post);
}

// ─── Insights ─────────────────────────────────────────────────────────────────

const EMPTY_INSIGHTS = {
  profileViews: 0, searchImpressions: 0,
  phoneCalls: 0, directionClicks: 0, websiteClicks: 0
};

async function getInsights(tokens, accountId, locationId, startDate, endDate) {
  if (!tokens || !accountId || !locationId) return EMPTY_INSIGHTS;

  try {
    const start = startDate ? new Date(startDate) : (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; })();
    const end   = endDate   ? new Date(endDate)   : new Date();

    const data = await gbpPost(tokens, `accounts/${accountId}/locations:reportInsights`, {
      locationNames: [`accounts/${accountId}/locations/${locationId}`],
      basicRequest: {
        metricRequests: [
          { metric: 'QUERIES_DIRECT'            },
          { metric: 'QUERIES_INDIRECT'           },
          { metric: 'ACTIONS_PHONE'              },
          { metric: 'ACTIONS_DRIVING_DIRECTIONS' },
          { metric: 'ACTIONS_WEBSITE'            }
        ],
        timeRange: { startTime: start.toISOString(), endTime: end.toISOString() }
      }
    });

    return parseInsights(data);
  } catch (err) {
    console.error('[gbp] getInsights error:', err.message);
    return EMPTY_INSIGHTS;
  }
}

function parseInsights(data) {
  const metrics = {};
  const locationMetrics = (data.locationMetrics || [])[0];
  if (!locationMetrics) return EMPTY_INSIGHTS;

  for (const mv of locationMetrics.metricValues || []) {
    const val = parseInt(mv.totalValue?.value || mv.value || '0', 10) || 0;
    switch (mv.metric) {
      case 'QUERIES_DIRECT':             metrics.directSearches    = val; break;
      case 'QUERIES_INDIRECT':           metrics.discoverySearches = val; break;
      case 'ACTIONS_PHONE':              metrics.phoneCalls        = val; break;
      case 'ACTIONS_DRIVING_DIRECTIONS': metrics.directionClicks   = val; break;
      case 'ACTIONS_WEBSITE':            metrics.websiteClicks     = val; break;
    }
  }

  metrics.profileViews      = (metrics.directSearches || 0) + (metrics.discoverySearches || 0);
  metrics.searchImpressions = metrics.directSearches || 0;
  return metrics;
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

function starRatingToNumber(starRating) {
  return { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }[starRating] || 0;
}

async function getReviews(tokens, accountId, locationId) {
  if (!tokens || !accountId || !locationId) return [];

  const locationName = `accounts/${accountId}/locations/${locationId}`;
  try {
    const all = [];
    let pageToken;

    do {
      const url = pageToken
        ? `${locationName}/reviews?pageSize=50&pageToken=${pageToken}`
        : `${locationName}/reviews?pageSize=50`;
      const res = await gbpGet(tokens, url);
      const page = res.reviews || [];
      page.forEach(r => all.push({
        id:            r.reviewId,
        gbpReviewId:   r.reviewId,
        gbpName:       r.name,
        reviewerName:  r.reviewer?.displayName || 'Anonymous',
        reviewerPhoto: r.reviewer?.profilePhotoUrl || '',
        isAnonymous:   r.reviewer?.isAnonymous || false,
        rating:        starRatingToNumber(r.starRating),
        text:          r.comment || '',
        date:          r.createTime,
        updatedAt:     r.updateTime,
        reply:         r.reviewReply?.comment || null,
        repliedAt:     r.reviewReply?.updateTime || null
      }));
      pageToken = res.nextPageToken;
    } while (pageToken);

    return all;
  } catch (err) {
    console.error('[gbp] getReviews error:', err.message);
    return [];
  }
}

async function replyToReview(tokens, accountId, locationId, reviewId, replyText) {
  if (!tokens || !accountId || !locationId) return { status: 'skipped' };

  try {
    return await gbpPut(
      tokens,
      `accounts/${accountId}/locations/${locationId}/reviews/${reviewId}/reply`,
      { comment: replyText }
    );
  } catch (err) {
    console.error('[gbp] replyToReview error:', err.message);
    throw err;
  }
}

// ─── Profile fetch ────────────────────────────────────────────────────────────

async function fetchCurrentProfile(tokens, accountId, locationId) {
  if (!tokens || !accountId || !locationId) return null;
  const c = authClient(tokens);

  // Try new Business Information API first (v4 profile endpoint is deprecated/404)
  try {
    const { data: loc } = await c.request({
      url:    `${BIZ_API}/locations/${locationId}`,
      params: { readMask: 'name,title,primaryCategory,additionalCategories,profile,serviceList' }
    });
    return {
      name:                loc.title || '',
      primaryCategory:     loc.primaryCategory?.displayName || '',
      secondaryCategories: (loc.additionalCategories || []).map(cat => cat.displayName).filter(Boolean),
      description:         loc.profile?.description || '',
      services:            (loc.serviceList?.services || []).map(s => s.displayName || s.serviceTypeId || '').filter(Boolean),
      rawData:             loc
    };
  } catch (err) {
    console.warn('[gbp] fetchCurrentProfile BIZ_API failed, trying v4:', err.message);
  }

  // Fall back to v4
  const loc = await gbpGet(tokens, `accounts/${accountId}/locations/${locationId}`);
  return {
    name:                loc.locationName || '',
    primaryCategory:     loc.primaryCategory?.displayName || '',
    secondaryCategories: (loc.additionalCategories || []).map(cat => cat.displayName).filter(Boolean),
    description:         loc.profile?.description || '',
    services:            (loc.serviceList?.services || []).map(s => s.displayName || s.serviceTypeId || '').filter(Boolean),
    rawData:             loc
  };
}

// ─── Profile update ───────────────────────────────────────────────────────────

async function applyGbpUpdate(tokens, accountId, locationId, changes) {
  if (!tokens || !accountId || !locationId) {
    throw new Error('Missing GBP credentials — connect Google first');
  }

  const updateMask  = [];
  const requestBody = {};

  if (changes.name) {
    requestBody.locationName = changes.name;
    updateMask.push('locationName');
  }
  if (changes.primaryCategory) {
    requestBody.primaryCategory = { displayName: changes.primaryCategory };
    updateMask.push('primaryCategory');
  }
  if (Array.isArray(changes.secondaryCategories)) {
    requestBody.additionalCategories = changes.secondaryCategories.map(c => ({ displayName: c }));
    updateMask.push('additionalCategories');
  }
  if (changes.description) {
    requestBody.profile = { description: changes.description };
    updateMask.push('profile.description');
  }
  if (Array.isArray(changes.services)) {
    requestBody.serviceList = {
      services: changes.services.map(s => ({ displayName: s, isOffered: true }))
    };
    updateMask.push('serviceList');
  }

  if (updateMask.length === 0) return { status: 'no_changes' };

  return gbpPatch(
    tokens,
    `accounts/${accountId}/locations/${locationId}`,
    requestBody,
    updateMask.join(',')
  );
}

// ─── New-API helpers (with v4 fallback) ──────────────────────────────────────

async function listAccounts(tokens) {
  const c = authClient(tokens);

  // 1. New Account Management API
  try {
    const { data } = await c.request({ url: `${ACCT_API}/accounts` });
    if (data.accounts?.length) return data.accounts;
  } catch (err) {
    console.warn('[gbp] Account Management API failed:', err.message);
  }

  // 2. Old v4 API
  try {
    const { data } = await c.request({ url: `${GBP}/accounts` });
    if (data.accounts?.length) return data.accounts;
  } catch (err) {
    console.warn('[gbp] v4 accounts API failed:', err.message);
  }

  // 3. Last resort: OAuth user ID equals the personal GBP account ID
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: c });
    const { data: ui } = await oauth2.userinfo.get();
    if (ui.id) {
      console.log(`[gbp] Using OAuth user ID ${ui.id} as GBP account ID`);
      return [{ name: `accounts/${ui.id}`, accountName: ui.name || '' }];
    }
  } catch (err) {
    console.warn('[gbp] userinfo fallback failed:', err.message);
  }

  return [];
}

async function listLocations(tokens, accountName) {
  const c = authClient(tokens);
  try {
    const { data } = await c.request({
      url:    `${BIZ_API}/${accountName}/locations`,
      params: { readMask: 'name,title,storefrontAddress,primaryCategory,metadata' }
    });
    return data.locations || [];
  } catch (err) {
    console.warn('[gbp] Business Info API failed, falling back to v4:', err.message);
    // v4 response uses different field names — normalize to v1 shape
    const { data } = await c.request({ url: `${GBP}/${accountName}/locations` });
    return (data.locations || []).map(loc => ({
      name:                loc.name,
      title:               loc.locationName || '',
      storefrontAddress:   { addressLines: [loc.address?.formattedAddress || ''] },
      primaryCategory:     loc.primaryCategory,
      metadata:            loc.metadata
    }));
  }
}

function extractLocationNum(locName) {
  // v1: "locations/{id}" | v4: "accounts/{a}/locations/{id}" — always grab last segment
  return locName.split('/').pop();
}

function formatAddress(storefrontAddress) {
  if (!storefrontAddress) return '';
  const parts = [
    ...(storefrontAddress.addressLines || []),
    storefrontAddress.locality,
    storefrontAddress.administrativeArea
  ].filter(Boolean);
  return parts.join(', ');
}

// ─── Find location by Place ID ────────────────────────────────────────────────

async function findLocationByPlaceId(tokens, placeId) {
  try {
    const accounts = await listAccounts(tokens);

    for (const account of accounts) {
      try {
        const locs = await listLocations(tokens, account.name);
        const match = locs.find(loc => {
          const locPlaceId = loc.metadata?.placeId || '';
          const locNum     = extractLocationNum(loc.name);
          return locPlaceId === placeId || locNum === placeId;
        });
        if (match) {
          return {
            accountId:  account.name.replace('accounts/', ''),
            locationId: extractLocationNum(match.name)
          };
        }
      } catch { /* skip this account */ }
    }
  } catch (err) {
    console.error('[gbp] findLocationByPlaceId error:', err.message);
  }
  return null;
}

// ─── List all GBP locations ───────────────────────────────────────────────────

async function getMyGbpLocations(tokens) {
  if (!tokens) return [];

  const accounts = await listAccounts(tokens);
  console.log(`[gbp] getMyGbpLocations: found ${accounts.length} account(s)`);

  const locations = [];
  for (const account of accounts) {
    try {
      const locs = await listLocations(tokens, account.name);
      console.log(`[gbp] ${account.name}: found ${locs.length} location(s)`);

      const accountNum = account.name.replace('accounts/', '');
      for (const loc of locs) {
        locations.push({
          placeId:      loc.metadata?.placeId || '',
          locationId:   extractLocationNum(loc.name),
          accountId:    accountNum,
          businessName: loc.title || '',
          address:      formatAddress(loc.storefrontAddress),
          category:     loc.primaryCategory?.displayName || ''
        });
      }
    } catch (e) {
      console.error(`[gbp] ${account.name} locations error:`, e.response?.data || e.message);
    }
  }
  return locations;
}

module.exports = {
  getAuthUrl, getTokenFromCode, getGoogleUserInfo,
  createPost, publishPost,
  getInsights,
  getReviews, replyToReview,
  fetchCurrentProfile, applyGbpUpdate,
  findLocationByPlaceId, getMyGbpLocations
};
