(() => {
  const params = new URLSearchParams(location.search);
  const displayId = params.get('id') || '1';
  const videoSrc = `videos/video-${displayId}.mp4`;

  const video = document.getElementById('video');
  const status = document.getElementById('status');
  const overlay = document.getElementById('start-overlay');

  video.src = videoSrc;
  video.load();

  let audioUnlocked = false;
  let isPlaying = false;
  let fadeOutTimer = null;

  // --- Unlock audio on first tap (exhibition setup) ---
  overlay.addEventListener('click', () => {
    video.muted = false;
    video.play().then(() => {
      video.pause();
      video.currentTime = 0;
      audioUnlocked = true;
      overlay.classList.add('hidden');
      console.log(`[sub-${displayId}] Audio unlocked`);
    }).catch((e) => {
      console.warn(`[sub-${displayId}] Unlock failed:`, e);
    });
  });

  function onState(state) {
    if (!audioUnlocked) return;

    if (state.isLightOn && !isPlaying) {
      isPlaying = true;
      if (fadeOutTimer) { clearTimeout(fadeOutTimer); fadeOutTimer = null; }
      video.play().catch(() => {});
      video.classList.add('active');
    }
    else if (!state.isLightOn && isPlaying) {
      isPlaying = false;
      video.classList.remove('active');
      fadeOutTimer = setTimeout(() => {
        video.pause();
        fadeOutTimer = null;
      }, 800);
    }
  }

  // --- WebSocket ---
  const wsUrl = `ws://${location.hostname}:3001`;
  let ws = null;

  function connect() {
    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        status.classList.add('connected');
        ws.send(JSON.stringify({ type: 'register', role: 'sub', id: displayId }));
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'state') onState(msg);
        } catch (e) {}
      };
      ws.onclose = () => {
        status.classList.remove('connected');
        setTimeout(connect, 2000);
      };
      ws.onerror = () => ws.close();
    } catch (e) { setTimeout(connect, 2000); }
  }

  connect();

  // Prevent screen sleep
  if (navigator.wakeLock) {
    navigator.wakeLock.request('screen').catch(() => {});
  }
})();