const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const path = require('path');

const HTTP_PORT = 3000;
const WS_PORT = 3001;

const app = express();
app.use('/',    express.static(path.join(__dirname, '..', 'main')));
app.use('/sub', express.static(path.join(__dirname, '..', 'sub-display')));

// --- Status endpoint (access from phone) ---
app.get('/status', (req, res) => {
  const now = Date.now();
  const list = [];

  clients.forEach((info) => {
    list.push({
      role: info.role,
      id: info.id || null,
      ip: info.ip,
      connectedSec: Math.floor((now - info.connectedAt) / 1000),
      alive: true,
    });
  });

  // Sort: main first, then sub by id, then others
  const order = { main: 0, sub: 1 };
  list.sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9) || (a.id || '').localeCompare(b.id || ''));

  res.send(`
    <!DOCTYPE html>
    <html><head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width">
      <meta http-equiv="refresh" content="5">
      <title>baited — status</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #141618; color: #aaa; font-family: -apple-system, sans-serif; font-size: 14px; padding: 20px; }
        h1 { font-size: 16px; color: #666; font-weight: normal; margin-bottom: 16px; }
        .card {
          background: #1e2024; border-radius: 8px; padding: 14px 16px;
          margin-bottom: 8px; display: flex; align-items: center; gap: 12px;
        }
        .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .dot.on { background: #2d2; }
        .role { color: #ddd; font-weight: 600; min-width: 60px; }
        .detail { color: #666; font-size: 12px; }
        .time { color: #555; font-size: 12px; margin-left: auto; }
        .summary { color: #555; font-size: 12px; margin-top: 12px; text-align: center; }
        .empty { color: #444; text-align: center; padding: 40px; }
      </style>
    </head><body>
      <h1>baited — status</h1>
      ${list.length === 0 ? '<div class="empty">No clients connected</div>' : list.map(c => `
        <div class="card">
          <div class="dot on"></div>
          <div class="role">${c.role}${c.id ? ' ' + c.id : ''}</div>
          <div class="detail">${c.ip}</div>
          <div class="time">${formatUptime(c.connectedSec)}</div>
        </div>
      `).join('')}
      <div class="summary">${list.length} connected — auto-refresh 5s</div>
    </body></html>
  `);
});

function formatUptime(sec) {
  if (sec < 60) return sec + 's';
  if (sec < 3600) return Math.floor(sec / 60) + 'm ' + (sec % 60) + 's';
  return Math.floor(sec / 3600) + 'h ' + Math.floor((sec % 3600) / 60) + 'm';
}

app.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log('');
  console.log('=== baited server ===');
  console.log(`  Main:    http://localhost:${HTTP_PORT}`);
  console.log(`  Sub:     http://localhost:${HTTP_PORT}/sub?id=1`);
  console.log(`  Status:  http://localhost:${HTTP_PORT}/status`);
  console.log(`  WS:      ws://localhost:${WS_PORT}`);
  console.log('');
});

// --- WebSocket ---
const wss = new WebSocketServer({ port: WS_PORT });
const clients = new Map();
let currentState = { type: 'state', isLightOn: false, x: 0, y: 0, timestamp: Date.now() };

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