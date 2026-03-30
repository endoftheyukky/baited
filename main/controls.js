const controls = (() => {
  const STORAGE_KEY = 'baited_config';

  const defaults = {
    numBugs:    250,
    lightRadius: 220,
    bugSizeMin:  14,
    bugSizeMax:  24,
  };

  const steps = {
    numBugs:    10,
    lightRadius: 10,
    bugSizeMin:  1,
    bugSizeMax:  1,
  };

  const labels = {
    numBugs:    'Bugs count',
    lightRadius: 'Light radius (px)',
    bugSizeMin:  'Bug size min (px)',
    bugSizeMax:  'Bug size max (px)',
  };

  const keys = Object.keys(defaults);
  let selectedIndex = 0;
  let visible = false;

  // Load saved config on startup
  function loadSaved() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        for (const key of keys) {
          if (parsed[key] !== undefined) CONFIG[key] = parsed[key];
        }
        console.log('[controls] Loaded saved config');
      }
    } catch (e) {}
  }

  function save() {
    try {
      const toSave = {};
      for (const key of keys) toSave[key] = CONFIG[key];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {}
  }

  // Apply on load
  loadSaved();

  const panel = document.createElement('div');
  panel.style.cssText = `
    position: fixed; top: 12px; left: 12px; z-index: 300;
    background: rgba(0,0,0,0.85); color: #aaa;
    font-family: monospace; font-size: 12px;
    padding: 14px 18px; border-radius: 6px;
    line-height: 1.9; display: none; min-width: 360px;
    pointer-events: none; user-select: none;
  `;
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(panel));

  function applyBugs() {
    if (typeof bugs !== 'undefined') {
      bugs.length = 0;
      for (let i = 0; i < CONFIG.numBugs; i++) bugs.push(new Bug());
    }
  }

  function render() {
    if (!visible) { panel.style.display = 'none'; return; }
    panel.style.display = 'block';

    let html = '<div style="color:#666;margin-bottom:6px">[D] toggle  [↑↓] select  [←→] adjust  [R] reset</div>';
    keys.forEach((key, i) => {
      const val = CONFIG[key];
      const sel = i === selectedIndex;
      const display = val < 0.01 ? val.toFixed(4) : val;
      html += `<div style="color:${sel ? '#fff' : '#666'}">${sel ? '▸ ' : '  '}${labels[key]}: <span style="color:${sel ? '#4f4' : '#888'}">${display}</span></div>`;
    });

    if (typeof bugs !== 'undefined') {
      const inLight = bugs.filter(b => b.interest > CONFIG.boredomThreshold).length;
      html += `<div style="color:#555;margin-top:8px;border-top:1px solid #333;padding-top:6px">`;
      html += `Active: ${inLight}/${bugs.length}  FPS: ${Math.round(frameRate())}`;
      html += `</div>`;
    }

    panel.innerHTML = html;
  }

  function adjust(dir) {
    const key = keys[selectedIndex];
    CONFIG[key] = Math.max(0, CONFIG[key] + steps[key] * dir);
    if (steps[key] < 0.01) CONFIG[key] = parseFloat(CONFIG[key].toFixed(4));
    if (key === 'numBugs' || key === 'bugSizeMin' || key === 'bugSizeMax') applyBugs();
    save();
    render();
  }

  function resetAll() {
    for (const key of keys) CONFIG[key] = defaults[key];
    applyBugs();
    save();
    render();
  }

  function handleKey(kc, k) {
    if (k === 'd' || k === 'D') { visible = !visible; render(); return true; }
    if (!visible) return false;
    if (kc === UP_ARROW) { selectedIndex = (selectedIndex - 1 + keys.length) % keys.length; render(); return true; }
    if (kc === DOWN_ARROW) { selectedIndex = (selectedIndex + 1) % keys.length; render(); return true; }
    if (kc === RIGHT_ARROW) { adjust(1); return true; }
    if (kc === LEFT_ARROW) { adjust(-1); return true; }
    if (k === 'r' || k === 'R') { resetAll(); return true; }
    return false;
  }

  setInterval(() => { if (visible) render(); }, 500);
  return { handleKey, render };
})();