const { google } = require('googleapis');

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
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
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
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

// createPost — primary function used by post-scheduler
async function createPost(tokens, accountId, client_data, post) {
  const acctId = accountId || client_data.gbpAccountId || client_data.accountId;
  const locId  = client_data.gbpLocationId || client_data.locationId;

  if (!tokens || !acctId) {
    console.log(`[gbp] createPost skipped — no tokens/accountId for ${client_data.businessName || client_data.name}`);
    return { status: 'skipped' };
  }

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials(tokens);

  const mybusiness   = google.mybusiness({ version: 'v4', auth: oauth2Client });
  const locationName = `accounts/${acctId}/locations/${locId}`;

  const postBody = {
    summary: `${post.title}\n\n${post.body}`,
    callToAction: {
      actionType: 'CALL',
      url: client_data.website || process.env.APP_URL
    }
  };

  // Attach image if hosted locally
  if (post.imageUrl && (post.imageUrl.startsWith('/uploads/') || post.imageUrl.startsWith('http'))) {
    const imageSource = post.imageUrl.startsWith('http')
      ? post.imageUrl
      : `${process.env.APP_URL}${post.imageUrl}`;
    postBody.media = [{ mediaFormat: 'PHOTO', sourceUrl: imageSource }];
  }

  const result = await mybusiness.accounts.locations.localPosts.create({
    parent:      locationName,
    requestBody: postBody
  });
  return result.data;
}

// Legacy alias
async function publishPost(client_data, post, tokens) {
  return createPost(tokens, client_data.accountId, client_data, post);
}

const EMPTY_INSIGHTS = {
  profileViews: 0, searchImpressions: 0,
  phoneCalls: 0, directionClicks: 0, websiteClicks: 0
};

// getInsights — returns real GBP metrics; returns zeros when not connected
async function getInsights(tokens, accountId, locationId, startDate, endDate) {
  if (!tokens || !accountId || !locationId) return EMPTY_INSIGHTS;

  try {
    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials(tokens);
    const mybusiness   = google.mybusiness({ version: 'v4', auth: oauth2Client });

    const start = startDate ? new Date(startDate) : (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; })();
    const end   = endDate   ? new Date(endDate)   : new Date();

    const res = await mybusiness.accounts.locations.reportInsights({
      name: `accounts/${accountId}`,
      requestBody: {
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
      }
    });

    return parseInsights(res.data);
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

// ─── Reviews ─────────────────────────────────────────────────────────────────

function starRatingToNumber(starRating) {
  return { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }[starRating] || 0;
}

async function getReviews(tokens, accountId, locationId) {
  if (!tokens || !accountId || !locationId) return [];

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials(tokens);
  const mybusiness   = google.mybusiness({ version: 'v4', auth: oauth2Client });
  const locationName = `accounts/${accountId}/locations/${locationId}`;

  try {
    const all = [];
    let pageToken;

    do {
      const res = await mybusiness.accounts.locations.reviews.list({
        parent: locationName,
        pageSize: 50,
        ...(pageToken ? { pageToken } : {})
      });
      const page = res.data.reviews || [];
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
      pageToken = res.data.nextPageToken;
    } while (pageToken);

    return all;
  } catch (err) {
    console.error('[gbp] getReviews error:', err.message);
    return [];
  }
}

async function replyToReview(tokens, accountId, locationId, reviewId, replyText) {
  if (!tokens || !accountId || !locationId) return { status: 'skipped' };

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials(tokens);
  const mybusiness   = google.mybusiness({ version: 'v4', auth: oauth2Client });
  const reviewName   = `accounts/${accountId}/locations/${locationId}/reviews/${reviewId}`;

  try {
    const result = await mybusiness.accounts.locations.reviews.updateReply({
      name:        reviewName,
      requestBody: { comment: replyText }
    });
    return result.data;
  } catch (err) {
    console.error('[gbp] replyToReview error:', err.message);
    throw err;
  }
}

// ─── Profile fetch ────────────────────────────────────────────────────────────

async function fetchCurrentProfile(tokens, accountId, locationId) {
  if (!tokens || !accountId || !locationId) return null;

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials(tokens);
  const mybusiness   = google.mybusiness({ version: 'v4', auth: oauth2Client });
  const locationName = `accounts/${accountId}/locations/${locationId}`;

  const res = await mybusiness.accounts.locations.get({ name: locationName });
  const loc = res.data;

  return {
    name:                 loc.locationName || '',
    primaryCategory:      loc.primaryCategory?.displayName || '',
    secondaryCategories:  (loc.additionalCategories || []).map(c => c.displayName).filter(Boolean),
    description:          loc.profile?.description || '',
    services:             (loc.serviceList?.services || []).map(s => s.displayName || s.serviceTypeId || '').filter(Boolean),
    rawData:              loc
  };
}

// ─── Profile update ───────────────────────────────────────────────────────────

async function applyGbpUpdate(tokens, accountId, locationId, changes) {
  if (!tokens || !accountId || !locationId) {
    throw new Error('Missing GBP credentials — connect Google first');
  }

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials(tokens);
  const mybusiness   = google.mybusiness({ version: 'v4', auth: oauth2Client });
  const locationName = `accounts/${accountId}/locations/${locationId}`;

  const updateMask = [];
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

  const result = await mybusiness.accounts.locations.patch({
    name:        locationName,
    updateMask:  updateMask.join(','),
    requestBody
  });
  return result.data;
}

// ─── List all connected GBP locations ─────────────────────────────────────────

async function getMyGbpLocations(tokens) {
  if (!tokens) return [];

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials(tokens);
  const mybusiness = google.mybusiness({ version: 'v4', auth: oauth2Client });

  try {
    const accountsRes = await mybusiness.accounts.list();
    const accounts    = accountsRes.data.accounts || [];
    const locations   = [];

    for (const account of accounts) {
      try {
        const locRes = await mybusiness.accounts.locations.list({ parent: account.name });
        for (const loc of locRes.data.locations || []) {
          // Extract numeric IDs only (e.g. "accounts/123/locations/456" → "456")
          const accountNum  = account.name.replace('accounts/', '');
          const locationNum = loc.name.replace(`${account.name}/locations/`, '');
          locations.push({
            placeId:      loc.metadata?.placeId || '',
            locationId:   locationNum,
            accountId:    accountNum,
            businessName: loc.locationName || '',
            address:      loc.address?.formattedAddress || '',
            category:     loc.primaryCategory?.displayName || ''
          });
        }
      } catch (e) {
        console.error('[gbp] getMyGbpLocations account error:', e.message);
      }
    }
    return locations;
  } catch (err) {
    console.error('[gbp] getMyGbpLocations error:', err.message);
    return [];
  }
}

module.exports = {
  getAuthUrl, getTokenFromCode, getGoogleUserInfo,
  createPost, publishPost,
  getInsights,
  getReviews, replyToReview,
  fetchCurrentProfile, applyGbpUpdate, getMyGbpLocations
};
