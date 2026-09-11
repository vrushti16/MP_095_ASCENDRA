/**
 * ASCENDRA Admin Console — Runtime Environment Configuration
 *
 * NOTE: This file is loaded directly by the browser. All values in this file
 * are PUBLIC and exposed to client inspection. NEVER place server secrets,
 * database credentials, Redis URLs, or private keys in this file.
 */

(function () {
  'use strict';

  // Read optional runtime override injected by reverse proxy or deployment environment
  const runtimeOverrides = window.__ASCENDRA_ADMIN_CONFIG__ || window.__ASCENDRA_CONFIG__ || {};

  const config = {
    // API Gateway Base URL (Defaults to same-origin relative path for Express static hosting)
    API_BASE_URL: runtimeOverrides.API_BASE_URL || '/api/v1',

    // Application runtime environment ('development' | 'production' | 'staging')
    APP_ENV: runtimeOverrides.APP_ENV || 'development'
  };

  // Expose as frozen configuration objects on the global window namespace
  window.ASCENDRA_ADMIN_CONFIG = Object.freeze(config);
  window.ASCENDRA_CONFIG = window.ASCENDRA_ADMIN_CONFIG;
})();
