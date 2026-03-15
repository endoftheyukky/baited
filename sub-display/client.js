// ============================================================
//  baited — sub-display client.js
//
//  Opens on iPad: http://<server-ip>:3000/sub?id=1
//  ?id=1 → video-1.mp4
//  ?id=2 → video-2.mp4
//  ?id=3 → video-3.mp4
//
//  isLightOn === true  → fade in video, start playback
//  isLightOn === false → fade out video, pause after fade
// ============================================================

(() => {
  const params = new URLSearchParams(location.search);
  const displayId = params.get('id') || '1';
  const videoSrc = `videos/video-${displayId}.mp4`;

  const video = document.getElementById('video');
  const status = document.getElementById('status');

  // Load video
  video.src = videoSrc;
  video.load();

  // Pre-buffer: play muted then pause immediately
  video.play().then(() => video.pause()).catch(() => {});

  let isPlaying = false;
  let fadeOutTimer = null;

  function onState(state) {
    if (state.isLightOn && !isPlaying) {
      // Light ON → play & fade in
      isPlaying = true;
      if (fadeOutTimer) { clearTimeout(fadeOutTimer); fadeOutTimer = null; }
      video.play().catch(() => {});
      video.classList.add('active');
    }
    else if (!state.isLightOn && isPlaying) {
      // Light OFF → fade out, then pause
      isPlaying = false;
      video.classList.remove('active');
      fadeOutTimer = setTimeout(() => {
        video.pause();
        fadeOutTimer = null;
      }, 800); // match CSS transition duration
    }
  }

  // --- WebSocket ---
  const wsUrl = `ws://${location.hostname}:3001`;
  let ws = null;
  let connected = false;

  function connect() {
    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        connected = true;
        status.classList.add('connected');
        ws.send(JSON.stringify({ type: 'register', role: 'sub', id: displayId }));
        console.log(`[sub-${displayId}] Connected`);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'state') onState(msg);
        } catch (e) {}
      };

      ws.onclose = () => {
        connected = false;
        status.classList.remove('connected');
        console.log(`[sub-${displayId}] Disconnected, reconnecting...`);
        setTimeout(connect, 2000);
      };

      ws.onerror = () => ws.close();

    } catch (e) {
      setTimeout(connect, 2000);
    }
  }

  connect();

  // Prevent screen sleep on iPad
  function keepAwake() {
    if (navigator.wakeLock) {
      navigator.wakeLock.request('screen').catch(() => {});
    }
  }
  document.addEventListener('click', keepAwake);
  keepAwake();

  // Touch to unlock video autoplay on iOS
  document.addEventListener('touchstart', () => {
    video.play().then(() => {
      if (!isPlaying) video.pause();
    }).catch(() => {});
  }, { once: true });

})();
