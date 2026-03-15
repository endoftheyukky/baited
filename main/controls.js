// ============================================================
//  baited — controls.js
//
//  Press [D] to toggle parameter panel.
//  ↑↓ to select parameter, ←→ to adjust value.
//  [R] to reset all to defaults.
//  Panel is hidden in non-dev mode by default.
// ============================================================

const controls = (() => {
  const defaults = {
    numBugs:          250,
    lightRadius:      220,
    decayRateMin:     0.0004,
    decayRateMax:     0.0012,
    recoveryRate:     0.006,
    boredomThreshold: 0.15,
    reactionDelayMax: 300,
  };

  const steps = {
    numBugs:          10,
    lightRadius:      10,
    decayRateMin:     0.0001,
    decayRateMax:     0.0002,
    recoveryRate:     0.001,
    boredomThreshold: 0.01,
    reactionDelayMax: 30,
  };

  const labels = {
    numBugs:          'Bugs count',
    lightRadius:      'Light radius (px)',
    decayRateMin:     'Decay rate min (slower=longer)',
    decayRateMax:     'Decay rate max',
    recoveryRate:     'Recovery rate',
    boredomThreshold: 'Boredom threshold',
    reactionDelayMax: 'Reaction delay max (frames)',
  };

  const keys = Object.keys(defaults);
  let selectedIndex = 0;
  let visible = false;

  // Create panel DOM
  const panel = document.createElement('div');
  panel.id = 'controls-panel';
  panel.style.cssText = `
    position: fixed; top: 12px; left: 12px; z-index: 300;
    background: rgba(0,0,0,0.85); color: #aaa;
    font-family: monospace; font-size: 12px;
    padding: 14px 18px; border-radius: 6px;
    line-height: 1.9; display: none; min-width: 360px;
    pointer-events: none; user-select: none;
  `;
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(panel));

  function render() {
    if (!visible) { panel.style.display = 'none'; return; }
    panel.style.display = 'block';

    let html = '<div style="color:#666;margin-bottom:6px">[D] toggle  [↑↓] select  [←→] adjust  [R] reset</div>';
    keys.forEach((key, i) => {
      const val = CONFIG[key];
      const isSelected = i === selectedIndex;
      const color = isSelected ? '#fff' : '#666';
      const arrow = isSelected ? '▸ ' : '  ';
      const display = val < 0.01 ? val.toFixed(4) : val;
      html += `<div style="color:${color}">${arrow}${labels[key]}: <span style="color:${isSelected ? '#4f4' : '#888'}">${display}</span></div>`;
    });

    // Show live stats
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
    const step = steps[key];
    CONFIG[key] = Math.max(0, CONFIG[key] + step * dir);
    // Round to avoid floating point noise
    if (step < 0.01) CONFIG[key] = parseFloat(CONFIG[key].toFixed(4));
    render();
  }

  function resetAll() {
    for (const key of keys) CONFIG[key] = defaults[key];
    render();
  }

  // Keyboard handling (called from p5 keyPressed)
  function handleKey(keyCode, key) {
    if (key === 'd' || key === 'D') {
      visible = !visible;
      render();
      return true;
    }

    if (!visible) return false;

    if (keyCode === UP_ARROW) {
      selectedIndex = (selectedIndex - 1 + keys.length) % keys.length;
      render();
      return true;
    }
    if (keyCode === DOWN_ARROW) {
      selectedIndex = (selectedIndex + 1) % keys.length;
      render();
      return true;
    }
    if (keyCode === RIGHT_ARROW) {
      adjust(1);
      return true;
    }
    if (keyCode === LEFT_ARROW) {
      adjust(-1);
      return true;
    }
    if (key === 'r' || key === 'R') {
      resetAll();
      return true;
    }

    return false;
  }

  // Auto-refresh panel while visible
  setInterval(() => { if (visible) render(); }, 500);

  return { handleKey, render };
})();