"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// ==========================================
// 1. Core State Definition
// ==========================================
let selectedService = 'ALL';
let isStreaming = true;
let isTrafficSpike = false;
let isCdnDegraded = false;
let cpuAlertThreshold = 80;
let pipelineTargetEnv = 'dev-env';
let incidents = [];
let logs = [];
let historicalData = [];
// Pipeline state
let isPipelineRunning = false;
let pipelineActiveStepIndex = -1;
let pipelineSteps = [
    { id: 'lint', name: 'Static Code Lint', status: 'pending' },
    { id: 'test', name: 'Integration Testing', status: 'pending' },
    { id: 'build', name: 'Vite Build Package', status: 'pending' },
    { id: 'deploy', name: 'Firebase Edge Release', status: 'pending' }
];
// ==========================================
// 2. Pre-Populate Static Constants & Templates
// ==========================================
const SERVICES = ['ALL', 'production-api', 'staging-env', 'edge-cdn', 'database-replica'];
const MOCK_MESSAGES = {
    INFO: [
        'Connection pool healthcheck passed. Active handles: 14',
        'Ingress route mapping completed for resource path.',
        'Heartbeat beacon transmitted successfully to edge node.',
        'Telemetry daemon aggregated metric packet.',
        'Garbage collection executed successfully. Cleared 142MB.',
        'Static assets cached at regional edge endpoint.',
        'Session storage cleanup check completed. No stale tokens found.'
    ],
    WARN: [
        'Minor database replication latency detected (184ms).',
        'Resource footprint approaching warning threshold.',
        'CDN cache miss spike detected in regional subnet.',
        'API endpoint throttle limit reached for anonymous IP range.',
        'Varnish cache purge delay exceeded expected window.',
        'Spike in unauthenticated TCP handshake attempts.'
    ],
    ERROR: [
        'Internal pool buffer allocation overflow!',
        'SSL Handshake failed on ingress router node.',
        'Database connection pool timeout during aggregate query.',
        'Failed to read replication logs from leader node.',
        'CDN gateway returned HTTP 502 Bad Gateway.',
        'Unauthorized SSH attempt locked out by Fail2Ban.'
    ],
    SUCCESS: [
        'Successfully renewed TLS certificate via Let\'s Encrypt.',
        'Config map updated across all container namespaces.',
        'Database migration patch schema-v14.0.2 applied successfully.',
        'Edge node distribution completed for staging artifact.'
    ]
};
// Seed baseline metrics
function getServiceBaselines(service) {
    switch (service) {
        case 'production-api':
            return {
                uptime: 99.98,
                uptimeTrend: '+0.01%',
                uptimeStatus: 'stable',
                buildTime: 42,
                cdnRate: 88.5,
                cpu: 52.0,
                memory: 58.5,
                netIn: 245.2,
                netOut: 612.4,
                reqRate: 1850
            };
        case 'staging-env':
            return {
                uptime: 99.82,
                uptimeTrend: '-0.04%',
                uptimeStatus: 'down',
                buildTime: 38,
                cdnRate: 74.2,
                cpu: 18.4,
                memory: 34.1,
                netIn: 12.5,
                netOut: 32.8,
                reqRate: 45
            };
        case 'edge-cdn':
            return {
                uptime: 99.99,
                uptimeTrend: '+0.02%',
                uptimeStatus: 'up',
                buildTime: 48,
                cdnRate: 96.8,
                cpu: 28.1,
                memory: 42.5,
                netIn: 412.9,
                netOut: 890.2,
                reqRate: 3120
            };
        case 'database-replica':
            return {
                uptime: 99.95,
                uptimeTrend: 'stable',
                uptimeStatus: 'stable',
                buildTime: 55,
                cdnRate: 0, // Not applicable
                cpu: 45.8,
                memory: 78.4, // High memory due to database cache
                netIn: 84.6,
                netOut: 192.5,
                reqRate: 0 // No direct requests
            };
        case 'ALL':
        default:
            return {
                uptime: 99.95,
                uptimeTrend: '+0.01%',
                uptimeStatus: 'up',
                buildTime: 45,
                cdnRate: 92.4,
                cpu: 42.5,
                memory: 68.2,
                netIn: 184.2,
                netOut: 412.8,
                reqRate: 1250
            };
    }
}
// Generate randomized logs to pre-fill the console
function seedLogs() {
    const seeded = [];
    const now = new Date();
    for (let i = 25; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - i * 8000).toISOString();
        const levels = ['INFO', 'INFO', 'SUCCESS', 'INFO', 'WARN', 'INFO'];
        const level = levels[Math.floor(Math.random() * levels.length)];
        const service = SERVICES[Math.floor(Math.random() * (SERVICES.length - 1)) + 1]; // Avoid 'ALL'
        const messages = MOCK_MESSAGES[level];
        const message = messages[Math.floor(Math.random() * messages.length)];
        seeded.push({
            id: `seed-log-${i}`,
            timestamp,
            level,
            service,
            message
        });
    }
    return seeded;
}
// Seed historical graph points
function seedHistoricalData(service) {
    const seeded = [];
    const now = new Date();
    const baseline = getServiceBaselines(service);
    for (let i = 14; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - i * 3000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const noise = (Math.random() - 0.5) * 5;
        const cpuVal = Math.min(98, Math.max(5, baseline.cpu + noise));
        const memVal = Math.min(98, Math.max(10, baseline.memory + (Math.random() - 0.5) * 2));
        const reqNoise = (Math.random() - 0.5) * (baseline.reqRate * 0.1);
        const requestsVal = Math.max(0, baseline.reqRate + reqNoise);
        let cdnNoise = (Math.random() - 0.5) * 2;
        let cdnVal = baseline.cdnRate === 0 ? 0 : Math.min(100, Math.max(40, baseline.cdnRate + cdnNoise));
        seeded.push({
            timestamp,
            cpu: parseFloat(cpuVal.toFixed(1)),
            memory: parseFloat(memVal.toFixed(1)),
            cdnHitRate: parseFloat(cdnVal.toFixed(1)),
            requests: Math.round(requestsVal),
            networkIn: parseFloat((baseline.netIn + (Math.random() - 0.5) * 10).toFixed(1)),
            networkOut: parseFloat((baseline.netOut + (Math.random() - 0.5) * 20).toFixed(1))
        });
    }
    return seeded;
}
// Initial seeding of state
incidents = [
    {
        id: 'inc-001',
        service: 'database-replica',
        severity: 'warning',
        message: 'Postgres transactional log replication lag exceeded 500ms.',
        timestamp: new Date(Date.now() - 360000).toISOString(),
        acknowledged: false
    },
    {
        id: 'inc-002',
        service: 'production-api',
        severity: 'critical',
        message: 'High CPU alert triggered. Node threshold reached on production-api.',
        timestamp: new Date(Date.now() - 120000).toISOString(),
        acknowledged: false
    }
];
logs = seedLogs();
historicalData = seedHistoricalData('ALL');
// ==========================================
// 3. UI Renderer Engines
// ==========================================
// Simple DOM element helpers
const $ = (id) => document.getElementById(id);
// Render the service filter tabs
function renderServiceSelectors() {
    const container = $('service-selectors');
    if (!container)
        return;
    container.innerHTML = SERVICES.map(service => {
        const isActive = selectedService === service;
        const activeClass = 'bg-indigo-600 border-indigo-500 text-zinc-100 font-semibold';
        const inactiveClass = 'bg-zinc-950/80 hover:bg-zinc-900 border-zinc-850 text-zinc-400 hover:text-zinc-200';
        return `
      <button
        data-service="${service}"
        class="service-select-btn px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-all cursor-pointer ${isActive ? activeClass : inactiveClass}"
      >
        ${service}
      </button>
    `;
    }).join('');
    // Attach fresh listeners
    document.querySelectorAll('.service-select-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget;
            const service = target.getAttribute('data-service');
            changeServiceScope(service);
        });
    });
}
// Handle Service Scope change
function changeServiceScope(service) {
    selectedService = service;
    // Update Header labels
    const scopeLabel = $('active-scope-label');
    if (scopeLabel) {
        scopeLabel.textContent = service === 'ALL' ? 'Global Infrastructure' : `Service: ${service}`;
    }
    // Refresh historical baseline and seed fresh metrics instantly
    historicalData = seedHistoricalData(service);
    updateMetricsAndUI();
    renderServiceSelectors();
    renderCharts();
    // Log event
    addSystemLog('INFO', service === 'ALL' ? 'edge-cdn' : service, `User changed active telemetry dashboard viewing scope to: ${service}`);
}
// Update primary and secondary numerical metrics
function updateMetricsAndUI() {
    const baseline = getServiceBaselines(selectedService);
    // Add noise or multipliers based on simulation variables
    let trafficMultiplier = isTrafficSpike ? 1.8 : 1.0;
    let cpuAdd = isTrafficSpike ? 28.5 : 0;
    let memAdd = isTrafficSpike ? 12.1 : 0;
    let cacheMultiplier = isCdnDegraded ? 0.65 : 1.0;
    let finalCpu = Math.min(99.5, Math.max(5, (baseline.cpu + cpuAdd) + (Math.random() - 0.5) * 3));
    let finalMem = Math.min(99.0, Math.max(8, (baseline.memory + memAdd) + (Math.random() - 0.5) * 1.5));
    let finalReq = Math.round(baseline.reqRate * trafficMultiplier + (Math.random() - 0.5) * 50);
    if (finalReq < 0)
        finalReq = 0;
    let finalCdn = baseline.cdnRate;
    if (finalCdn > 0) {
        finalCdn = Math.min(99.9, Math.max(42.0, (baseline.cdnRate * cacheMultiplier) + (Math.random() - 0.5) * 1));
    }
    let finalUptime = baseline.uptime;
    if (isCdnDegraded && selectedService === 'edge-cdn') {
        finalUptime = Math.max(98.15, finalUptime - 0.45);
    }
    // Update elements
    const uptimeVal = $('metric-uptime-val');
    const uptimeBar = $('metric-uptime-bar');
    const uptimeBarLabel = $('metric-uptime-bar-label');
    const uptimeTrend = $('metric-uptime-trend');
    if (uptimeVal)
        uptimeVal.textContent = finalUptime.toFixed(2);
    if (uptimeBar)
        uptimeBar.style.width = `${finalUptime}%`;
    if (uptimeBarLabel)
        uptimeBarLabel.textContent = `${finalUptime.toFixed(2)}%`;
    const buildtimeVal = $('metric-buildtime-val');
    if (buildtimeVal)
        buildtimeVal.textContent = baseline.buildTime.toString();
    const cdnVal = $('metric-cdn-val');
    const cdnBar = $('metric-cdn-bar');
    const cdnBarLabel = $('metric-cdn-bar-label');
    if (baseline.cdnRate === 0) {
        if (cdnVal)
            cdnVal.textContent = 'N/A';
        if (cdnBar)
            cdnBar.style.width = '0%';
        if (cdnBarLabel)
            cdnBarLabel.textContent = 'Not Applicable';
    }
    else {
        if (cdnVal)
            cdnVal.textContent = finalCdn.toFixed(1);
        if (cdnBar)
            cdnBar.style.width = `${finalCdn}%`;
        if (cdnBarLabel)
            cdnBarLabel.textContent = `${finalCdn.toFixed(1)}%`;
    }
    // Secondary metrics
    const cpuVal = $('metric-cpu-val');
    const cpuBar = $('metric-cpu-bar');
    if (cpuVal)
        cpuVal.textContent = finalCpu.toFixed(1);
    if (cpuBar)
        cpuBar.style.width = `${finalCpu}%`;
    const memoryVal = $('metric-memory-val');
    const memoryBar = $('metric-memory-bar');
    if (memoryVal)
        memoryVal.textContent = finalMem.toFixed(1);
    if (memoryBar)
        memoryBar.style.width = `${finalMem}%`;
    const netinVal = $('metric-netin-val');
    const netoutVal = $('metric-netout-val');
    if (netinVal)
        netinVal.textContent = (baseline.netIn * trafficMultiplier + (Math.random() - 0.5) * 5).toFixed(1);
    if (netoutVal)
        netoutVal.textContent = (baseline.netOut * trafficMultiplier + (Math.random() - 0.5) * 15).toFixed(1);
    // Trigger high CPU alert threshold simulation
    if (finalCpu >= cpuAlertThreshold) {
        triggerCpuThresholdBreach(finalCpu);
    }
}
// Auto-trigger critical alert on high threshold
let lastThresholdBreachTime = 0;
function triggerCpuThresholdBreach(cpu) {
    const now = Date.now();
    if (now - lastThresholdBreachTime < 30000)
        return; // Limit alerts to once every 30s
    lastThresholdBreachTime = now;
    const msg = `Host core threshold breached. High CPU allocation detected: ${cpu.toFixed(1)}% (Threshold: ${cpuAlertThreshold}%)`;
    const svc = selectedService === 'ALL' ? 'production-api' : selectedService;
    addIncident(svc, 'critical', msg);
    addSystemLog('ERROR', svc, `ALERT: ${msg}`);
}
// Add system log line and re-render logs
function addSystemLog(level, service, message) {
    const newLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        timestamp: new Date().toISOString(),
        level,
        service,
        message
    };
    logs.unshift(newLog); // prepend
    if (logs.length > 100)
        logs.pop(); // Cap length
    renderLogs();
}
// Render active incidents list
function renderIncidents() {
    const container = $('incidents-container');
    const countBadge = $('unacknowledged-incidents-count');
    if (!container)
        return;
    const unackCount = incidents.filter(i => !i.acknowledged).length;
    if (countBadge) {
        countBadge.textContent = `${unackCount} unacknowledged`;
        if (unackCount > 0) {
            countBadge.className = 'bg-rose-500/15 border border-rose-500/40 text-rose-400 text-[10px] font-mono px-2.5 py-0.5 rounded-full select-none font-semibold animate-pulse';
        }
        else {
            countBadge.className = 'bg-zinc-900 border border-zinc-800 text-zinc-500 text-[10px] font-mono px-2 py-0.5 rounded-full select-none';
        }
    }
    if (incidents.length === 0) {
        container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-zinc-850 rounded-xl bg-zinc-950/20 text-zinc-500">
        <!-- ShieldCheck Icon -->
        <svg class="w-10 h-10 text-emerald-500/40 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <p class="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold">Zero Host Incidents</p>
        <p class="text-[10px] text-zinc-500 mt-0.5">All services operating within normal limits. Ingress streams clear.</p>
      </div>
    `;
        return;
    }
    container.innerHTML = incidents.map(incident => {
        const isCritical = incident.severity === 'critical';
        const isAck = incident.acknowledged;
        const severityBg = isCritical
            ? 'bg-rose-500/10 border-rose-500/35 hover:border-rose-500/50'
            : 'bg-amber-500/10 border-amber-500/35 hover:border-amber-500/50';
        const flagColor = isCritical ? 'bg-rose-500' : 'bg-amber-500';
        const textColor = isCritical ? 'text-rose-400' : 'text-amber-400';
        return `
      <div 
        id="incident-item-${incident.id}" 
        class="border rounded-xl p-3.5 transition-all duration-300 flex items-start gap-3 relative overflow-hidden ${severityBg} ${isAck ? 'opacity-65 grayscale-[30%]' : ''}"
      >
        <div class="absolute top-0 left-0 bottom-0 w-1 ${flagColor}"></div>
        
        <div class="flex-1 space-y-1.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${isCritical ? 'bg-rose-950 text-rose-300' : 'bg-amber-950 text-amber-300'}">
                ${incident.severity}
              </span>
              <span class="text-[11px] font-mono text-zinc-400 font-semibold">${incident.service}</span>
            </div>
            <span class="text-[10px] font-mono text-zinc-500">
              ${new Date(incident.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>

          <p class="text-xs text-zinc-200 leading-normal font-medium select-text">${incident.message}</p>

          <div class="flex items-center gap-1.5 pt-1.5">
            ${!isAck ? `
              <button
                data-id="${incident.id}"
                class="btn-ack px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition-all cursor-pointer font-semibold"
              >
                Acknowledge
              </button>
            ` : `
              <span class="text-[10px] font-mono text-zinc-500 flex items-center gap-1 select-none">
                <svg class="w-3.5 h-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Acked
              </span>
            `}

            <button
              data-id="${incident.id}"
              class="btn-resolve px-2 py-1 rounded bg-zinc-950/60 hover:bg-zinc-950 border border-zinc-900 text-[10px] font-mono text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer"
            >
              Resolve
            </button>
          </div>
        </div>
      </div>
    `;
    }).join('');
    // Attach action button event listeners
    container.querySelectorAll('.btn-ack').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget;
            const id = target.getAttribute('data-id');
            acknowledgeIncident(id);
        });
    });
    container.querySelectorAll('.btn-resolve').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget;
            const id = target.getAttribute('data-id');
            resolveIncident(id);
        });
    });
}
function addIncident(service, severity, message) {
    const newIncident = {
        id: `inc-${Date.now()}`,
        service,
        severity,
        message,
        timestamp: new Date().toISOString(),
        acknowledged: false
    };
    incidents.unshift(newIncident);
    renderIncidents();
}
function acknowledgeIncident(id) {
    const incident = incidents.find(i => i.id === id);
    if (incident) {
        incident.acknowledged = true;
        renderIncidents();
        addSystemLog('INFO', incident.service, `Incident ${id} acknowledged by user.`);
    }
}
function resolveIncident(id) {
    const incidentIdx = incidents.findIndex(i => i.id === id);
    if (incidentIdx > -1) {
        const incident = incidents[incidentIdx];
        // Animate item exit
        const element = $(`incident-item-${id}`);
        if (element) {
            element.classList.add('transition-all', 'duration-300', 'opacity-0', '-translate-x-4');
            setTimeout(() => {
                incidents.splice(incidentIdx, 1);
                renderIncidents();
                addSystemLog('SUCCESS', incident.service, `Incident resolved successfully: ${incident.message}`);
            }, 300);
        }
        else {
            incidents.splice(incidentIdx, 1);
            renderIncidents();
        }
    }
}
// Render dynamic infrastructure stream log rows
function renderLogs() {
    var _a, _b, _c;
    const container = $('streaming-logs-container');
    if (!container)
        return;
    const searchVal = ((_a = $('logs-search-input')) === null || _a === void 0 ? void 0 : _a.value.toLowerCase()) || '';
    const levelVal = ((_b = $('logs-level-selector')) === null || _b === void 0 ? void 0 : _b.value) || 'ALL';
    const serviceVal = ((_c = $('logs-service-selector')) === null || _c === void 0 ? void 0 : _c.value) || 'ALL';
    const filtered = logs.filter(log => {
        const matchesSearch = log.message.toLowerCase().includes(searchVal) || log.service.toLowerCase().includes(searchVal);
        const matchesLevel = levelVal === 'ALL' || log.level === levelVal;
        const matchesService = serviceVal === 'ALL' || log.service === serviceVal;
        return matchesSearch && matchesLevel && matchesService;
    });
    if (filtered.length === 0) {
        container.innerHTML = `
      <div class="text-zinc-600 text-center py-12 select-none">
        No dynamic log packets match current filter profiles.
      </div>
    `;
        return;
    }
    container.innerHTML = filtered.map(log => {
        let levelClass = 'text-zinc-500';
        if (log.level === 'SUCCESS')
            levelClass = 'text-emerald-400 bg-emerald-950/20 px-1 rounded border border-emerald-900/20';
        if (log.level === 'WARN')
            levelClass = 'text-amber-400 bg-amber-950/20 px-1 rounded border border-amber-900/20';
        if (log.level === 'ERROR')
            levelClass = 'text-rose-400 bg-rose-950/20 px-1 rounded border border-rose-900/20 font-bold';
        if (log.level === 'INFO')
            levelClass = 'text-indigo-400 bg-indigo-950/10 px-1 rounded border border-indigo-900/10';
        const serviceBadge = `<span class="text-zinc-500 font-semibold">[${log.service}]</span>`;
        const formattedTime = new Date(log.timestamp).toLocaleTimeString([], { hour12: false });
        return `
      <div class="hover:bg-zinc-900/40 p-1.5 rounded transition-colors flex items-start gap-2 border-b border-zinc-950">
        <span class="text-zinc-600 text-[10px] select-none pt-0.5 shrink-0 font-mono">${formattedTime}</span>
        <span class="text-[10px] font-mono font-bold shrink-0 ${levelClass}">${log.level}</span>
        ${serviceBadge}
        <span class="text-zinc-300 leading-normal select-text break-all">${log.message}</span>
      </div>
    `;
    }).join('');
}
// ==========================================
// 4. Custom Responsive SVG Charting Engine
// ==========================================
function renderCharts() {
    renderResourceChart();
    renderTrafficChart();
}
// SVG Area Chart: CPU & Memory usage over time
function renderResourceChart() {
    const svg = $('resource-chart-svg');
    if (!svg)
        return;
    const width = 600;
    const height = 240;
    const paddingLeft = 45;
    const paddingRight = 15;
    const paddingTop = 20;
    const paddingBottom = 30;
    const graphWidth = width - paddingLeft - paddingRight;
    const graphHeight = height - paddingTop - paddingBottom;
    // Clear svg
    svg.innerHTML = '';
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    if (historicalData.length === 0)
        return;
    // Define Gradients and shadows inside <defs>
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
    <linearGradient id="cpu-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#6366f1" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#6366f1" stop-opacity="0.0"/>
    </linearGradient>
    <linearGradient id="mem-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#d946ef" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#d946ef" stop-opacity="0.0"/>
    </linearGradient>
  `;
    svg.appendChild(defs);
    // Draw Grid lines (Y Axis)
    const gridLinesCount = 4;
    for (let i = 0; i <= gridLinesCount; i++) {
        const yVal = paddingTop + (graphHeight / gridLinesCount) * i;
        const percentage = 100 - (100 / gridLinesCount) * i;
        // Grid line
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', paddingLeft.toString());
        line.setAttribute('y1', yVal.toString());
        line.setAttribute('x2', (width - paddingRight).toString());
        line.setAttribute('y2', yVal.toString());
        line.setAttribute('stroke', '#18181b');
        line.setAttribute('stroke-width', '1');
        svg.appendChild(line);
        // Label text
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', (paddingLeft - 10).toString());
        text.setAttribute('y', (yVal + 3.5).toString());
        text.setAttribute('fill', '#52525b');
        text.setAttribute('font-size', '9');
        text.setAttribute('font-family', 'JetBrains Mono');
        text.setAttribute('text-anchor', 'end');
        text.textContent = `${percentage}%`;
        svg.appendChild(text);
    }
    // Map historical points to coordinates
    const pointsCpu = [];
    const pointsMem = [];
    const stepX = graphWidth / (historicalData.length - 1);
    historicalData.forEach((pt, idx) => {
        const x = paddingLeft + idx * stepX;
        // CPU coordinate mapping (0-100%)
        const yCpu = paddingTop + graphHeight - (pt.cpu / 100) * graphHeight;
        pointsCpu.push([x, yCpu]);
        // Memory coordinate mapping (0-100%)
        const yMem = paddingTop + graphHeight - (pt.memory / 100) * graphHeight;
        pointsMem.push([x, yMem]);
    });
    // Helper to generate path d attribute
    const getAreaPath = (points) => {
        let d = `M ${points[0][0]} ${points[0][1]}`;
        for (let i = 1; i < points.length; i++) {
            d += ` L ${points[i][0]} ${points[i][1]}`;
        }
        // close area
        d += ` L ${points[points.length - 1][0]} ${paddingTop + graphHeight}`;
        d += ` L ${points[0][0]} ${paddingTop + graphHeight} Z`;
        return d;
    };
    const getLinePath = (points) => {
        let d = `M ${points[0][0]} ${points[0][1]}`;
        for (let i = 1; i < points.length; i++) {
            d += ` L ${points[i][0]} ${points[i][1]}`;
        }
        return d;
    };
    // 1. Draw Memory area & line
    const memArea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    memArea.setAttribute('d', getAreaPath(pointsMem));
    memArea.setAttribute('fill', 'url(#mem-grad)');
    svg.appendChild(memArea);
    const memLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    memLine.setAttribute('d', getLinePath(pointsMem));
    memLine.setAttribute('fill', 'none');
    memLine.setAttribute('stroke', '#d946ef');
    memLine.setAttribute('stroke-width', '1.5');
    memLine.setAttribute('stroke-linecap', 'round');
    memLine.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(memLine);
    // 2. Draw CPU area & line
    const cpuArea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    cpuArea.setAttribute('d', getAreaPath(pointsCpu));
    cpuArea.setAttribute('fill', 'url(#cpu-grad)');
    svg.appendChild(cpuArea);
    const cpuLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    cpuLine.setAttribute('d', getLinePath(pointsCpu));
    cpuLine.setAttribute('fill', 'none');
    cpuLine.setAttribute('stroke', '#6366f1');
    cpuLine.setAttribute('stroke-width', '1.5');
    cpuLine.setAttribute('stroke-linecap', 'round');
    cpuLine.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(cpuLine);
    // Draw X Axis labels
    historicalData.forEach((pt, idx) => {
        // Only draw every 3rd label to avoid clutter
        if (idx % 3 !== 0 && idx !== historicalData.length - 1)
            return;
        const x = paddingLeft + idx * stepX;
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', x.toString());
        text.setAttribute('y', (height - 8).toString());
        text.setAttribute('fill', '#3f3f46');
        text.setAttribute('font-size', '8');
        text.setAttribute('font-family', 'JetBrains Mono');
        text.setAttribute('text-anchor', 'middle');
        text.textContent = pt.timestamp;
        svg.appendChild(text);
        // Minor tick
        const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        tick.setAttribute('x1', x.toString());
        tick.setAttribute('y1', (paddingTop + graphHeight).toString());
        tick.setAttribute('x2', x.toString());
        tick.setAttribute('y2', (paddingTop + graphHeight + 4).toString());
        tick.setAttribute('stroke', '#27272a');
        svg.appendChild(tick);
    });
    // Hover Interaction vertical tracker line (hidden by default)
    const hoverLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    hoverLine.setAttribute('x1', '0');
    hoverLine.setAttribute('y1', paddingTop.toString());
    hoverLine.setAttribute('x2', '0');
    hoverLine.setAttribute('y2', (paddingTop + graphHeight).toString());
    hoverLine.setAttribute('stroke', '#3f3f46');
    hoverLine.setAttribute('stroke-dasharray', '3,3');
    hoverLine.setAttribute('stroke-width', '1');
    hoverLine.setAttribute('style', 'display: none;');
    hoverLine.id = 'resource-hover-line';
    svg.appendChild(hoverLine);
    // Hover tracker dots
    const cpuDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    cpuDot.setAttribute('r', '4');
    cpuDot.setAttribute('fill', '#6366f1');
    cpuDot.setAttribute('stroke', '#09090b');
    cpuDot.setAttribute('stroke-width', '1.5');
    cpuDot.setAttribute('style', 'display: none;');
    cpuDot.id = 'resource-cpu-dot';
    svg.appendChild(cpuDot);
    const memDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    memDot.setAttribute('r', '4');
    memDot.setAttribute('fill', '#d946ef');
    memDot.setAttribute('stroke', '#09090b');
    memDot.setAttribute('stroke-width', '1.5');
    memDot.setAttribute('style', 'display: none;');
    memDot.id = 'resource-mem-dot';
    svg.appendChild(memDot);
    // Setup interactive hovering listeners
    setupChartHover('resource-chart-container', width, paddingLeft, stepX, (idx, cursorX) => {
        const dataPt = historicalData[idx];
        const hoverValL = $('resource-hover-line');
        const dotC = $('resource-cpu-dot');
        const dotM = $('resource-mem-dot');
        const tooltip = $('chart-tooltip');
        if (!dataPt)
            return;
        const cx = paddingLeft + idx * stepX;
        const cyCpu = paddingTop + graphHeight - (dataPt.cpu / 100) * graphHeight;
        const cyMem = paddingTop + graphHeight - (dataPt.memory / 100) * graphHeight;
        if (hoverValL) {
            hoverValL.setAttribute('x1', cx.toString());
            hoverValL.setAttribute('x2', cx.toString());
            hoverValL.setAttribute('style', 'display: block;');
        }
        if (dotC) {
            dotC.setAttribute('cx', cx.toString());
            dotC.setAttribute('cy', cyCpu.toString());
            dotC.setAttribute('style', 'display: block;');
        }
        if (dotM) {
            dotM.setAttribute('cx', cx.toString());
            dotM.setAttribute('cy', cyMem.toString());
            dotM.setAttribute('style', 'display: block;');
        }
        if (tooltip) {
            tooltip.classList.remove('hidden');
            tooltip.style.left = `${cursorX + 15}px`;
            tooltip.style.top = `30px`;
            tooltip.innerHTML = `
        <div class="text-zinc-500 font-semibold border-b border-zinc-900 pb-1 flex justify-between gap-4">
          <span>TIME: ${dataPt.timestamp}</span>
          <span class="text-[10px] text-zinc-600 font-mono">NODE SCALE</span>
        </div>
        <div class="flex items-center justify-between gap-8 pt-1">
          <span class="text-indigo-400 font-medium">● CPU Core Usage:</span>
          <span class="font-bold text-zinc-200">${dataPt.cpu.toFixed(1)}%</span>
        </div>
        <div class="flex items-center justify-between gap-8">
          <span class="text-fuchsia-400 font-medium">● Memory Allocation:</span>
          <span class="font-bold text-zinc-200">${dataPt.memory.toFixed(1)}%</span>
        </div>
      `;
        }
    }, () => {
        const hoverValL = $('resource-hover-line');
        const dotC = $('resource-cpu-dot');
        const dotM = $('resource-mem-dot');
        const tooltip = $('chart-tooltip');
        if (hoverValL)
            hoverValL.setAttribute('style', 'display: none;');
        if (dotC)
            dotC.setAttribute('style', 'display: none;');
        if (dotM)
            dotM.setAttribute('style', 'display: none;');
        if (tooltip)
            tooltip.classList.add('hidden');
    });
}
// SVG Line Chart: Inbound Traffic & CDN Cache Hit Rate
function renderTrafficChart() {
    const svg = $('traffic-chart-svg');
    if (!svg)
        return;
    const width = 600;
    const height = 240;
    const paddingLeft = 45;
    const paddingRight = 45; // Double-axis requires padding on both sides
    const paddingTop = 20;
    const paddingBottom = 30;
    const graphWidth = width - paddingLeft - paddingRight;
    const graphHeight = height - paddingTop - paddingBottom;
    // Clear svg
    svg.innerHTML = '';
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    if (historicalData.length === 0)
        return;
    // Max requests limit for y-axis mapping
    const baseline = getServiceBaselines(selectedService);
    const maxRequests = baseline.reqRate === 0 ? 100 : Math.ceil(baseline.reqRate * 2.2);
    // Draw Grid lines
    const gridLinesCount = 4;
    for (let i = 0; i <= gridLinesCount; i++) {
        const yVal = paddingTop + (graphHeight / gridLinesCount) * i;
        const reqPercentage = Math.round(maxRequests - (maxRequests / gridLinesCount) * i);
        const cdnPercentage = Math.round(100 - (100 / gridLinesCount) * i);
        // Grid line
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', paddingLeft.toString());
        line.setAttribute('y1', yVal.toString());
        line.setAttribute('x2', (width - paddingRight).toString());
        line.setAttribute('y2', yVal.toString());
        line.setAttribute('stroke', '#18181b');
        line.setAttribute('stroke-width', '1');
        svg.appendChild(line);
        // Left Axis Label (Requests/s)
        const textLeft = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textLeft.setAttribute('x', (paddingLeft - 10).toString());
        textLeft.setAttribute('y', (yVal + 3.5).toString());
        textLeft.setAttribute('fill', '#38bdf8'); // sky blue
        textLeft.setAttribute('font-size', '8.5');
        textLeft.setAttribute('font-family', 'JetBrains Mono');
        textLeft.setAttribute('text-anchor', 'end');
        textLeft.textContent = `${reqPercentage}`;
        svg.appendChild(textLeft);
        // Right Axis Label (CDN Cache Hit Rate %)
        if (baseline.cdnRate > 0) {
            const textRight = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            textRight.setAttribute('x', (width - paddingRight + 10).toString());
            textRight.setAttribute('y', (yVal + 3.5).toString());
            textRight.setAttribute('fill', '#10b981'); // emerald
            textRight.setAttribute('font-size', '8.5');
            textRight.setAttribute('font-family', 'JetBrains Mono');
            textRight.setAttribute('text-anchor', 'start');
            textRight.textContent = `${cdnPercentage}%`;
            svg.appendChild(textRight);
        }
    }
    // Draw Line Paths
    const pointsReq = [];
    const pointsCdn = [];
    const stepX = graphWidth / (historicalData.length - 1);
    historicalData.forEach((pt, idx) => {
        const x = paddingLeft + idx * stepX;
        // Requests mapping
        const yReq = paddingTop + graphHeight - (pt.requests / maxRequests) * graphHeight;
        pointsReq.push([x, yReq]);
        // CDN Cache mapping
        const yCdn = paddingTop + graphHeight - (pt.cdnHitRate / 100) * graphHeight;
        pointsCdn.push([x, yCdn]);
    });
    const getLinePath = (points) => {
        let d = `M ${points[0][0]} ${points[0][1]}`;
        for (let i = 1; i < points.length; i++) {
            d += ` L ${points[i][0]} ${points[i][1]}`;
        }
        return d;
    };
    // Draw Sky-Blue Traffic path
    const reqLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    reqLine.setAttribute('d', getLinePath(pointsReq));
    reqLine.setAttribute('fill', 'none');
    reqLine.setAttribute('stroke', '#0284c7');
    reqLine.setAttribute('stroke-width', '2');
    reqLine.setAttribute('stroke-linecap', 'round');
    reqLine.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(reqLine);
    // Draw Emerald Cache path (only if applicable)
    if (baseline.cdnRate > 0) {
        const cdnLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        cdnLine.setAttribute('d', getLinePath(pointsCdn));
        cdnLine.setAttribute('fill', 'none');
        cdnLine.setAttribute('stroke', '#10b981');
        cdnLine.setAttribute('stroke-width', '2');
        cdnLine.setAttribute('stroke-linecap', 'round');
        cdnLine.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(cdnLine);
    }
    // Draw X Axis labels
    historicalData.forEach((pt, idx) => {
        if (idx % 3 !== 0 && idx !== historicalData.length - 1)
            return;
        const x = paddingLeft + idx * stepX;
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', x.toString());
        text.setAttribute('y', (height - 8).toString());
        text.setAttribute('fill', '#3f3f46');
        text.setAttribute('font-size', '8');
        text.setAttribute('font-family', 'JetBrains Mono');
        text.setAttribute('text-anchor', 'middle');
        text.textContent = pt.timestamp;
        svg.appendChild(text);
        const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        tick.setAttribute('x1', x.toString());
        tick.setAttribute('y1', (paddingTop + graphHeight).toString());
        tick.setAttribute('x2', x.toString());
        tick.setAttribute('y2', (paddingTop + graphHeight + 4).toString());
        tick.setAttribute('stroke', '#27272a');
        svg.appendChild(tick);
    });
    // Vertical tracker & dots for hover
    const hoverLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    hoverLine.setAttribute('x1', '0');
    hoverLine.setAttribute('y1', paddingTop.toString());
    hoverLine.setAttribute('x2', '0');
    hoverLine.setAttribute('y2', (paddingTop + graphHeight).toString());
    hoverLine.setAttribute('stroke', '#3f3f46');
    hoverLine.setAttribute('stroke-dasharray', '3,3');
    hoverLine.setAttribute('style', 'display: none;');
    hoverLine.id = 'traffic-hover-line';
    svg.appendChild(hoverLine);
    const reqDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    reqDot.setAttribute('r', '4');
    reqDot.setAttribute('fill', '#0284c7');
    reqDot.setAttribute('stroke', '#09090b');
    reqDot.setAttribute('stroke-width', '1.5');
    reqDot.setAttribute('style', 'display: none;');
    reqDot.id = 'traffic-req-dot';
    svg.appendChild(reqDot);
    const cdnDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    cdnDot.setAttribute('r', '4');
    cdnDot.setAttribute('fill', '#10b981');
    cdnDot.setAttribute('stroke', '#09090b');
    cdnDot.setAttribute('stroke-width', '1.5');
    cdnDot.setAttribute('style', 'display: none;');
    cdnDot.id = 'traffic-cdn-dot';
    svg.appendChild(cdnDot);
    setupChartHover('traffic-chart-container', width, paddingLeft, stepX, (idx, cursorX) => {
        const dataPt = historicalData[idx];
        const hoverValL = $('traffic-hover-line');
        const dotR = $('traffic-req-dot');
        const dotC = $('traffic-cdn-dot');
        const tooltip = $('chart-tooltip');
        if (!dataPt)
            return;
        const cx = paddingLeft + idx * stepX;
        const cyReq = paddingTop + graphHeight - (dataPt.requests / maxRequests) * graphHeight;
        const cyCdn = paddingTop + graphHeight - (dataPt.cdnHitRate / 100) * graphHeight;
        if (hoverValL) {
            hoverValL.setAttribute('x1', cx.toString());
            hoverValL.setAttribute('x2', cx.toString());
            hoverValL.setAttribute('style', 'display: block;');
        }
        if (dotR) {
            dotR.setAttribute('cx', cx.toString());
            dotR.setAttribute('cy', cyReq.toString());
            dotR.setAttribute('style', 'display: block;');
        }
        if (dotC && baseline.cdnRate > 0) {
            dotC.setAttribute('cx', cx.toString());
            dotC.setAttribute('cy', cyCdn.toString());
            dotC.setAttribute('style', 'display: block;');
        }
        if (tooltip) {
            tooltip.classList.remove('hidden');
            tooltip.style.left = `${cursorX + 15}px`;
            tooltip.style.top = `300px`;
            tooltip.innerHTML = `
        <div class="text-zinc-500 font-semibold border-b border-zinc-900 pb-1 flex justify-between gap-4">
          <span>TIME: ${dataPt.timestamp}</span>
          <span class="text-[10px] text-zinc-600 font-mono">EDGE BALANCER</span>
        </div>
        <div class="flex items-center justify-between gap-8 pt-1">
          <span class="text-sky-400 font-medium font-mono text-[11px]">● Inbound Traffic:</span>
          <span class="font-bold text-zinc-200 font-mono text-xs">${dataPt.requests} req/s</span>
        </div>
        ${baseline.cdnRate > 0 ? `
        <div class="flex items-center justify-between gap-8 font-mono">
          <span class="text-emerald-400 font-medium text-[11px]">● CDN Cache Rate:</span>
          <span class="font-bold text-zinc-200 text-xs">${dataPt.cdnHitRate.toFixed(1)}%</span>
        </div>
        ` : ''}
      `;
        }
    }, () => {
        const hoverValL = $('traffic-hover-line');
        const dotR = $('traffic-req-dot');
        const dotC = $('traffic-cdn-dot');
        const tooltip = $('chart-tooltip');
        if (hoverValL)
            hoverValL.setAttribute('style', 'display: none;');
        if (dotR)
            dotR.setAttribute('style', 'display: none;');
        if (dotC)
            dotC.setAttribute('style', 'display: none;');
        if (tooltip)
            tooltip.classList.add('hidden');
    });
}
// Chart hover callback logic
function setupChartHover(containerId, svgWidth, paddingLeft, stepX, onMove, onLeave) {
    const container = $(containerId);
    if (!container)
        return;
    container.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        // Convert coordinate based on aspect ratio scaling of SVG
        const svgRelativeX = (cursorX / rect.width) * svgWidth;
        // Map to historical array index
        const dataX = svgRelativeX - paddingLeft;
        let index = Math.round(dataX / stepX);
        if (index >= 0 && index < historicalData.length) {
            onMove(index, cursorX);
        }
        else {
            onLeave();
        }
    });
    container.addEventListener('mouseleave', () => {
        onLeave();
    });
}
// ==========================================
// 5. Async CI/CD Release Engine State Machine
// ==========================================
const BUILD_LOGS = {
    0: [
        'Initializing release container target: [targetEnv]',
        'Pulling base image node:20-alpine from cache registry (SHA:f410ea8)...',
        'Caching directory structure mapped safely.',
        'Executing: npm run lint',
        'Checking 14 active TypeScript declarations...',
        'Analyzing static syntax rules inside App, types, configs...',
        'Lint pass! Clean compile checks reported 0 warnings, 0 syntax violations.'
    ],
    1: [
        'Triggering testing suites... Jest version 29.5.1',
        'Starting 4 synchronous suite parallel runs...',
        'PASS  src/test/auth.test.ts (184ms)',
        'PASS  src/test/caching.spec.ts (245ms)',
        'PASS  src/test/pipeline.test.ts (312ms)',
        'PASS  src/test/ingress-daemons.spec.ts (412ms)',
        'Test coverage: 94.2% statements covered, all suites executed successfully.'
    ],
    2: [
        'Running package execution bundle: vite build --mode production',
        'Vite bundling dynamic micro-services chunks...',
        'dist/index.html                     0.84 kB',
        'dist/assets/index-D84a2ea.js      42.50 kB │ gzip: 14.10 kB',
        'dist/assets/index-98fa7c2.css     18.22 kB │ gzip:  4.50 kB',
        'Vite optimization bundle build completed successfully (Took 1.1s).'
    ],
    3: [
        'Authenticating deployment tokens on Firebase Hosting CLI...',
        'Active aliases loaded from .firebaserc: [targetEnv]',
        'Uploading 4 binary assets chunks to region us-central1 edge storage...',
        'Firebase hosting dynamic route rewrites mapped safely: index.html routing for **.',
        'Deployment successful! Hosted url: https://[targetEnv].web.app'
    ]
};
function runPipeline() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        if (isPipelineRunning)
            return;
        isPipelineRunning = true;
        // Toggle buttons
        const triggerBtn = $('trigger-build-btn');
        const resetBtn = $('reset-build-btn');
        if (triggerBtn) {
            triggerBtn.disabled = true;
            triggerBtn.innerHTML = `
      <span class="w-3.5 h-3.5 border-2 border-zinc-100 border-t-transparent rounded-full inline-block animate-spin mr-2"></span>
      Running...
    `;
        }
        if (resetBtn)
            resetBtn.classList.add('hidden');
        // Reset steps & clear UI
        pipelineSteps.forEach((step, idx) => {
            step.status = 'pending';
            step.error = undefined;
            step.duration = undefined;
            updatePipelineStepUI(idx);
        });
        const consoleArea = $('pipeline-console-area');
        if (consoleArea) {
            consoleArea.innerHTML = '';
            consoleArea.classList.remove('text-rose-500');
        }
        // Get simulated failure flags
        const shouldFail = ((_a = $('inject-build-fail-checkbox')) === null || _a === void 0 ? void 0 : _a.checked) || false;
        const failAtIdx = parseInt(((_b = $('fail-step-selector')) === null || _b === void 0 ? void 0 : _b.value) || '0', 10);
        addPipelineConsoleLog('----------------------------------------------------', 'INFO');
        addPipelineConsoleLog(`STARTING RELEASE DEPLOYMENT ON CONFIG TARGET: ${pipelineTargetEnv.toUpperCase()}`, 'SUCCESS');
        addPipelineConsoleLog(`Triggered by goitsek23@gmail.com • Telemetry Ingress Active`, 'INFO');
        addPipelineConsoleLog('----------------------------------------------------', 'INFO');
        for (let i = 0; i < pipelineSteps.length; i++) {
            pipelineActiveStepIndex = i;
            pipelineSteps[i].status = 'running';
            updatePipelineStepUI(i);
            addPipelineConsoleLog(`\n[Stage ${i + 1}/${pipelineSteps.length}] Starting: ${pipelineSteps[i].name}...`, 'INFO');
            const duration = parseFloat((Math.random() * 0.8 + 0.6).toFixed(2));
            pipelineSteps[i].duration = duration;
            // Simulate logs in steps
            const stepLogs = BUILD_LOGS[i] || [];
            for (const logTemplate of stepLogs) {
                yield sleep(180);
                const formattedLog = logTemplate
                    .replace(/\[targetEnv\]/g, pipelineTargetEnv)
                    .replace(/\[duration\]/g, `${duration}s`);
                addPipelineConsoleLog(`  > ${formattedLog}`, 'INFO');
            }
            yield sleep(400);
            // Fail step logic
            if (shouldFail && i === failAtIdx) {
                pipelineSteps[i].status = 'failed';
                pipelineSteps[i].error = 'Static compilation core crash! Ingress exception raised.';
                updatePipelineStepUI(i);
                addPipelineConsoleLog(`\n[FATAL ERROR] Stage: ${pipelineSteps[i].name} failed to compile!`, 'ERROR');
                addPipelineConsoleLog(`Diagnostic output logs: ${pipelineSteps[i].error}`, 'ERROR');
                addPipelineConsoleLog(`RELEASE TERMINATED ABRUPTLY. Stack trace logged inside sandbox daemon.`, 'ERROR');
                // Create an Active incident on current service
                addIncident('edge-cdn', 'critical', `CI/CD Deployment failed on stage: "${pipelineSteps[i].name}". Environment targeting: ${pipelineTargetEnv}.`);
                isPipelineRunning = false;
                if (triggerBtn) {
                    triggerBtn.disabled = false;
                    triggerBtn.innerHTML = `
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
            <path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          </svg>
          <span>Trigger Build</span>
        `;
                }
                if (resetBtn)
                    resetBtn.classList.remove('hidden');
                return;
            }
            // Pass step
            pipelineSteps[i].status = 'success';
            updatePipelineStepUI(i);
            addPipelineConsoleLog(`[Stage ${i + 1}/${pipelineSteps.length}] PASS: ${pipelineSteps[i].name} finished cleanly. (Took ${duration}s)`, 'SUCCESS');
        }
        // Entire pipeline succeeded!
        addPipelineConsoleLog('\n----------------------------------------------------', 'SUCCESS');
        addPipelineConsoleLog(`RELEASE PROCESS COMPLETED SUCCESSFULLY ON ${pipelineTargetEnv.toUpperCase()}!`, 'SUCCESS');
        addPipelineConsoleLog(`Endpoints online: https://${pipelineTargetEnv}.web.app • Cache Hit rate refreshed.`, 'SUCCESS');
        addPipelineConsoleLog('----------------------------------------------------', 'SUCCESS');
        isPipelineRunning = false;
        if (triggerBtn) {
            triggerBtn.disabled = false;
            triggerBtn.innerHTML = `
      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
        <path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      </svg>
      <span>Trigger Build</span>
    `;
        }
        if (resetBtn)
            resetBtn.classList.remove('hidden');
        // Slightly boost metric hit rate as award!
        addSystemLog('SUCCESS', 'edge-cdn', `DevOps pipeline published build targeting ${pipelineTargetEnv} successfully in staging alias.`);
    });
}
function updatePipelineStepUI(idx) {
    const step = pipelineSteps[idx];
    const stepCard = $(`step-${idx}`);
    const stepIcon = $(`step-icon-${idx}`);
    const stepDur = $(`step-dur-${idx}`);
    const stepErr = $(`step-err-${idx}`);
    if (!stepCard || !stepIcon)
        return;
    // reset classes
    stepCard.className = 'p-4 rounded-xl border flex items-center justify-between transition-all duration-300 ';
    stepIcon.className = 'p-2 rounded-lg ';
    if (step.status === 'pending') {
        stepCard.classList.add('border-zinc-800', 'bg-zinc-950/40');
        stepIcon.classList.add('bg-zinc-900', 'text-zinc-500');
        if (stepDur)
            stepDur.classList.add('hidden');
        if (stepErr)
            stepErr.classList.add('hidden');
    }
    else if (step.status === 'running') {
        stepCard.classList.add('border-indigo-500/55', 'bg-indigo-950/10', 'shadow-[0_0_15px_rgba(99,102,241,0.1)]');
        stepIcon.classList.add('bg-indigo-900/30', 'text-indigo-400');
        if (stepDur) {
            stepDur.classList.remove('hidden');
            stepDur.textContent = 'Executing...';
        }
        if (stepErr)
            stepErr.classList.add('hidden');
    }
    else if (step.status === 'success') {
        stepCard.classList.add('border-emerald-500/40', 'bg-emerald-950/10');
        stepIcon.classList.add('bg-emerald-950/40', 'text-emerald-400');
        if (stepDur) {
            stepDur.classList.remove('hidden');
            stepDur.textContent = `Took ${step.duration}s`;
        }
        if (stepErr)
            stepErr.classList.add('hidden');
    }
    else if (step.status === 'failed') {
        stepCard.classList.add('border-rose-500/50', 'bg-rose-950/10');
        stepIcon.classList.add('bg-rose-950/40', 'text-rose-400');
        if (stepDur)
            stepDur.classList.add('hidden');
        if (stepErr) {
            stepErr.classList.remove('hidden');
            stepErr.textContent = step.error || 'Compile Error';
        }
    }
}
function addPipelineConsoleLog(line, level) {
    const consoleArea = $('pipeline-console-area');
    if (!consoleArea)
        return;
    const row = document.createElement('div');
    const now = new Date().toLocaleTimeString([], { hour12: false });
    row.className = 'leading-relaxed select-text';
    let colorClass = 'text-zinc-300';
    if (level === 'ERROR')
        colorClass = 'text-rose-400 font-bold';
    if (level === 'SUCCESS')
        colorClass = 'text-emerald-400 font-medium';
    row.innerHTML = `<span class="text-zinc-600 mr-2 select-none">${now}</span><span class="${colorClass}">${line}</span>`;
    consoleArea.appendChild(row);
    consoleArea.scrollTop = consoleArea.scrollHeight; // Auto-scroll
}
function resetPipeline() {
    pipelineSteps.forEach((step, idx) => {
        step.status = 'pending';
        step.error = undefined;
        step.duration = undefined;
        updatePipelineStepUI(idx);
    });
    const consoleArea = $('pipeline-console-area');
    if (consoleArea) {
        consoleArea.innerHTML = '<div class="text-zinc-600 text-center py-8">CI/CD agent standby. Telemetry logs will print on build trigger.</div>';
    }
    const resetBtn = $('reset-build-btn');
    if (resetBtn)
        resetBtn.classList.add('hidden');
}
// ==========================================
// 6. Interactive Event Listener Bindings
// ==========================================
function initEventListeners() {
    var _a, _b;
    // 1. Force Sync Button
    const forceSyncBtn = $('force-sync-btn');
    forceSyncBtn === null || forceSyncBtn === void 0 ? void 0 : forceSyncBtn.addEventListener('click', () => {
        const icon = forceSyncBtn.querySelector('svg');
        if (icon) {
            icon.classList.add('animate-spin');
            setTimeout(() => icon.classList.remove('animate-spin'), 1000);
        }
        // Simulate slight metrics improvement
        updateMetricsAndUI();
        addSystemLog('SUCCESS', 'production-api', 'Aggregate connection synchronization and dynamic cache purge successfully verified across 18 regional cluster node edge channels.');
        renderIncidents();
        renderCharts();
    });
    // 2. Stream Feed Toggle
    const toggleStreamBtn = $('toggle-stream-btn');
    toggleStreamBtn === null || toggleStreamBtn === void 0 ? void 0 : toggleStreamBtn.addEventListener('click', () => {
        isStreaming = !isStreaming;
        if (isStreaming) {
            toggleStreamBtn.className = 'px-3 py-1.5 rounded text-[11px] font-mono cursor-pointer transition-all bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold';
            toggleStreamBtn.textContent = 'ACTIVE FEED';
            addSystemLog('INFO', 'edge-cdn', 'Periodic ingress feed streams resumed.');
        }
        else {
            toggleStreamBtn.className = 'px-3 py-1.5 rounded text-[11px] font-mono cursor-pointer transition-all bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200';
            toggleStreamBtn.textContent = 'FEED PAUSED';
            addSystemLog('WARN', 'edge-cdn', 'Periodic telemetry monitoring feed temporarily paused by dashboard coordinator.');
        }
    });
    // 3. Spike Traffic Toggle
    const toggleSpikeBtn = $('toggle-spike-btn');
    toggleSpikeBtn === null || toggleSpikeBtn === void 0 ? void 0 : toggleSpikeBtn.addEventListener('click', () => {
        isTrafficSpike = !isTrafficSpike;
        const spikeIcon = $('spike-icon');
        if (isTrafficSpike) {
            toggleSpikeBtn.className = 'px-3 py-1.5 rounded text-[11px] font-mono cursor-pointer transition-all bg-rose-500/15 border border-rose-500/40 text-rose-400 font-semibold';
            toggleSpikeBtn.textContent = 'SPIKE ACTIVE';
            if (spikeIcon)
                spikeIcon.classList.add('text-rose-500');
            addSystemLog('WARN', 'production-api', 'Ingress simulation alert: Incoming user request spike forced load tests (1.8x baseline volume).');
            addIncident('production-api', 'warning', 'API Load Spike alert. Core request volumes exceeding average limits.');
        }
        else {
            toggleSpikeBtn.className = 'px-3 py-1.5 rounded text-[11px] font-mono cursor-pointer transition-all bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200';
            toggleSpikeBtn.textContent = 'TRIGGER';
            if (spikeIcon)
                spikeIcon.classList.remove('text-rose-500');
            addSystemLog('INFO', 'production-api', 'Ingress request load returned to baseline volume profiles.');
        }
        updateMetricsAndUI();
    });
    // 4. Degrade CDN Cache Toggle
    const toggleDegradeBtn = $('toggle-degrade-btn');
    toggleDegradeBtn === null || toggleDegradeBtn === void 0 ? void 0 : toggleDegradeBtn.addEventListener('click', () => {
        isCdnDegraded = !isCdnDegraded;
        const degradeIcon = $('degrade-icon');
        if (isCdnDegraded) {
            toggleDegradeBtn.className = 'px-3 py-1.5 rounded text-[11px] font-mono cursor-pointer transition-all bg-amber-500/15 border border-amber-500/40 text-amber-400 font-semibold';
            toggleDegradeBtn.textContent = 'DEGRADED';
            if (degradeIcon)
                degradeIcon.classList.add('text-amber-500');
            addSystemLog('WARN', 'edge-cdn', 'Forced CDN cache hit degradation activated. Intermittent backend misses triggered.');
            addIncident('edge-cdn', 'warning', 'Regional cache bypass threshold exceeded. Hit rates drop below 65%.');
        }
        else {
            toggleDegradeBtn.className = 'px-3 py-1.5 rounded text-[11px] font-mono cursor-pointer transition-all bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200';
            toggleDegradeBtn.textContent = 'DEGRADE';
            if (degradeIcon)
                degradeIcon.classList.remove('text-amber-500');
            addSystemLog('INFO', 'edge-cdn', 'Edge routing paths restored. Warm caching index successfully synchronized.');
        }
        updateMetricsAndUI();
    });
    // 5. Slider for Alert Threshold
    const slider = $('cpu-threshold-slider');
    slider === null || slider === void 0 ? void 0 : slider.addEventListener('input', () => {
        cpuAlertThreshold = parseInt(slider.value, 10);
        const label = $('cpu-threshold-label');
        if (label)
            label.textContent = `${cpuAlertThreshold}%`;
    });
    // 6. Inject simulated Incident
    const injectBtn = $('inject-anomaly-btn');
    injectBtn === null || injectBtn === void 0 ? void 0 : injectBtn.addEventListener('click', () => {
        const selector = $('anomaly-selector');
        if (!selector)
            return;
        const svc = selector.value;
        const msgs = {
            'database-replica': 'Postgres replica write transaction buffers filled. Disk replication bottleneck detected.',
            'production-api': 'SSL Gateway handshake timeout. Incoming requests queuing up.',
            'edge-cdn': 'Edge distribution router reporting packet drops during geographic load-balancing.'
        };
        addIncident(svc, 'warning', msgs[svc] || 'Unexpected cluster exception trace reported by ingress node.');
        addSystemLog('ERROR', svc, `ALERT: ${msgs[svc]}`);
    });
    // 7. Collapse drawer configurations
    const toggleConfigBtn = $('toggle-config-btn');
    const configContentArea = $('config-content-area');
    const configChevron = $('config-chevron');
    toggleConfigBtn === null || toggleConfigBtn === void 0 ? void 0 : toggleConfigBtn.addEventListener('click', () => {
        configContentArea === null || configContentArea === void 0 ? void 0 : configContentArea.classList.toggle('hidden');
        configChevron === null || configChevron === void 0 ? void 0 : configChevron.classList.toggle('rotate-180');
    });
    // 8. Target environment buttons
    const devBtn = $('target-dev-btn');
    const prodBtn = $('target-prod-btn');
    devBtn === null || devBtn === void 0 ? void 0 : devBtn.addEventListener('click', () => {
        pipelineTargetEnv = 'dev-env';
        devBtn.className = 'px-3 py-1.5 rounded-md font-mono transition-all duration-200 bg-zinc-800 text-indigo-400 font-semibold cursor-pointer';
        prodBtn.className = 'px-3 py-1.5 rounded-md font-mono transition-all duration-200 text-zinc-400 hover:text-zinc-200 cursor-pointer';
        addSystemLog('INFO', 'edge-cdn', 'Release target environment mapping toggled to: dev-env (Staging host).');
    });
    prodBtn === null || prodBtn === void 0 ? void 0 : prodBtn.addEventListener('click', () => {
        pipelineTargetEnv = 'prod-env';
        prodBtn.className = 'px-3 py-1.5 rounded-md font-mono transition-all duration-200 bg-zinc-800 text-indigo-400 font-semibold cursor-pointer';
        devBtn.className = 'px-3 py-1.5 rounded-md font-mono transition-all duration-200 text-zinc-400 hover:text-zinc-200 cursor-pointer';
        addSystemLog('INFO', 'edge-cdn', 'Release target environment mapping toggled to: prod-env (Production core hosting).');
    });
    // 9. Trigger CI/CD Build pipeline
    (_a = $('trigger-build-btn')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => {
        runPipeline();
    });
    // 10. Reset Pipeline Build
    (_b = $('reset-build-btn')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', () => {
        resetPipeline();
    });
    // 11. Fail checkbox conditional dropdown
    const failCheckbox = $('inject-build-fail-checkbox');
    const failStepSelector = $('fail-step-selector');
    failCheckbox === null || failCheckbox === void 0 ? void 0 : failCheckbox.addEventListener('change', () => {
        if (failCheckbox.checked) {
            failStepSelector === null || failStepSelector === void 0 ? void 0 : failStepSelector.classList.remove('hidden');
        }
        else {
            failStepSelector === null || failStepSelector === void 0 ? void 0 : failStepSelector.classList.add('hidden');
        }
    });
    // 12. Streaming log controls
    const logsSearchInput = $('logs-search-input');
    logsSearchInput === null || logsSearchInput === void 0 ? void 0 : logsSearchInput.addEventListener('input', () => {
        renderLogs();
    });
    const logsLevelSelector = $('logs-level-selector');
    logsLevelSelector === null || logsLevelSelector === void 0 ? void 0 : logsLevelSelector.addEventListener('change', () => {
        renderLogs();
    });
    const logsServiceSelector = $('logs-service-selector');
    logsServiceSelector === null || logsServiceSelector === void 0 ? void 0 : logsServiceSelector.addEventListener('change', () => {
        renderLogs();
    });
    const clearLogsBtn = $('clear-logs-btn');
    clearLogsBtn === null || clearLogsBtn === void 0 ? void 0 : clearLogsBtn.addEventListener('click', () => {
        logs = [];
        renderLogs();
    });
    const toggleLogStreamBtn = $('toggle-log-stream-btn');
    let isLogPaused = false;
    toggleLogStreamBtn === null || toggleLogStreamBtn === void 0 ? void 0 : toggleLogStreamBtn.addEventListener('click', () => {
        isLogPaused = !isLogPaused;
        const playDot = $('log-play-dot');
        const playLabel = $('log-play-label');
        if (isLogPaused) {
            toggleLogStreamBtn.className = 'p-1.5 bg-zinc-900 hover:bg-zinc-850 rounded-lg border border-zinc-800 text-[11px] font-mono flex items-center gap-1.5 cursor-pointer text-zinc-400 transition-colors';
            if (playDot) {
                playDot.className = 'w-2 h-2 rounded-full bg-zinc-500 inline-block';
                playDot.classList.remove('animate-pulse');
            }
            if (playLabel)
                playLabel.textContent = 'PAUSED';
        }
        else {
            toggleLogStreamBtn.className = 'p-1.5 rounded-lg border text-[11px] font-mono flex items-center gap-1.5 cursor-pointer transition-all bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
            if (playDot) {
                playDot.className = 'w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse';
            }
            if (playLabel)
                playLabel.textContent = 'LIVE';
        }
    });
}
// ==========================================
// 7. Telemetry Loop Aggregate Generator
// ==========================================
function startTelemetryLoop() {
    setInterval(() => {
        if (!isStreaming)
            return;
        // 1. Update Metrics
        updateMetricsAndUI();
        // 2. Add dynamic point to historical line data
        const baseline = getServiceBaselines(selectedService);
        const lastPt = historicalData[historicalData.length - 1];
        // Smooth random walk with boundary enforcement
        const noise = (Math.random() - 0.5) * 4;
        let trafficMultiplier = isTrafficSpike ? 1.8 : 1.0;
        let cpuAdd = isTrafficSpike ? 28.5 : 0;
        let memAdd = isTrafficSpike ? 12.1 : 0;
        let cacheMultiplier = isCdnDegraded ? 0.65 : 1.0;
        const nextCpu = Math.min(99.5, Math.max(5, (baseline.cpu + cpuAdd) + noise));
        const nextMem = Math.min(99.0, Math.max(10, (baseline.memory + memAdd) + (Math.random() - 0.5) * 2));
        let nextReq = Math.round(baseline.reqRate * trafficMultiplier + (Math.random() - 0.5) * 60);
        if (nextReq < 0)
            nextReq = 0;
        let nextCdn = baseline.cdnRate;
        if (nextCdn > 0) {
            nextCdn = Math.min(99.9, Math.max(40.0, (baseline.cdnRate * cacheMultiplier) + (Math.random() - 0.5) * 1.5));
        }
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        historicalData.push({
            timestamp,
            cpu: parseFloat(nextCpu.toFixed(1)),
            memory: parseFloat(nextMem.toFixed(1)),
            cdnHitRate: parseFloat(nextCdn.toFixed(1)),
            requests: nextReq,
            networkIn: parseFloat((baseline.netIn * trafficMultiplier + (Math.random() - 0.5) * 8).toFixed(1)),
            networkOut: parseFloat((baseline.netOut * trafficMultiplier + (Math.random() - 0.5) * 22).toFixed(1))
        });
        if (historicalData.length > 15) {
            historicalData.shift(); // keep sliding window of 15
        }
        // 3. Render charts
        renderResourceChart();
        renderTrafficChart();
        // 4. Inject occasional dynamic logs if logs play button is active (not paused)
        const playLabel = $('log-play-label');
        if (playLabel && playLabel.textContent === 'LIVE') {
            const odds = Math.random();
            if (odds < 0.6) {
                const levels = ['INFO', 'INFO', 'SUCCESS', 'INFO'];
                const level = levels[Math.floor(Math.random() * levels.length)];
                const service = SERVICES[Math.floor(Math.random() * (SERVICES.length - 1)) + 1];
                const msgList = MOCK_MESSAGES[level];
                const message = msgList[Math.floor(Math.random() * msgList.length)];
                addSystemLog(level, service, message);
            }
        }
    }, 3000);
}
// Utility promise wrapper
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// ==========================================
// 8. Bootstrap initialization
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    renderServiceSelectors();
    updateMetricsAndUI();
    renderIncidents();
    renderLogs();
    renderCharts();
    initEventListeners();
    startTelemetryLoop();
});
