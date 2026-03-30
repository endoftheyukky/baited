(() => {
  const params = new URLSearchParams(location.search);
  const displayId = params.get('id') || '1';
  const videoSrc = `videos/video-${displayId}.MOV`;

  const video = document.getElementById('video');
  const status = document.getElementById('status');

  video.src = videoSrc;
  video.load();
  video.play().then(() => video.pause()).catch(() => {});

  let isPlaying = false;
  let fadeOutTimer = null;

  function onState(state) {
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

  if (navigator.wakeLock) {
    navigator.wakeLock.request('screen').catch(() => {});
  }
})();