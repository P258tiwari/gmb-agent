require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const authRoutes    = require('./routes/auth');
const clientRoutes  = require('./routes/clients');
const contentRoutes = require('./routes/content');
const reviewRoutes  = require('./routes/reviews');
const reportRoutes  = require('./routes/reports');
const citationRoutes = require('./routes/citations');
const keywordRoutes = require('./routes/keywords');
const gbpRoutes     = require('./routes/gbp');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure data directories exist
const dataDir = path.join(__dirname, 'data', 'clients');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// API Routes
// GBP router is mounted at /api to handle both /api/gbp/* and /api/clients/:id/gbp/*
app.use('/api', gbpRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/citations', citationRoutes);
app.use('/api/keywords', keywordRoutes);

// Health check
app.get('/api/health', (req, res) => {
  const ds = require('./services/dataStore');
  res.json({
    status:      'ok',
    uptime:      Math.floor(process.uptime()),
    clientCount: ds.getAllClients().length,
    timestamp:   new Date().toISOString(),
    env:         process.env.NODE_ENV || 'development'
  });
});

// Public health (no auth — for uptime monitors)
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Serve React frontend in production
if (process.env.NODE_ENV === 'production') {
  const frontendBuild = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(frontendBuild));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuild, 'index.html'));
  });
}

// Start cron jobs
require('./jobs/post-scheduler');
require('./jobs/review-monitor');
require('./jobs/monthly-content');
require('./jobs/report-sender');

app.listen(PORT, () => {
  console.log(`GMB Agent running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});
