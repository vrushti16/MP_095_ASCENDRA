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

// Mount Versioned API Routes (Top Priority)
app.use('/api/v1', apiV1Router);

// Serve Static Admin Dashboard (Phase 16 - Isolated)
app.use('/admin', express.static(path.join(__dirname, '..', '..', 'frontend', 'admin')));

// Serve Static Player Web Client (Phase 17 - Isolated)
app.use('/play', express.static(path.join(__dirname, '..', '..', 'frontend', 'player')));

// Root Redirect to Player Gaming Client
app.get('/', (req, res) => res.redirect('/play/'));

// 404 Catch-All Middleware
app.use(notFoundHandler);

// Centralized Global Error Handler
app.use(errorHandler);

module.exports = app;

