const sound = (() => {
  const AUDIO_SRC = 'audio/baited.wav';
  const FADE_IN = 1.5;
  const FADE_OUT = 2.0;

  let ctx = null;
  let gain = null;
  let ready = false;
  let isOn = false;

  async function init() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(ctx.destination);

    try {
      const res = await fetch(AUDIO_SRC);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await ctx.decodeAudioData(await res.arrayBuffer());
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(gain);
      src.start(0);
      ready = true;
      console.log('[sound] Ready');
    } catch (e) {
      console.warn('[sound] Could not load audio — running without BGM');
      console.warn('[sound] Place file at: main/audio/ambient.mp3');
    }
  }

  function update(lightOn) {
    if (!ready) return;

    if (lightOn && !isOn) {
      isOn = true;
      if (ctx.state === 'suspended') ctx.resume();
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + FADE_IN);
    } else if (!lightOn && isOn) {
      isOn = false;
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_OUT);
    }
  }

  return { init, update };
})();