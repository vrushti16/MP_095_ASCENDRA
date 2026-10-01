const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const path = require('path');
const apiV1Router = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

// Security HTTP headers (COOP disabled to allow seamless popup postMessage communication)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: false,
  contentSecurityPolicy: false
}));

// CORS configuration supporting Unity WebGL and Frontend clients
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.UNITY_WEBGL_URL,
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://127.0.0.1:8080'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman, or Unity standalone)
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // Allow during dev, can be tightened in production
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Request Body Parsers
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// HTTP Request Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

const playerStaticDir = path.join(__dirname, '..', '..', 'frontend', 'player');

// Mount Versioned API Routes (Top Priority)
app.use('/api/v1', apiV1Router);

// Serve Static Admin Dashboard (Phase 16 - Isolated)
app.use('/admin', express.static(path.join(__dirname, '..', '..', 'frontend', 'admin')));

// Serve Static Player Web Client Assets (Both at /play and at root)
app.use('/play', express.static(playerStaticDir));
app.use(express.static(playerStaticDir));

// Serve Unity WebGL Build with proper Gzip header decompression support
app.use('/webgl', express.static(path.join(__dirname, '..', '..', 'Builds', 'WebGL'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.gz')) {
      res.setHeader('Content-Encoding', 'gzip');
      if (filePath.endsWith('.framework.js.gz') || filePath.endsWith('.js.gz')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (filePath.endsWith('.wasm.gz')) {
        res.setHeader('Content-Type', 'application/wasm');
      } else if (filePath.endsWith('.data.gz')) {
        res.setHeader('Content-Type', 'application/octet-stream');
      }
    }
  }
}));

// Explicit SPA Routes for Player Client
const spaPlayerRoutes = ['/', '/login', '/register', '/forgot-password', '/play', '/play/'];
spaPlayerRoutes.forEach(route => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(playerStaticDir, 'index.html'));
  });
});

// 404 Catch-All Middleware
app.use(notFoundHandler);

// Centralized Global Error Handler
app.use(errorHandler);

module.exports = app;

