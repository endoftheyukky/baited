// connection.js — WebSocket to server (optional, fails silently)
const connection = (() => {
  let ws = null, connected = false, timer = null;
  const URL = `ws://${location.hostname || 'localhost'}:3001`;

  function connect() {
    try {
      ws = new WebSocket(URL);
      ws.onopen = () => {
        connected = true;
        ws.send(JSON.stringify({ type: 'register', role: 'main' }));
        if (timer) { clearInterval(timer); timer = null; }
      };
      ws.onclose = () => {
        connected = false;
        if (!timer) timer = setInterval(() => { if (!connected) connect(); }, 3000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = () => {};
    } catch (e) { connected = false; }
  }

  function send(state) {
    if (connected && ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'state', ...state }));
    }
  }

  connect();
  return { send, isConnected: () => connected };
})();
