const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const path = require('path');
const fs = require('fs');

const HTTP_PORT = 3000;
const WS_PORT = 3001;
const LOG_DIR = path.join(__dirname, '..', 'logs');

// --- Ensure log directory exists ---
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

// --- Logger ---
const logger = (() => {
  let currentSession = null;
  let sessionCount = 0;

  function getLogFile() {
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return path.join(LOG_DIR, `${date}.jsonl`);
  }

  function write(entry) {
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(getLogFile(), line);
  }

  function onLightOn(x, y) {
    if (currentSession) return; // already on
    sessionCount++;
    currentSession = {
      id: sessionCount,
      onAt: Date.now(),
      onTime: new Date().toISOString(),
      startX: x,
      startY: y,
    };
    console.log(`[LOG] Session #${sessionCount} started`);
  }

  function onLightOff(x, y) {
    if (!currentSession) return; // already off
    const duration = (Date.now() - currentSession.onAt) / 1000;
    const entry = {
      type: 'session',
      id: currentSession.id,
      onTime: currentSession.onTime,
      offTime: new Date().toISOString(),
      duration: Math.round(duration * 10) / 10,
      startX: currentSession.startX,
      startY: currentSession.startY,
      endX: x,
      endY: y,
    };
    write(entry);
    console.log(`[LOG] Session #${currentSession.id} ended (${entry.duration}s)`);
    currentSession = null;
  }

  function getStats() {
    const file = getLogFile();
    if (!fs.existsSync(file)) return { today: 0, sessions: [] };

    const lines = fs.readFileSync(file, 'utf-8').trim().split('\n').filter(Boolean);
    const sessions = lines.map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);

    const durations = sessions.map(s => s.duration);
    const gaps = [];
    for (let i = 1; i < sessions.length; i++) {
      const gap = (new Date(sessions[i].onTime) - new Date(sessions[i - 1].offTime)) / 1000;
      gaps.push(Math.round(gap * 10) / 10);
    }

    // Hourly breakdown
    const hourly = {};
    sessions.forEach(s => {
      const h = new Date(s.onTime).getHours();
      if (!hourly[h]) hourly[h] = { count: 0, totalDuration: 0 };
      hourly[h].count++;
      hourly[h].totalDuration += s.duration;
    });

    return {
      today: sessions.length,
      totalDuration: Math.round(durations.reduce((a, b) => a + b, 0) * 10) / 10,
      avgDuration: sessions.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / sessions.length * 10) / 10 : 0,
      minDuration: sessions.length > 0 ? Math.min(...durations) : 0,
      maxDuration: sessions.length > 0 ? Math.max(...durations) : 0,
      avgGap: gaps.length > 0 ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length * 10) / 10 : 0,
      hourly,
      sessions,
      isActive: currentSession !== null,
      currentSessionDuration: currentSession ? Math.round((Date.now() - currentSession.onAt) / 1000) : 0,
    };
  }

  function getAllDays() {
    if (!fs.existsSync(LOG_DIR)) return [];
    return fs.readdirSync(LOG_DIR)
      .filter(f => f.endsWith('.jsonl'))
      .sort()
      .map(f => f.replace('.jsonl', ''));
  }

  function getStatsForDate(date) {
    const file = path.join(LOG_DIR, `${date}.jsonl`);
    if (!fs.existsSync(file)) return null;

    const lines = fs.readFileSync(file, 'utf-8').trim().split('\n').filter(Boolean);
    const sessions = lines.map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
    const durations = sessions.map(s => s.duration);

    return {
      date,
      count: sessions.length,
      totalDuration: Math.round(durations.reduce((a, b) => a + b, 0) * 10) / 10,
      avgDuration: sessions.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / sessions.length * 10) / 10 : 0,
      minDuration: sessions.length > 0 ? Math.min(...durations) : 0,
      maxDuration: sessions.length > 0 ? Math.max(...durations) : 0,
    };
  }

  return { onLightOn, onLightOff, getStats, getAllDays, getStatsForDate };
})();

// --- HTTP ---
const app = express();
app.use('/',    express.static(path.join(__dirname, '..', 'main')));
app.use('/sub', express.static(path.join(__dirname, '..', 'sub-display')));

// Status page (connection monitor)
app.get('/status', (req, res) => {
  const now = Date.now();
  const list = [];
  clients.forEach((info) => {
    list.push({ role: info.role, id: info.id || null, ip: info.ip, connectedSec: Math.floor((now - info.connectedAt) / 1000) });
  });
  const order = { main: 0, sub: 1 };
  list.sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9));

  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width">
    <meta http-equiv="refresh" content="5"><title>baited — status</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{background:#141618;color:#aaa;font-family:-apple-system,sans-serif;font-size:14px;padding:20px}
    h1{font-size:16px;color:#666;font-weight:normal;margin-bottom:16px}
    .card{background:#1e2024;border-radius:8px;padding:14px 16px;margin-bottom:8px;display:flex;align-items:center;gap:12px}
    .dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;background:#2d2}
    .role{color:#ddd;font-weight:600;min-width:60px}.detail{color:#666;font-size:12px}.time{color:#555;font-size:12px;margin-left:auto}
    .empty{color:#444;text-align:center;padding:40px}.summary{color:#555;font-size:12px;margin-top:12px;text-align:center}
    </style></head><body><h1>baited — status</h1>
    ${list.length === 0 ? '<div class="empty">No clients connected</div>' : list.map(c => `
      <div class="card"><div class="dot"></div><div class="role">${c.role}${c.id ? ' ' + c.id : ''}</div>
      <div class="detail">${c.ip}</div><div class="time">${fmt(c.connectedSec)}</div></div>`).join('')}
    <div class="summary">${list.length} connected — auto-refresh 5s</div></body></html>`);
});

// Analytics page
app.get('/analytics', (req, res) => {
  const date = req.query.date;
  const days = logger.getAllDays();

  if (date) {
    const stats = logger.getStatsForDate(date);
    if (!stats) return res.send('No data for ' + date);

    const file = path.join(LOG_DIR, `${date}.jsonl`);
    const lines = fs.readFileSync(file, 'utf-8').trim().split('\n').filter(Boolean);
    const sessions = lines.map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);

    // Hourly breakdown
    const hourly = {};
    sessions.forEach(s => {
      const h = new Date(s.onTime).getHours();
      if (!hourly[h]) hourly[h] = { count: 0, totalDur: 0 };
      hourly[h].count++;
      hourly[h].totalDur += s.duration;
    });

    // Duration histogram
    const buckets = { '0-5s': 0, '5-15s': 0, '15-30s': 0, '30-60s': 0, '60s+': 0 };
    sessions.forEach(s => {
      if (s.duration < 5) buckets['0-5s']++;
      else if (s.duration < 15) buckets['5-15s']++;
      else if (s.duration < 30) buckets['15-30s']++;
      else if (s.duration < 60) buckets['30-60s']++;
      else buckets['60s+']++;
    });

    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width">
      <title>baited — analytics ${date}</title>
      <style>*{margin:0;padding:0;box-sizing:border-box}body{background:#141618;color:#aaa;font-family:-apple-system,sans-serif;font-size:14px;padding:20px;max-width:600px;margin:0 auto}
      h1{font-size:16px;color:#666;font-weight:normal;margin-bottom:16px}h2{font-size:13px;color:#555;margin:20px 0 8px}
      .stat{background:#1e2024;border-radius:8px;padding:14px 16px;margin-bottom:6px;display:flex;justify-content:space-between}
      .stat .label{color:#888}.stat .value{color:#ddd;font-weight:600}
      .bar-row{display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:12px}
      .bar-label{width:50px;text-align:right;color:#666}.bar{height:18px;background:#2a4a2a;border-radius:3px;min-width:2px}
      .bar-val{color:#555;font-size:11px}
      a{color:#668;text-decoration:none}a:hover{color:#99b}
      .session-list{font-size:11px;color:#555;margin-top:12px;line-height:1.8}
      .nav{margin-bottom:16px}
      </style></head><body>
      <div class="nav"><a href="/analytics">← all days</a></div>
      <h1>${date}</h1>
      <div class="stat"><span class="label">Sessions</span><span class="value">${stats.count}</span></div>
      <div class="stat"><span class="label">Total active time</span><span class="value">${fmtDur(stats.totalDuration)}</span></div>
      <div class="stat"><span class="label">Avg duration</span><span class="value">${stats.avgDuration}s</span></div>
      <div class="stat"><span class="label">Min / Max</span><span class="value">${stats.minDuration}s / ${stats.maxDuration}s</span></div>

      <h2>Duration distribution</h2>
      ${Object.entries(buckets).map(([k, v]) => {
        const pct = stats.count > 0 ? v / stats.count * 100 : 0;
        return `<div class="bar-row"><div class="bar-label">${k}</div><div class="bar" style="width:${Math.max(pct * 2, 2)}px"></div><div class="bar-val">${v} (${Math.round(pct)}%)</div></div>`;
      }).join('')}

      <h2>Hourly breakdown</h2>
      ${Array.from({length: 24}, (_, h) => {
        const d = hourly[h];
        if (!d) return '';
        const pct = stats.count > 0 ? d.count / stats.count * 100 : 0;
        return `<div class="bar-row"><div class="bar-label">${h}:00</div><div class="bar" style="width:${Math.max(pct * 2, 2)}px"></div><div class="bar-val">${d.count} sessions, avg ${Math.round(d.totalDur / d.count)}s</div></div>`;
      }).join('')}

      <h2>All sessions</h2>
      <div class="session-list">
      ${sessions.map(s => {
        const t = new Date(s.onTime).toTimeString().slice(0, 8);
        return `${t} — ${s.duration}s`;
      }).join('<br>')}
      </div>
      </body></html>`);
  } else {
    // Day list
    const summaries = days.map(d => logger.getStatsForDate(d)).filter(Boolean);
    const totalSessions = summaries.reduce((a, s) => a + s.count, 0);
    const totalDur = summaries.reduce((a, s) => a + s.totalDuration, 0);

    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width">
      <title>baited — analytics</title>
      <style>*{margin:0;padding:0;box-sizing:border-box}body{background:#141618;color:#aaa;font-family:-apple-system,sans-serif;font-size:14px;padding:20px;max-width:600px;margin:0 auto}
      h1{font-size:16px;color:#666;font-weight:normal;margin-bottom:16px}
      .stat{background:#1e2024;border-radius:8px;padding:14px 16px;margin-bottom:6px;display:flex;justify-content:space-between}
      .stat .label{color:#888}.stat .value{color:#ddd;font-weight:600}
      .day{background:#1e2024;border-radius:8px;padding:14px 16px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center}
      .day a{color:#ddd;text-decoration:none;font-weight:600}.day a:hover{color:#fff}
      .day .meta{color:#666;font-size:12px}
      .empty{color:#444;text-align:center;padding:40px}
      </style></head><body>
      <h1>baited — analytics</h1>
      <div class="stat"><span class="label">Total sessions (all days)</span><span class="value">${totalSessions}</span></div>
      <div class="stat"><span class="label">Total active time</span><span class="value">${fmtDur(totalDur)}</span></div>
      ${summaries.length === 0 ? '<div class="empty">No data yet</div>' : summaries.reverse().map(s => `
        <div class="day"><a href="/analytics?date=${s.date}">${s.date}</a><div class="meta">${s.count} sessions — avg ${s.avgDuration}s</div></div>
      `).join('')}
      </body></html>`);
  }
});

// Raw data download
app.get('/analytics/raw', (req, res) => {
  const date = req.query.date;
  if (!date) return res.status(400).send('?date=YYYY-MM-DD required');
  const file = path.join(LOG_DIR, `${date}.jsonl`);
  if (!fs.existsSync(file)) return res.status(404).send('No data');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=baited-${date}.jsonl`);
  res.sendFile(file);
});

function fmt(sec) {
  if (sec < 60) return sec + 's';
  if (sec < 3600) return Math.floor(sec / 60) + 'm ' + (sec % 60) + 's';
  return Math.floor(sec / 3600) + 'h ' + Math.floor((sec % 3600) / 60) + 'm';
}

function fmtDur(sec) {
  if (sec < 60) return sec + 's';
  if (sec < 3600) return Math.floor(sec / 60) + 'm ' + Math.round(sec % 60) + 's';
  return Math.floor(sec / 3600) + 'h ' + Math.floor((sec % 3600) / 60) + 'm';
}

app.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log('');
  console.log('=== baited server ===');
  console.log(`  Main:      http://localhost:${HTTP_PORT}`);
  console.log(`  Sub:       http://localhost:${HTTP_PORT}/sub?id=1`);
  console.log(`  Status:    http://localhost:${HTTP_PORT}/status`);
  console.log(`  Analytics: http://localhost:${HTTP_PORT}/analytics`);
  console.log(`  WS:        ws://localhost:${WS_PORT}`);
  console.log('');
});

// --- WebSocket ---
const wss = new WebSocketServer({ port: WS_PORT });
const clients = new Map();
let currentState = { type: 'state', isLightOn: false, x: 0, y: 0, timestamp: Date.now() };
let prevLightState = false;

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  clients.set(ws, { role: 'unknown', ip, connectedAt: Date.now() });
  console.log(`[+] ${ip}`);
  ws.send(JSON.stringify(currentState));

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'register') {
        const info = clients.get(ws);
        info.role = msg.role;
        if (msg.id) info.id = msg.id;
        console.log(`[*] ${msg.role}${msg.id ? ' ' + msg.id : ''} (${ip})`);
        return;
      }
      if (msg.type === 'state') {
        currentState = { type: 'state', isLightOn: msg.isLightOn, x: msg.x, y: msg.y, timestamp: Date.now() };

        // Log light state changes
        if (msg.isLightOn && !prevLightState) {
          logger.onLightOn(msg.x, msg.y);
        } else if (!msg.isLightOn && prevLightState) {
          logger.onLightOff(msg.x, msg.y);
        }
        prevLightState = msg.isLightOn;

        wss.clients.forEach((c) => {
          if (c !== ws && c.readyState === WebSocket.OPEN) c.send(JSON.stringify(currentState));
        });
      }
    } catch (e) {}
  });

  ws.on('close', () => {
    const i = clients.get(ws);
    clients.delete(ws);
    console.log(`[-] ${i?.role}${i?.id ? ' ' + i.id : ''} (${ip})`);
  });
});

setInterval(() => {
  wss.clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify({ type: 'ping' }));
  });
}, 30000);