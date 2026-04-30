const axios = require('axios');
const ds    = require('./dataStore');

const BASE = 'https://serpapi.com/search';

async function findDataId(client) {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) throw new Error('SERP_API_KEY not set');

  const name    = client.businessName || client.name || '';
  const city    = client.city || '';
  const address = client.address || '';

  // Try progressively specific queries — `location` is not a valid param for google_maps engine
  const queries = [
    `${name} ${city}`,
    `${name} ${address}`,
    name,
  ].map(q => q.trim()).filter(Boolean);

  for (const q of queries) {
    console.log('[serpReviews] searching Google Maps:', q);
    const { data } = await axios.get(BASE, {
      params: { engine: 'google_maps', q, type: 'search', api_key: apiKey }
    });
    const results = data.local_results || [];
    if (!results.length) { console.log('[serpReviews] no results for:', q); continue; }

    const dataId = results[0].data_id;
    if (!dataId) { console.log('[serpReviews] data_id missing in result'); continue; }

    ds.saveClient({ ...client, serpDataId: dataId });
    console.log('[serpReviews] found data_id:', dataId, 'via query:', q);
    return dataId;
  }

  throw new Error(`Could not find Google Maps listing for: ${name} ${city}`);
}

function parseReview(r) {
  // Derive a stable ID from the review link or fall back to reviewer+date
  const idMatch = (r.link || '').match(/review\/([^&?]+)/);
  const id = idMatch ? idMatch[1] : `${r.user?.name || 'anon'}_${r.iso_date || r.date}`;
  return {
    id,
    gbpReviewId:   id,
    reviewerName:  r.user?.name        || 'Anonymous',
    reviewerPhoto: r.user?.thumbnail   || '',
    rating:        typeof r.rating === 'number' ? r.rating : parseInt(r.rating) || 0,
    text:          r.snippet           || '',
    date:          r.iso_date          || r.date || new Date().toISOString(),
    updatedAt:     r.iso_date          || r.date || null,
    reply:         r.response?.snippet || null,
    repliedAt:     r.response?.iso_date || r.response?.date || null,
    source:        'serp'
  };
}

async function fetchReviews(client) {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) throw new Error('SERP_API_KEY not set');

  let dataId = client.serpDataId;
  if (!dataId) dataId = await findDataId(client);

  const all = [];
  let nextPageToken;

  do {
    const params = {
      engine:   'google_maps_reviews',
      data_id:  dataId,
      sort_by:  'newestFirst',
      hl:       'en',
      api_key:  apiKey,
      ...(nextPageToken ? { next_page_token: nextPageToken } : {})
    };

    const { data } = await axios.get(BASE, { params });
    const page = data.reviews || [];
    page.forEach(r => all.push(parseReview(r)));

    nextPageToken = data.serpapi_pagination?.next_page_token || null;
  } while (nextPageToken && all.length < 200);

  console.log('[serpReviews] fetched', all.length, 'reviews for', client.businessName);
  return all;
}

module.exports = { fetchReviews };
