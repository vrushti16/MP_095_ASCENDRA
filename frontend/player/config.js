/**
 * ASCENDRA Player Web Client — Runtime Environment Configuration
 *
 * NOTE: This file is loaded directly by the browser. All values in this file
 * are PUBLIC and exposed to client inspection. NEVER place server secrets,
 * database credentials, Redis URLs, or private keys in this file.
 */

(function () {
  'use strict';

  // Read optional runtime override injected by reverse proxy or deployment environment
  const runtimeOverrides = window.__ASCENDRA_PLAYER_CONFIG__ || window.__ASCENDRA_CONFIG__ || {};

  const config = {
    // API Gateway Base URL (Defaults to same-origin relative path for Express static hosting)
    API_BASE_URL: runtimeOverrides.API_BASE_URL || '/api/v1',

    // Application runtime environment ('development' | 'production' | 'staging')
    APP_ENV: runtimeOverrides.APP_ENV || 'development',

    // Google OAuth 2.0 Public Client ID
    GOOGLE_CLIENT_ID: runtimeOverrides.GOOGLE_CLIENT_ID || '957763188151-3a5dlqjcofh1v4vhjccndrqr8kqh8j7e.apps.googleusercontent.com',

    // Firebase Web Client Configuration (Project mp095-49fcb)
    FIREBASE_CONFIG: runtimeOverrides.FIREBASE_CONFIG || {
      apiKey: "AIzaSyA0BB2GLbXcLz1tbzj6DO75WjjDhSnxBZQ",
      authDomain: "mp095-49fcb.firebaseapp.com",
      projectId: "mp095-49fcb",
      storageBucket: "mp095-49fcb.firebasestorage.app",
      messagingSenderId: "957763188151",
      appId: "1:957763188151:web:7b869e08ae33d45ed42432"
    }
  };

  // Expose as frozen configuration objects on the global window namespace
  window.ASCENDRA_PLAYER_CONFIG = Object.freeze(config);
  window.ASCENDRA_CONFIG = window.ASCENDRA_PLAYER_CONFIG;
})();
