const TRACKS = {
  bgm: {
    src: 'audio/ambient.mp3',
    fadeIn: 2.0,
    fadeOut: 2.5,
    maxVolume: 0.7,
    delay: 0,
  },
  se: {
    src: 'audio/bugs.mp3',
    fadeIn: 0.8,
    fadeOut: 1.5,
    maxVolume: 0.5,
    delay: 0.3,
  }
};

let audioCtx = null;
let tracks = {};
let isCurrentlyOn = false;

const indBgm = document.getElementById('ind-bgm');
const indSe = document.getElementById('ind-se');
const stateLabel = document.getElementById('state-label');
const startBtn = document.getElementById('start-btn');

async function initAudio() {
  startBtn.classList.add('hidden');
  stateLabel.textContent = 'loading audio...';

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  let loadedCount = 0;
  const trackNames = Object.keys(TRACKS);

  for (const name of trackNames) {
    const config = TRACKS[name];
    try {
      const response = await fetch(config.src);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await audioCtx.decodeAudioData(arrayBuffer);

      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 0;
      gainNode.connect(audioCtx.destination);

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gainNode);
      source.start(0);

      tracks[name] = { gain: gainNode, source, buffer, ready: true, config };
      loadedCount++;
      stateLabel.textContent = `loaded ${loadedCount}/${trackNames.length}...`;
    } catch (e) {
      console.warn(`[sound] Failed to load ${name}: ${e.message}`);
      tracks[name] = { ready: false, config };
    }
  }

  if (loadedCount === 0) {
    stateLabel.textContent = 'no audio files found — check audio/ folder';
    return;
  }
  stateLabel.textContent = `ready (${loadedCount} track${loadedCount > 1 ? 's' : ''})`;
}

function fadeIn(track) {
  if (!track.ready) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const now = audioCtx.currentTime;
  const start = now + track.config.delay;
  track.gain.gain.cancelScheduledValues(now);
  track.gain.gain.setValueAtTime(track.gain.gain.value, now);
  track.gain.gain.setValueAtTime(track.gain.gain.value, start);
  track.gain.gain.linearRampToValueAtTime(track.config.maxVolume, start + track.config.fadeIn);
}

function fadeOut(track) {
  if (!track.ready) return;
  const now = audioCtx.currentTime;
  track.gain.gain.cancelScheduledValues(now);
  track.gain.gain.setValueAtTime(track.gain.gain.value, now);
  track.gain.gain.linearRampToValueAtTime(0, now + track.config.fadeOut);
}

function lightOn() {
  if (isCurrentlyOn) return;
  isCurrentlyOn = true;
  for (const name in tracks) fadeIn(tracks[name]);
  indBgm.classList.add('on');
  indSe.classList.add('on');
  stateLabel.textContent = 'playing';
}

function lightOff() {
  if (!isCurrentlyOn) return;
  isCurrentlyOn = false;
  for (const name in tracks) fadeOut(tracks[name]);
  indBgm.classList.remove('on');
  indSe.classList.remove('on');
  stateLabel.textContent = 'silent';
}

function onState(state) {
  if (state.isLightOn) lightOn();
  else lightOff();
}

const wsUrl = `ws://${location.hostname}:3001`;
let ws = null;

function connect() {
  try {
    ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'register', role: 'sound' }));
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'state') onState(msg);
      } catch (e) {}
    };
    ws.onclose = () => { setTimeout(connect, 2000); };
    ws.onerror = () => ws.close();
  } catch (e) { setTimeout(connect, 2000); }
}

connect();