const CONFIG = {
  numBugs: 250,
  lightRadius: 220,
  reactionDelayMax: 300,
  decayRateMin: 0.0004,
  decayRateMax: 0.0012,
  recoveryRate: 0.006,
  boredomThreshold: 0.15,
  broadcastInterval: 50,
};

let bugs = [];
let lightWasOn = false;
let lastBroadcast = 0;
let started = false;
let isLightOn = false;

function setup() {
  createCanvas(windowWidth, windowHeight);
  textAlign(CENTER, CENTER);
  noCursor();
  textFont('Yu Mincho');
  for (let i = 0; i < CONFIG.numBugs; i++) bugs.push(new Bug());

  const overlay = document.getElementById('start-overlay');
  if (overlay) {
    overlay.addEventListener('click', async () => {
      await sound.init();
      overlay.classList.add('hidden');
      started = true;
    });
  }
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); }

function draw() {
  background(0);

  let lightPos = createVector(mouseX, mouseY);
  let r = CONFIG.lightRadius;
  let lightJustOn = isLightOn && !lightWasOn;
  lightWasOn = isLightOn;

  if (isLightOn) {
    let ctx = drawingContext;
    let cx = lightPos.x, cy = lightPos.y;

    let outerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.8);
    outerGlow.addColorStop(0, 'rgba(255,255,240,0.06)');
    outerGlow.addColorStop(0.5, 'rgba(255,255,235,0.03)');
    outerGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = outerGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.8, 0, TWO_PI);
    ctx.fill();

    let mainBeam = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    mainBeam.addColorStop(0, 'rgba(255,255,245,0.18)');
    mainBeam.addColorStop(0.15, 'rgba(255,255,240,0.14)');
    mainBeam.addColorStop(0.4, 'rgba(255,255,235,0.08)');
    mainBeam.addColorStop(0.7, 'rgba(255,250,230,0.03)');
    mainBeam.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mainBeam;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TWO_PI);
    ctx.fill();

    let hotspot = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.3);
    hotspot.addColorStop(0, 'rgba(255,255,250,0.22)');
    hotspot.addColorStop(0.5, 'rgba(255,255,245,0.08)');
    hotspot.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hotspot;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.3, 0, TWO_PI);
    ctx.fill();

    noStroke();
    for (let i = 0; i < 40; i++) {
      let angle = random(TWO_PI);
      let dist = sqrt(random()) * r * 1.2;
      let px = cx + cos(angle) * dist;
      let py = cy + sin(angle) * dist;
      let intensity = map(dist, 0, r * 1.2, 12, 2);
      let size = random(1.5, 4);
      fill(255, 255, 245, intensity);
      circle(px, py, size);
    }
  }

  for (let bug of bugs) {
    if (lightJustOn) bug.onLightOn();
    bug.update(bugs, lightPos, r, isLightOn);
    bug.display();
  }

  if (millis() - lastBroadcast > CONFIG.broadcastInterval) {
    connection.send({ isLightOn, x: mouseX, y: mouseY });
    lastBroadcast = millis();
  }

  sound.update(isLightOn);

  if (new URLSearchParams(location.search).has('dev')) {
    fill(connection.isConnected() ? '#2d2' : '#555');
    noStroke();
    circle(width - 12, 12, 6);
  }
}

function mousePressed() {
  if (!started) return;

  if (new URLSearchParams(location.search).has('fullscreen')) {
    if (!fullscreen()) { fullscreen(true); return; }
  }

  isLightOn = !isLightOn;
}

function keyPressed() {
  controls.handleKey(keyCode, key);
  return false;
}

function levyStep(min, max, mu) {
  return Math.min(min * Math.pow(Math.random() + 0.001, -1 / (mu - 1)), max);
}

class Bug {
  constructor() {
    this.pos = createVector(random(width), random(height));
    this.heading = random(TWO_PI);
    this.speed = 0;
    this.vel = createVector(0, 0);
    this.baseSpeed = random(1.8, 4.5);
    this.turnRate = random(0.03, 0.08);
    this.fixationAngle = random(10, 40) * (PI / 180);
    this.handedness = random() > 0.5 ? 1 : -1;
    this.antennaSpread = random(6, 14);
    this.tropotaxisGain = random(0.02, 0.06);
    this.detectionMult = random(1.5, 4.0);
    this.reactionDelay = floor(random(0, CONFIG.reactionDelayMax));
    this.reactionTimer = 0;
    this.hasReacted = false;
    this.approachSpeedMult = random() < 0.15 ? random(1.2, 1.5) : random() > 0.85 ? random(0.5, 0.7) : random(0.8, 1.1);
    this.state = 'run'; this.stateTimer = 0; this.tumbleAmount = 0; this.nextRun();
    this.interest = 1.0;
    this.decayRate = random(CONFIG.decayRateMin, CONFIG.decayRateMax);
    this.levyTarget = null; this.levyMu = random(1.8, 2.2);
    this.millingAngle = random(TWO_PI); this.millingDir = this.handedness;
    this.millingSpeed = random(0.008, 0.03);
    this.millingRadius = 0;
    this.preferredOrbitRadius = 0;
    this.baseSize = random(14, 24); this.char = "虫";
    this.tremorPhase = random(TWO_PI); this.tremorFreq = random(0.06, 0.15);
    this.legPhase = random(TWO_PI);
  }

  onLightOn() {
    this.reactionTimer = this.reactionDelay;
    this.hasReacted = false;
    this.interest = constrain(this.interest + 0.2, 0, 1);
  }

  nextRun()    { this.state = 'run';    this.stateTimer = floor(random(30, 150) * (random() < 0.15 ? 2 : 1)); this.speed = this.baseSpeed * random(0.8, 1.1); }
  nextStop()   { this.state = 'stop';   this.stateTimer = floor(random(5, 25)); this.speed = 0; }
  nextTumble() { this.state = 'tumble'; this.stateTimer = floor(random(3, 10)); this.tumbleAmount = random(-PI * 0.7, PI * 0.7); this.speed = this.baseSpeed * 0.15; }

  phototaxisSteering(lp) {
    let to = p5.Vector.sub(lp, this.pos), d = to.mag(), la = to.heading();
    let dh = la - this.handedness * this.fixationAngle;
    let ce = atan2(sin(dh - this.heading), cos(dh - this.heading));
    let cs = map(constrain(d, 10, 800), 10, 800, 1.5, 0.4);
    let compass = ce * cs * this.turnRate * 4;

    let hv = p5.Vector.fromAngle(this.heading), pv = p5.Vector.fromAngle(this.heading + HALF_PI);
    let ls = p5.Vector.add(this.pos, p5.Vector.add(p5.Vector.mult(hv, this.antennaSpread), p5.Vector.mult(pv, -this.antennaSpread * 0.5)));
    let rs = p5.Vector.add(this.pos, p5.Vector.add(p5.Vector.mult(hv, this.antennaSpread), p5.Vector.mult(pv, this.antennaSpread * 0.5)));
    let li = 1 / (p5.Vector.dist(ls, lp) ** 2 + 1), ri = 1 / (p5.Vector.dist(rs, lp) ** 2 + 1);
    let tropo = (ri - li) * this.tropotaxisGain * 1500;

    let tw = constrain(map(d, 10, 600, 0.6, 0.1), 0.1, 0.6);
    return compass * (1 - tw) + tropo * tw;
  }

  millingBehavior(lp, lr) {
    this.millingAngle += this.millingDir * this.millingSpeed;
    if (random() < 0.005) this.millingDir *= -1;

    // Preferred orbit radius: Gaussian around 0.5 * lr
    if (this.preferredOrbitRadius === 0 || random() < 0.005) {
      let u1 = random(0.001, 1), u2 = random(0.001, 1);
      let z = sqrt(-2 * log(u1)) * cos(TWO_PI * u2);
      this.preferredOrbitRadius = constrain((0.5 + z * 0.12) * lr, lr * 0.15, lr * 0.85);
    }
    this.millingRadius = lerp(this.millingRadius, this.preferredOrbitRadius, 0.02);

    let t = createVector(lp.x + cos(this.millingAngle) * this.millingRadius, lp.y + sin(this.millingAngle) * this.millingRadius);
    let e = atan2(sin(p5.Vector.sub(t, this.pos).heading() - this.heading), cos(p5.Vector.sub(t, this.pos).heading() - this.heading));
    return e * this.turnRate * 2.5;
  }

  separate(all) {
    let st = createVector(0, 0), n = 0, sd = this.baseSize * 0.9;
    for (let o of all) { let d = p5.Vector.dist(this.pos, o.pos); if (o !== this && d > 0 && d < sd) { st.add(p5.Vector.sub(this.pos, o.pos).normalize().div(d)); n++; } }
    if (n > 0) { st.div(n); let e = atan2(sin(st.heading() - this.heading), cos(st.heading() - this.heading)); return e * 0.08; }
    return 0;
  }

  levyWander() {
    if (!this.levyTarget || p5.Vector.dist(this.pos, this.levyTarget) < 15) {
      let s = levyStep(20, 500, this.levyMu), a = random(TWO_PI);
      this.levyTarget = createVector(this.pos.x + cos(a) * s, this.pos.y + sin(a) * s);
    }
    let da = p5.Vector.sub(this.levyTarget, this.pos).heading();
    return atan2(sin(da - this.heading), cos(da - this.heading)) * this.turnRate * 2;
  }

  update(all, lp, lr, on) {
    let d = p5.Vector.dist(this.pos, lp), dr = lr * this.detectionMult;
    if (on && d < lr) this.interest -= this.decayRate;
    else if (!on) this.interest += CONFIG.recoveryRate;
    this.interest = constrain(this.interest, 0, 1);

    if (on && !this.hasReacted) { this.reactionTimer--; if (this.reactionTimer <= 0) this.hasReacted = true; }
    if (!on) this.hasReacted = false;

    let aw = on && this.hasReacted;
    let att = aw && this.interest > CONFIG.boredomThreshold && d < dr;
    let ins = aw && this.interest > CONFIG.boredomThreshold && d < lr;

    this.stateTimer--;
    if (this.state === 'run' && this.stateTimer <= 0) {
      if (att) { random() < 0.1 ? (this.nextStop(), this.stateTimer = floor(random(3, 10))) : this.nextRun(); }
      else if (ins) { random() < 0.3 ? this.nextStop() : random() < 0.15 ? this.nextTumble() : this.nextRun(); }
      else { random() < 0.6 ? this.nextStop() : this.nextTumble(); }
    } else if (this.state === 'stop' && this.stateTimer <= 0) { att ? this.nextRun() : random() < 0.7 ? this.nextTumble() : this.nextRun(); }
    else if (this.state === 'tumble' && this.stateTimer <= 0) this.nextRun();

    let steer = 0;

    if (this.state === 'tumble') {
      steer = this.tumbleAmount / 8;

    } else if (this.state === 'run') {
      if (ins) {
        steer = this.millingBehavior(lp, lr);
        this.speed = this.baseSpeed * random(0.3, 0.6);

      } else if (att) {
        steer = this.phototaxisSteering(lp);
        this.speed = this.baseSpeed * this.approachSpeedMult * map(d, lr, dr, 1, 0.7) * random(0.9, 1.1);

      } else if (aw && this.interest <= CONFIG.boredomThreshold) {
        steer = d < dr ? -this.phototaxisSteering(lp) * 0.35 + random(-0.06, 0.06) : this.levyWander();
        this.speed = this.baseSpeed * random(0.5, 0.9);

      } else {
        steer = this.levyWander();
      }

      steer += this.separate(all) + random(-0.01, 0.01);
    }

    this.heading += constrain(steer, -this.turnRate * 5, this.turnRate * 5);
    this.vel.x = cos(this.heading) * this.speed;
    this.vel.y = sin(this.heading) * this.speed;
    this.vel.mult(map(noise(this.tremorPhase * 0.3 + frameCount * 0.03), 0, 1, 0.91, 0.98));
    this.pos.add(this.vel);
    let b = this.baseSize;
    if (this.pos.x < -b) this.pos.x = width + b; if (this.pos.x > width + b) this.pos.x = -b;
    if (this.pos.y < -b) this.pos.y = height + b; if (this.pos.y > height + b) this.pos.y = -b;
  }

  display() {
    let a = map(this.interest, 0, 1, 80, 240);
    this.tremorPhase += this.tremorFreq;
    this.legPhase += this.speed * 0.15;
    let rot = this.heading + HALF_PI + sin(this.tremorPhase) * 0.08 + sin(this.legPhase) * 0.04 * this.speed;
    if (this.state === 'stop' && random() < 0.15) rot += random(-0.25, 0.25);
    if (this.state === 'tumble') rot += random(-0.12, 0.12);
    fill(245, 245, 245, a); noStroke();
    textSize(this.baseSize + sin(frameCount * 0.03 + this.tremorPhase));
    push(); translate(this.pos.x, this.pos.y); rotate(rot); text(this.char, 0, 0); pop();
  }
}