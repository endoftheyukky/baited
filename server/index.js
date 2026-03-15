const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const path = require('path');

const HTTP_PORT = 3000;
const WS_PORT = 3001;

const app = express();
app.use('/',      express.static(path.join(__dirname, '..', 'main')));
app.use('/sub',   express.static(path.join(__dirname, '..', 'sub-display')));
app.use('/sound', express.static(path.join(__dirname, '..', 'sound')));

app.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log('');
  console.log('=== baited server ===');
  console.log(`  Main:   http://localhost:${HTTP_PORT}`);
  console.log(`  Sub:    http://localhost:${HTTP_PORT}/sub?id=1`);
  console.log(`  Sound:  http://localhost:${HTTP_PORT}/sound`);
  console.log(`  WS:     ws://localhost:${WS_PORT}`);
  console.log('');
});

const wss = new WebSocketServer({ port: WS_PORT });
const clients = new Map();
let currentState = { type: 'state', isLightOn: false, x: 0, y: 0, timestamp: Date.now() };

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  clients.set(ws, { role: 'unknown', ip });
  console.log(`[+] ${ip}`);
  ws.send(JSON.stringify(currentState));

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'register') {
        clients.set(ws, { role: msg.role, ip });
        console.log(`[*] ${msg.role} (${ip})`);
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

  ws.on('close', () => { const i = clients.get(ws); clients.delete(ws); console.log(`[-] ${i?.role} (${ip})`); });
});

setInterval(() => {
  wss.clients.forEach((c) => { if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify({ type: 'ping' })); });
}, 30000);
