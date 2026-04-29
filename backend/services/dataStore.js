const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data', 'clients');

function clientDir(clientId) {
  return path.join(DATA_DIR, clientId);
}

function contentDir(clientId) {
  return path.join(clientDir(clientId), 'content');
}

function ensureClientDir(clientId) {
  const dir = clientDir(clientId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function ensureContentDir(clientId) {
  const dir = contentDir(clientId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function readJSON(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return null; }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// ─── Clients index ────────────────────────────────────────────────────────────

function getAllClients() {
  return readJSON(path.join(__dirname, '..', 'data', 'clients.json')) || [];
}

function saveAllClients(clients) {
  writeJSON(path.join(__dirname, '..', 'data', 'clients.json'), clients);
}

function getClient(clientId) {
  return getAllClients().find(c => c.id === clientId) || null;
}

function saveClient(clientData) {
  const clients = getAllClients();
  const idx = clients.findIndex(c => c.id === clientData.id);
  if (idx >= 0) clients[idx] = { ...clients[idx], ...clientData };
  else clients.push(clientData);
  saveAllClients(clients);
  return clientData;
}

function deleteClient(clientId) {
  saveAllClients(getAllClients().filter(c => c.id !== clientId));
  const dir = clientDir(clientId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ─── Extended client info — data/clients/{id}/info.json ──────────────────────

function getClientInfo(clientId) {
  return readJSON(path.join(clientDir(clientId), 'info.json'));
}

function saveClientInfo(clientId, info) {
  ensureClientDir(clientId);
  writeJSON(path.join(clientDir(clientId), 'info.json'), {
    ...info,
    updatedAt: new Date().toISOString()
  });
}

// ─── Client OAuth tokens — data/clients/{id}/tokens.json ─────────────────────

function saveClientTokens(clientId, tokens) {
  ensureClientDir(clientId);
  writeJSON(path.join(clientDir(clientId), 'tokens.json'), tokens);
}

function getClientTokens(clientId) {
  return readJSON(path.join(clientDir(clientId), 'tokens.json'));
}

// ─── Month-based content storage: data/clients/{id}/content/YYYY-MM.json ─────

function currentMonthYear() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthContent(clientId, monthYear) {
  const file = path.join(contentDir(clientId), `${monthYear}.json`);
  return readJSON(file) || [];
}

function saveMonthContent(clientId, monthYear, posts) {
  ensureContentDir(clientId);
  writeJSON(path.join(contentDir(clientId), `${monthYear}.json`), posts);
}

function getMonthPost(clientId, monthYear, postId) {
  return getMonthContent(clientId, monthYear).find(p => p.id === postId) || null;
}

function saveMonthPost(clientId, monthYear, postData) {
  const posts = getMonthContent(clientId, monthYear);
  const idx   = posts.findIndex(p => p.id === postData.id);
  if (idx >= 0) posts[idx] = { ...posts[idx], ...postData };
  else posts.push(postData);
  saveMonthContent(clientId, monthYear, posts);
  return postData;
}

// List all available months for a client
function listContentMonths(clientId) {
  const dir = contentDir(clientId);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => /^\d{4}-\d{2}\.json$/.test(f))
    .map(f => f.replace('.json', ''))
    .sort();
}

// ─── Legacy flat posts.json (seed data + backward compat) ─────────────────────

function getPosts(clientId) {
  const legacy = readJSON(path.join(clientDir(clientId), 'posts.json')) || [];
  // Also collect all month-based posts
  const months = listContentMonths(clientId);
  const monthly = months.flatMap(m => getMonthContent(clientId, m));
  // Deduplicate by id (month-based takes precedence)
  const allById = new Map();
  for (const p of legacy)  allById.set(p.id, p);
  for (const p of monthly) allById.set(p.id, p);
  return [...allById.values()];
}

function savePosts(clientId, posts) {
  // Legacy flat file write — keep for backward compat
  const legacyPath = path.join(clientDir(clientId), 'posts.json');
  if (fs.existsSync(legacyPath)) {
    writeJSON(legacyPath, posts);
  }
}

function getPost(clientId, postId) {
  // Search month files first, then legacy
  const months = listContentMonths(clientId);
  for (const m of months) {
    const p = getMonthPost(clientId, m, postId);
    if (p) return p;
  }
  const legacy = readJSON(path.join(clientDir(clientId), 'posts.json')) || [];
  return legacy.find(p => p.id === postId) || null;
}

function savePost(clientId, postData) {
  // Determine correct month file
  const scheduled = postData.scheduledAt || postData.createdAt || new Date().toISOString();
  const d = new Date(scheduled);
  const monthYear = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  // Check if post exists in a month file
  const months = listContentMonths(clientId);
  for (const m of months) {
    const existing = getMonthPost(clientId, m, postData.id);
    if (existing) {
      return saveMonthPost(clientId, m, postData);
    }
  }

  // Check legacy posts.json
  const legacyPath = path.join(clientDir(clientId), 'posts.json');
  const legacy = readJSON(legacyPath) || [];
  const legacyIdx = legacy.findIndex(p => p.id === postData.id);
  if (legacyIdx >= 0) {
    legacy[legacyIdx] = { ...legacy[legacyIdx], ...postData };
    writeJSON(legacyPath, legacy);
    return postData;
  }

  // New post → save to month file
  return saveMonthPost(clientId, monthYear, postData);
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

function getReviews(clientId) {
  return readJSON(path.join(clientDir(clientId), 'reviews.json')) || [];
}

function saveReviews(clientId, reviews) {
  ensureClientDir(clientId);
  writeJSON(path.join(clientDir(clientId), 'reviews.json'), reviews);
}

function saveReview(clientId, reviewData) {
  const reviews = getReviews(clientId);
  const idx = reviews.findIndex(r => r.id === reviewData.id);
  if (idx >= 0) reviews[idx] = { ...reviews[idx], ...reviewData };
  else reviews.push(reviewData);
  saveReviews(clientId, reviews);
  return reviewData;
}

// ─── Citations ────────────────────────────────────────────────────────────────

function getCitations(clientId) {
  return readJSON(path.join(clientDir(clientId), 'citations.json')) || [];
}

function saveCitations(clientId, citations) {
  ensureClientDir(clientId);
  writeJSON(path.join(clientDir(clientId), 'citations.json'), citations);
}

function saveCitation(clientId, citationData) {
  const citations = getCitations(clientId);
  const idx = citations.findIndex(c => c.id === citationData.id);
  if (idx >= 0) citations[idx] = { ...citations[idx], ...citationData };
  else citations.push(citationData);
  saveCitations(clientId, citations);
  return citationData;
}

// ─── Keywords ─────────────────────────────────────────────────────────────────

function getKeywords(clientId) {
  return readJSON(path.join(clientDir(clientId), 'keywords.json'))
    || { transactional: [], nearMe: [], informational: [], hindi: [] };
}

function saveKeywords(clientId, keywords) {
  ensureClientDir(clientId);
  writeJSON(path.join(clientDir(clientId), 'keywords.json'), keywords);
}

// ─── Reports ──────────────────────────────────────────────────────────────────

function reportsDir(clientId) {
  return path.join(clientDir(clientId), 'reports');
}

function ensureReportsDir(clientId) {
  const dir = reportsDir(clientId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getReports(clientId) {
  return readJSON(path.join(clientDir(clientId), 'reports.json')) || [];
}

function saveReports(clientId, reports) {
  ensureClientDir(clientId);
  writeJSON(path.join(clientDir(clientId), 'reports.json'), reports);
}

function saveReportHtml(clientId, monthYear, html) {
  ensureReportsDir(clientId);
  fs.writeFileSync(path.join(reportsDir(clientId), `${monthYear}.html`), html, 'utf8');
}

function getReportHtml(clientId, monthYear) {
  const file = path.join(reportsDir(clientId), `${monthYear}.html`);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

function saveReport(clientId, reportData) {
  const reports = getReports(clientId);
  const idx     = reports.findIndex(r => r.monthYear === reportData.monthYear || r.id === reportData.id);
  if (idx >= 0) reports[idx] = { ...reports[idx], ...reportData };
  else          reports.unshift(reportData);
  saveReports(clientId, reports);
  return reportData;
}

// ─── Agency Google account — data/agency-tokens.json ─────────────────────────

const AGENCY_DATA_FILE = path.join(__dirname, '..', 'data', 'agency-tokens.json');

function getAgencyData() {
  return readJSON(AGENCY_DATA_FILE);
}

function saveAgencyData(data) {
  writeJSON(AGENCY_DATA_FILE, { ...data, updatedAt: new Date().toISOString() });
}

module.exports = {
  getAllClients, saveAllClients, getClient, saveClient, deleteClient,
  getClientInfo, saveClientInfo,
  // Month-based content (primary)
  getMonthContent, saveMonthContent, getMonthPost, saveMonthPost,
  listContentMonths, currentMonthYear,
  // Legacy flat (backward compat)
  getPosts, savePosts, getPost, savePost,
  getReviews, saveReviews, saveReview,
  getCitations, saveCitations, saveCitation,
  getKeywords, saveKeywords,
  getReports, saveReports, saveReport, saveReportHtml, getReportHtml,
  ensureClientDir,
  saveClientTokens, getClientTokens,
  getAgencyData, saveAgencyData
};
