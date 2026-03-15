// ============================================================
//  baited — sound/player.js
//
//  Plays ambient BGM loop via Web Audio API.
//  Fades in when light is ON, fades out when OFF.
//  Requires user click to unlock audio context (browser policy).
//
//  Place your audio file at: sound/audio/ambient.mp3
// ============================================================

const AUDIO_SRC = 'audio/ambient.mp3';
const FADE_IN_TIME  = 1.5;  // seconds
const FADE_OUT_TIME = 2.0;  // seconds

let audioCtx = null;
let gainNode = null;
let sourceNode = null;
let audioBuffer = null;
let isAudioReady = false;
let isCurrentlyOn = false;

const indicator = document.getElementById('indicator');
const stateLabel = document.getElementById('state-label');
const startBtn = document.getElementById('start-btn');

// --- Audio init (must be triggered by user gesture) ---
async function initAudio() {
  startBtn.classList.add('hidden');

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  gainNode = audioCtx.createGain();
  gainNode.gain.value = 0;
  gainNode.connect(audioCtx.destination);

  // Load audio file
  try {
    stateLabel.textContent = 'loading audio...';
    const response = await fetch(AUDIO_SRC);
    const arrayBuffer = await response.arrayBuffer();
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    isAudioReady = true;
    stateLabel.textContent = 'ready — waiting for light';
    indicator.style.color = '#555';
    console.log('[sound] Audio loaded and ready');
  } catch (e) {
    stateLabel.textContent = 'audio load failed — check audio/ambient.mp3';
    indicator.style.color = '#a33';
    console.error('[sound] Failed to load audio:', e);
    return;
  }

  // Start looping source (always running, volume controls audibility)
  startLoop();
}

function startLoop() {
  if (sourceNode) {
    try { sourceNode.stop(); } catch (e) {}
  }
  sourceNode = audioCtx.createBufferSource();
  sourceNode.buffer = audioBuffer;
  sourceNode.loop = true;
  sourceNode.connect(gainNode);
  sourceNode.start(0);
}

function fadeIn() {
  if (!isAudioReady || isCurrentlyOn) return;
  isCurrentlyOn = true;

  if (audioCtx.state === 'suspended') audioCtx.resume();

  gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
  gainNode.gain.setValueAtTime(gainNode.gain.value, audioCtx.currentTime);
  gainNode.gain.linearRampToValueAtTime(1.0, audioCtx.currentTime + FADE_IN_TIME);

  indicator.style.color = '#eee';
  stateLabel.textContent = 'playing';
}

function fadeOut() {
  if (!isAudioReady || !isCurrentlyOn) return;
  isCurrentlyOn = false;

  gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
  gainNode.gain.setValueAtTime(gainNode.gain.value, audioCtx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + FADE_OUT_TIME);

  indicator.style.color = '#555';
  stateLabel.textContent = 'silent';
}

function onState(state) {
  if (state.isLightOn) fadeIn();
  else fadeOut();
}

// --- WebSocket ---
const wsUrl = `ws://${location.hostname}:3001`;
let ws = null;

function connect() {
  try {
    ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'register', role: 'sound' }));
      console.log('[sound] Connected to server');
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'state') onState(msg);
      } catch (e) {}
    };
    ws.onclose = () => {
      console.log('[sound] Disconnected, reconnecting...');
      setTimeout(connect, 2000);
    };
    ws.onerror = () => ws.close();
  } catch (e) {
    setTimeout(connect, 2000);
  }
}

connect();
