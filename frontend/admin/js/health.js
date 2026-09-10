/**
 * ASCENDRA Admin System Health & AI Telemetry Module
 * Visualizes multi-service dependencies, latencies, memory footprint, and AI generation quality.
 */

const health = {
  async render() {
    const container = document.getElementById('healthContent');
    if (!container) return;

    this.showLoading(container);

    try {
      // Concurrently fetch system health probe and AI telemetry
      const [systemHealthData, aiTelemetryData] = await Promise.all([
        window.api.getSystemHealth(),
        window.api.getAiTelemetry()
      ]);

      this.renderHealthAndTelemetry(container, systemHealthData, aiTelemetryData);
    } catch (err) {
      this.showError(container, err.message);
    }
  },

  showLoading(container) {
    container.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Probing multi-service infrastructure and AI telemetry...</p>
      </div>
    `;
  },

  showError(container, message) {
    container.innerHTML = `
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <h3>Failed to probe system health</h3>
        <p>${this.escapeHtml(message)}</p>
        <button class="btn btn-primary" onclick="health.render()">Retry Diagnostics</button>
      </div>
    `;
  },

  renderHealthAndTelemetry(container, healthPayload, telemetryPayload) {
    const sys = healthPayload || {};
    const deps = sys.dependencies || {};
    const runtime = sys.runtime || {};
    const mem = runtime.memory || {};

    const pg = deps.postgresql || {};
    const redis = deps.redis || {};
    const fastapi = deps.fastapi || {};

    const telemetry = telemetryPayload || {};
    const summary = telemetry.summary || {};
    const recentLogs = telemetry.recentRequests || [];

    container.innerHTML = `
      <!-- Overall System Health Status Banner -->
      <div class="health-banner banner-${sys.status || 'unknown'}">
        <div class="banner-status-icon">
          ${sys.status === 'healthy' ? '✅' : sys.status === 'degraded' ? '⚠️' : '❌'}
        </div>
        <div class="banner-info">
          <h3>System Status: <span class="capitalize">${this.escapeHtml(sys.status || 'Unknown')}</span></h3>
          <p class="banner-subtext">
            ${sys.status === 'healthy'
              ? 'All core platform services, database clusters, and AI pipelines are operating nominally.'
              : sys.status === 'degraded'
                ? 'Core database and player APIs are operational; Redis cache or AI microservice is in fallback mode.'
                : 'Primary PostgreSQL storage is unreachable. Immediate administrative intervention required.'}
          </p>
        </div>
        <div class="banner-time text-muted small">
          Last Probe: ${new Date().toLocaleTimeString()}
        </div>
      </div>

      <!-- Infrastructure Dependency Cards Grid -->
      <h3 class="section-subheading">Core Microservice Dependencies</h3>
      <div class="health-grid">
        <!-- 1. Node.js API Gateway -->
        <div class="service-health-card">
          <div class="service-card-header">
            <span class="service-name">Node.js Express API</span>
            <span class="status-pill status-${sys.status || 'healthy'}">● ${sys.status || 'healthy'}</span>
          </div>
          <div class="service-metric-list">
            <div class="service-metric-row">
              <span class="metric-lbl">Runtime Version:</span>
              <span class="metric-val">${this.escapeHtml(runtime.nodeVersion || 'v20.x')}</span>
            </div>
            <div class="service-metric-row">
              <span class="metric-lbl">Uptime:</span>
              <span class="metric-val">${this.formatUptime(runtime.uptimeSeconds)}</span>
            </div>
            <div class="service-metric-row">
              <span class="metric-lbl">Heap Memory:</span>
              <span class="metric-val">${mem.heapUsedMb || 0} MB / ${mem.heapTotalMb || 0} MB</span>
            </div>
            <div class="service-metric-row">
              <span class="metric-lbl">RSS Footprint:</span>
              <span class="metric-val">${mem.rssMb || 0} MB</span>
            </div>
          </div>
        </div>

        <!-- 2. PostgreSQL / Neon Database -->
        <div class="service-health-card">
          <div class="service-card-header">
            <span class="service-name">PostgreSQL (Neon)</span>
            <span class="status-pill status-${pg.status || 'unknown'}">● ${pg.status || 'unknown'}</span>
          </div>
          <div class="service-metric-list">
            <div class="service-metric-row">
              <span class="metric-lbl">Connection Role:</span>
              <span class="metric-val">Authoritative Primary</span>
            </div>
            <div class="service-metric-row">
              <span class="metric-lbl">Ping Latency:</span>
              <span class="metric-val text-primary"><strong>${pg.latencyMs !== null ? `${pg.latencyMs} ms` : 'N/A'}</strong></span>
            </div>
            <div class="service-metric-row">
              <span class="metric-lbl">SSL Mode:</span>
              <span class="metric-val">Enforced / Active</span>
            </div>
            <div class="service-metric-row">
              <span class="metric-lbl">Health State:</span>
              <span class="metric-val">${pg.error ? this.escapeHtml(pg.error) : 'Connected'}</span>
            </div>
          </div>
        </div>

        <!-- 3. Redis Cache & Sessions -->
        <div class="service-health-card">
          <div class="service-card-header">
            <span class="service-name">Redis Cache & Sessions</span>
            <span class="status-pill status-${redis.status === 'healthy' ? 'healthy' : 'unavailable'}">
              ● ${redis.status || 'unavailable'}
            </span>
          </div>
          <div class="service-metric-list">
            <div class="service-metric-row">
              <span class="metric-lbl">Cache Mode:</span>
              <span class="metric-val">${redis.fallbackState === 'none' ? 'In-Memory Cache Active' : 'Cache Bypass Fallback'}</span>
            </div>
            <div class="service-metric-row">
              <span class="metric-lbl">Ping Latency:</span>
              <span class="metric-val text-primary"><strong>${redis.latencyMs !== null ? `${redis.latencyMs} ms` : 'Offline'}</strong></span>
            </div>
            <div class="service-metric-row">
              <span class="metric-lbl">Fallback Resilience:</span>
              <span class="metric-val text-success">Enabled (Zero-Crash)</span>
            </div>
            <div class="service-metric-row">
              <span class="metric-lbl">Operational State:</span>
              <span class="metric-val">${redis.error ? this.escapeHtml(redis.error) : 'Operational'}</span>
            </div>
          </div>
        </div>

        <!-- 4. FastAPI AI Service -->
        <div class="service-health-card">
          <div class="service-card-header">
            <span class="service-name">FastAPI AI Microservice</span>
            <span class="status-pill status-${fastapi.status || 'unknown'}">● ${fastapi.status || 'unknown'}</span>
          </div>
          <div class="service-metric-list">
            <div class="service-metric-row">
              <span class="metric-lbl">Specification:</span>
              <span class="metric-val">v${this.escapeHtml(fastapi.specVersion || '1.0.0')}</span>
            </div>
            <div class="service-metric-row">
              <span class="metric-lbl">HTTP Probe Latency:</span>
              <span class="metric-val text-primary"><strong>${fastapi.latencyMs !== null ? `${fastapi.latencyMs} ms` : 'Offline'}</strong></span>
            </div>
            <div class="service-metric-row">
              <span class="metric-lbl">Anti-Cheat Validation:</span>
              <span class="metric-val text-success">Strict Non-Coding</span>
            </div>
            <div class="service-metric-row">
              <span class="metric-lbl">Service State:</span>
              <span class="metric-val">${fastapi.error ? this.escapeHtml(fastapi.error) : 'Available'}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- AI Microservice Telemetry Section -->
      <h3 class="section-subheading" style="margin-top: 2rem;">AI Generation Telemetry & Quality Metrics</h3>
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-header">
            <span class="kpi-title">Total AI Generation Requests</span>
            <span class="kpi-icon">🤖</span>
          </div>
          <div class="kpi-value">${(summary.totalRequests || 0).toLocaleString()}</div>
          <div class="kpi-meta text-muted">Educational puzzle prompts</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-header">
            <span class="kpi-title">Valid Generation Rate</span>
            <span class="kpi-icon">✨</span>
          </div>
          <div class="kpi-value text-success">${summary.totalRequests > 0 ? Math.round((summary.successfulRequests / summary.totalRequests) * 100) : 100}%</div>
          <div class="kpi-meta">
            <span>${summary.successfulRequests || 0} passed authoritative pipeline</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-header">
            <span class="kpi-title">Validation Blocked</span>
            <span class="kpi-icon">🛡️</span>
          </div>
          <div class="kpi-value text-warning">${summary.validationFailures || 0}</div>
          <div class="kpi-meta text-muted">Anti-coding or format violation retries</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-header">
            <span class="kpi-title">Average LLM Latency</span>
            <span class="kpi-icon">⚡</span>
          </div>
          <div class="kpi-value text-primary">${summary.averageLatencyMs || 0} ms</div>
          <div class="kpi-meta text-muted">Round-trip prompt and validation duration</div>
        </div>
      </div>

      <!-- Recent AI Generation Logs Table -->
      <div class="panel-card" style="margin-top: 1.5rem;">
        <div class="panel-header">
          <h3>Recent AI Generation Event Logs</h3>
          <span class="text-muted small">Real-time prompt execution telemetry</span>
        </div>
        <div class="panel-body">
          ${recentLogs.length === 0 ? '<p class="text-muted">No generation events logged yet.</p>' : `
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Knowledge Domain</th>
                    <th>Difficulty</th>
                    <th>Status</th>
                    <th>Latency</th>
                    <th>Fallback</th>
                  </tr>
                </thead>
                <tbody>
                  ${recentLogs.map(log => `
                    <tr>
                      <td>${new Date(log.createdAt).toLocaleTimeString()}</td>
                      <td><strong>${this.escapeHtml(this.formatTopic(log.topic))}</strong></td>
                      <td><span class="badge badge-outline">${this.escapeHtml(log.difficulty)}</span></td>
                      <td>
                        <span class="badge badge-${log.status === 'success' ? 'success' : log.status === 'validation_failed' ? 'warning' : 'danger'}">
                          ${this.escapeHtml(log.status)}
                        </span>
                      </td>
                      <td>${log.latencyMs || 0} ms</td>
                      <td>${log.isFallback ? '⚠️ Dev Catalog' : '⚡ Live LLM'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </div>
    `;
  },

  formatUptime(totalSeconds) {
    if (!totalSeconds) return '0s';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  },

  formatTopic(slug) {
    if (!slug) return 'General';
    return slug
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

window.health = health;
