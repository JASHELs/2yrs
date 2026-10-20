/* =========================================================
   CONFIGURACIÓN  (aquí ajustas palabras y ritmo)
   También puedes usar  index.html?palabras=amor,vida,juntos
   ========================================================= */
const CONFIG = {
  words: [
    "I love you","Je t'aime","Ti amo","Ich liebe dich","Eu te amo","爱してる","사랑해","Я тебя люблю",
    "我爱你","Σ' αγαπώ"
  ],
  bpm: 120,          // tempo: 1 pulso = 60 / bpm segundos
  outlineTicks: 16,  // corcheas (1/2 pulso) con las que se dibuja el contorno
  fillTicks: 24,     // semicorcheas (1/4 de pulso) con las que se llena el corazón
  restBeats: 1,      // pulsos de silencio antes del golpe final
  audioFile: ""      // opcional: ruta a tu propio audio, p. ej. "gamecube.mp3" (desactiva el sonido sintetizado)
};

const qp = new URLSearchParams(location.search).get('palabras');
let WORDS = qp ? qp.split(',').map(s => s.trim()).filter(Boolean) : CONFIG.words;
if (!WORDS.length) WORDS = CONFIG.words;

/* =========================================================
   REFERENCIAS Y GEOMETRÍA DEL CORAZÓN
   ========================================================= */
const stage  = document.getElementById('stage');
const heart  = document.getElementById('heart');
const glow   = document.getElementById('glow');
const shadow = document.getElementById('shadow');
const startBtn = document.getElementById('start');
const againBtn = document.getElementById('again');

const hx = t => 16 * Math.pow(Math.sin(t), 3);
const hy = t => 13*Math.cos(t) - 5*Math.cos(2*t) - 2*Math.cos(3*t) - Math.cos(4*t);
const BBW = 32, BBH = 29, YTOP = 12;           // caja del corazón en "unidades"

const FONT = getComputedStyle(document.body).fontFamily;
const mctx = document.createElement('canvas').getContext('2d');
const measure = (word, size) => { mctx.font = `700 ${size}px ${FONT}`; return mctx.measureText(word).width; };
const rnd  = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

let Wd, Hd, s, pad, W, H;
let outR = [], outL = [], fills = [];
let state = 'idle';                             // idle | running | done

const X = x => pad + Wd/2 + x * s;
const Y = y => pad + (YTOP - y) * s;
const hueAt = cy => 266 + 70 * ((YTOP - (cy - pad) / s + 17) / BBH) + rnd(-10, 10);  // violeta abajo -> rosa arriba

function heartPath(ctx) {
  ctx.beginPath();
  for (let k = 0; k <= 720; k++) {
    const t = k / 720 * Math.PI * 2;
    k ? ctx.lineTo(X(hx(t)), Y(hy(t))) : ctx.moveTo(X(hx(t)), Y(hy(t)));
  }
  ctx.closePath();
}

function mk(word, cx, cy, size, cls) {
  const el = document.createElement('span');
  el.className = 'w ' + cls + (size < 11 ? ' xs' : '');
  el.textContent = word;
  el.style.left = cx + 'px';
  el.style.top = cy + 'px';
  el.style.fontSize = size + 'px';
  el.style.setProperty('--h', hueAt(cy).toFixed(0));
  heart.appendChild(el);
  return el;
}

/* =========================================================
   CONSTRUCCIÓN DEL LAYOUT
   ========================================================= */
function build() {
  heart.querySelectorAll('.w').forEach(n => n.remove());
  outR = []; outL = []; fills = [];

  const vw = innerWidth, vh = innerHeight;
  Wd = Math.min(vw * .88, vh * .6 * BBW / BBH);
  Hd = Wd * BBH / BBW;
  s = Wd / BBW;
  pad = Wd * .1;
  W = Math.round(Wd + 2*pad);
  H = Math.round(Hd + 2*pad);

  stage.style.width = W + 'px';
  stage.style.height = H + 'px';
  stage.style.setProperty('--jh', (Hd * .3) + 'px');
  heart.style.transformOrigin = `50% ${pad + Hd}px`;
  shadow.style.left = '50%';
  shadow.style.top = (pad + Hd + pad * .1) + 'px';
  shadow.style.width = (Wd * .55) + 'px';
  shadow.style.height = (Wd * .06) + 'px';

  /* --- resplandor en forma de corazón (se enciende al final) --- */
  const dpr = Math.min(devicePixelRatio || 1, 2);
  glow.width = W * dpr; glow.height = H * dpr;
  glow.style.width = W + 'px'; glow.style.height = H + 'px';
  const g = glow.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const gr = g.createRadialGradient(W/2, Y(2), 0, W/2, Y(2), Wd * .6);
  gr.addColorStop(0, 'rgba(255,120,200,.95)');
  gr.addColorStop(1, 'rgba(120,70,230,.75)');
  g.fillStyle = gr;
  heartPath(g);
  g.fill();

  /* --- máscara del corazón (1 px de margen) y rejilla de ocupación --- */
  const mc = document.createElement('canvas');
  mc.width = W; mc.height = H;
  const m = mc.getContext('2d', { willReadFrequently: true });
  m.fillStyle = '#fff';
  heartPath(m); m.fill();
  m.globalCompositeOperation = 'destination-out';
  m.lineJoin = 'round';
  m.lineWidth = 2;
  heartPath(m); m.stroke();
  const alpha = m.getImageData(0, 0, W, H).data;
  const ins = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) ins[i] = alpha[i * 4 + 3] > 128 ? 1 : 0;
  const occ = new Uint8Array(W * H);

  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && ins[y * W + x] === 1;

  function rectInside(ax, ay, bx, by) {
    for (let x = ax; x <= bx; x += 3) if (!inside(x, ay) || !inside(x, by)) return false;
    for (let y = ay; y <= by; y += 3) if (!inside(ax, y) || !inside(bx, y)) return false;
    return inside(bx, ay) && inside(bx, by) && inside(ax, by);
  }
  function isFree(ax, ay, bx, by) {
    for (let y = ay; y <= by; y++) {
      const row = y * W;
      for (let x = ax; x <= bx; x++) if (occ[row + x]) return false;
    }
    return true;
  }
  function canPlace(x0, y0, bw, bh) {
    const ax = Math.floor(x0), ay = Math.floor(y0), bx = Math.ceil(x0 + bw), by = Math.ceil(y0 + bh);
    if (ax < 0 || ay < 0 || bx >= W || by >= H) return false;
    return isFree(ax, ay, bx, by) && rectInside(ax, ay, bx, by);
  }
  function place(x0, y0, bw, bh) {
    const ax = Math.floor(x0), ay = Math.floor(y0), bx = Math.ceil(x0 + bw), by = Math.ceil(y0 + bh);
    for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) occ[y * W + x] = 1;
  }

  /* --- 1) CONTORNO: palabras horizontales pegadas al borde, de la punta hacia arriba --- */
  const osz = Math.max(13, Math.min(26, Wd * .03));
  const N = 1400, pts = [];
  let L = 0;
  for (let k = 0; k <= N; k++) {
    const t = Math.PI - k * Math.PI / N;
    const p = { x: hx(t), y: hy(t), l: 0 };
    if (k) {
      const q = pts[k-1];
      L += Math.hypot((p.x - q.x) * s, (p.y - q.y) * s);
      p.l = L;
    }
    pts.push(p);
  }
  const ccx = X(0), ccy = Y(-2);                         // centro aproximado del corazón
  function atLen(len, sign) {
    let lo = 0, hi = N;
    while (lo < hi) { const mm = (lo + hi) >> 1; pts[mm].l < len ? lo = mm + 1 : hi = mm; }
    const i = Math.max(1, lo);
    const a = pts[Math.max(0, i - 6)], b = pts[Math.min(N, i + 6)];
    let tx = (b.x - a.x) * sign * s, ty = -(b.y - a.y) * s;
    const n = Math.hypot(tx, ty) || 1; tx /= n; ty /= n;
    const px = X(pts[i].x * sign), py = Y(pts[i].y);
    let nx = -ty, ny = tx;                                // normal hacia adentro
    if (nx * (ccx - px) + ny * (ccy - py) < 0) { nx = -nx; ny = -ny; }
    return { x: px, y: py, tx, ty, nx, ny };
  }
  function ring(sign, offset, arr) {
    let wi = offset, p = osz * .3, fails = 0;
    while (p < L - osz * .3) {
      const word = WORDS[wi % WORDS.length];
      const bw = measure(word, osz) + osz * .28, bh = osz * .92;
      const q = atLen(p, sign);
      let ok = false;
      for (let d = 0; d <= Math.max(bw, bh) * .6 + 4; d += 1.5) {
        const cx = q.x + q.nx * d, cy = q.y + q.ny * d;
        const x0 = cx - bw / 2, y0 = cy - bh / 2;
        if (canPlace(x0, y0, bw, bh)) {
          place(x0, y0, bw, bh);
          arr.push(mk(word, cx, cy, osz, 'o'));
          wi++; ok = true; fails = 0;
          break;
        }
      }
      if (ok) p += (Math.abs(q.tx) * bw + Math.abs(q.ty) * bh) * .45;
      else { p += 2; if (++fails % 8 === 0) wi++; }
    }
  }
  ring( 1, 0, outR);
  ring(-1, Math.floor(WORDS.length / 2) + 1, outL);

  /* --- 2) RELLENO --- */
  const list = [];
  const addFill = (word, x0, y0, bw, bh, size) => {
    place(x0, y0, bw, bh);
    list.push({ el: mk(word, x0 + bw / 2, y0 + bh / 2, size, 'f'), size, r: Math.random() });
  };

  // 2a) tamaños grandes -> colocación aleatoria (todo horizontal)
  const maxSize = Wd * .1, randMin = Wd * .045;
  for (let size = maxSize; size >= randMin; size *= .9) {
    const maxFails = size > 40 ? 260 : 170;
    let fails = 0;
    while (fails < maxFails) {
      const word = pick(WORDS);
      const sz = size * rnd(.9, 1.1);
      const bw = measure(word, sz) + sz * .28, bh = sz * .92;
      const x0 = rnd(0, W - bw), y0 = rnd(0, H - bh);
      if (canPlace(x0, y0, bw, bh)) { addFill(word, x0, y0, bw, bh, sz); fails = 0; }
      else fails++;
    }
  }

  // 2b) tamaños medianos/pequeños -> barrido sistemático para tapar todos los huecos
  function sweep(size, tokens) {
    const ws = tokens.map(w => measure(w, size) + size * .28);
    const bh = size * .92;
    let shortest = 0;
    ws.forEach((v, i) => { if (v < ws[shortest]) shortest = i; });
    for (let y0 = 0; y0 + bh < H; y0 += 2) {
      for (let x0 = 0; x0 < W;) {
        const cx = Math.floor(x0), cy = Math.floor(y0);
        if (cx >= W || !ins[cy * W + cx] || occ[cy * W + cx]) { x0 += 2; continue; }
        // entre varias palabras al azar (y la más corta) se elige la más larga que quepa en el hueco
        let best = -1;
        for (let k = 0; k < 11; k++) {
          const i = k === 10 ? shortest : Math.floor(Math.random() * tokens.length);
          if ((best < 0 || ws[i] > ws[best]) && canPlace(x0, y0, ws[i], bh)) best = i;
        }
        if (best >= 0) { addFill(tokens[best], x0, y0, ws[best], bh, size); x0 += ws[best]; }
        else x0 += 2;
      }
    }
  }
  const minSize = 6.5;
  for (let size = Wd * .045; size >= minSize; size *= .93) sweep(size, WORDS);
  [10, 8, 6.5, 5.5].forEach(size => sweep(size, ["♥", "•", "·"]));   // últimos huecos

  list.sort((a, b) => (b.size - a.size) || (a.r - b.r));   // primero las grandes, luego las pequeñas
  fills = list.map(o => o.el);
}

/* =========================================================
   AUDIO (sintetizado, sincronizado con los pulsos)
   ========================================================= */
let ac, master, SYNTH = true, userAudio = null;
function initAudio() {
  if (ac) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain(); master.gain.value = .75;
  const comp = ac.createDynamicsCompressor();
  master.connect(comp); comp.connect(ac.destination);
}
const DEG = [0, 2, 4, 7, 9];
const note = i => 261.63 * Math.pow(2, (DEG[i % 5] + 12 * Math.floor(i / 5)) / 12);
const PATTERN = [0, 4, 2, 4, 1, 5, 3, 5];

function blip(f, t, { dur = .35, vol = .16, type = 'sine' } = {}) {
  if (!ac || !SYNTH) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + .008);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .05);

  const o2 = ac.createOscillator(), g2 = ac.createGain();
  o2.type = 'triangle'; o2.frequency.setValueAtTime(f * 2, t);
  g2.gain.setValueAtTime(.0001, t);
  g2.gain.exponentialRampToValueAtTime(vol * .35, t + .006);
  g2.gain.exponentialRampToValueAtTime(.0001, t + dur * .6);
  o2.connect(g2); g2.connect(master); o2.start(t); o2.stop(t + dur);
}
function thud(t, vol = .4) {
  if (!ac || !SYNTH) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(170, t);
  o.frequency.exponentialRampToValueAtTime(45, t + .18);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(.0001, t + .35);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + .4);
}
function chord(t) {
  [261.63, 329.63, 392, 523.25, 659.25].forEach((f, i) => blip(f, t + i * .02, { dur: 1.7, vol: .09, type: 'triangle' }));
  thud(t, .5);
}

/* =========================================================
   LÍNEA DE TIEMPO (todo cae sobre la rejilla de pulsos)
   ========================================================= */
let raf = 0;
const HOP_DUR = 1.7;

function light(el) { if (el) el.classList.add('on'); }

function resetState() {
  cancelAnimationFrame(raf);
  heart.querySelectorAll('.w').forEach(n => n.classList.remove('on', 'still'));
  heart.classList.remove('fin', 'hop');
  shadow.classList.remove('hop');
  shadow.style.opacity = 0;
}

function finale() {
  heart.classList.add('fin');
  heart.classList.remove('hop'); shadow.classList.remove('hop');
  void heart.offsetWidth;
  heart.classList.add('hop'); shadow.classList.add('hop');
}

function showAll() {
  heart.querySelectorAll('.w').forEach(n => n.classList.add('on', 'still'));
  heart.classList.add('fin');
}

// reparte un arreglo de palabras en n golpes (cada golpe enciende un tramo)
function slices(arr, n, curve = 1) {
  const out = [];
  let prev = 0;
  for (let k = 0; k < n; k++) {
    const cut = Math.round(arr.length * Math.pow((k + 1) / n, curve));
    out.push(arr.slice(prev, cut));
    prev = cut;
  }
  return out;
}

function play() {
  SYNTH = !CONFIG.audioFile;
  initAudio();
  if (ac && ac.resume) ac.resume();
  resetState();
  state = 'running';
  startBtn.hidden = true;
  againBtn.hidden = true;

  const base = ac ? ac.currentTime + .2 : 0;   // inicio del audio
  const clock0 = performance.now() + 200;      // inicio de lo visual
  const beat = 60 / CONFIG.bpm;
  const ev = [];
  let t = .6;

  if (CONFIG.audioFile) {
    if (!userAudio) userAudio = new Audio(CONFIG.audioFile);
    userAudio.currentTime = 0;
    setTimeout(() => userAudio.play().catch(() => {}), 200);
  }

  /* 1) contorno: una palabra por lado en cada corchea; acento grave cada 4 golpes */
  const nO = CONFIG.outlineTicks;
  const gR = slices(outR, nO), gL = slices(outL, nO);
  for (let k = 0; k < nO; k++) {
    ev.push({ t, fn: () => { gR[k].forEach(light); gL[k].forEach(light); } });
    blip(note(PATTERN[k % PATTERN.length] + 2 * Math.floor(k / PATTERN.length)), base + t, { dur: .4, vol: .17 });
    if (k % 4 === 0) { blip(note(0) / 2, base + t, { dur: .5, vol: .16 }); thud(base + t, .18); }
    t += beat / 2;
  }
  t += beat / 2;

  /* 2) relleno: semicorcheas ascendentes; cada golpe enciende más palabras (grandes -> pequeñas) */
  const nF = CONFIG.fillTicks;
  const gF = slices(fills, nF, 2);
  for (let j = 0; j < nF; j++) {
    ev.push({ t, fn: () => gF[j].forEach(light) });
    blip(note(3 + Math.floor(j / nF * 12)), base + t, { dur: .2, vol: .1 });
    if (j % 4 === 0) thud(base + t, .1);
    t += beat / 4;
  }
  t += beat * CONFIG.restBeats;

  /* 3) golpe final: acorde, resplandor y salto con rebotes tipo logo */
  ev.push({ t, fn: finale });
  chord(base + t);
  [.50, .74, .91].forEach((p, k) => thud(base + t + p * HOP_DUR, .34 - k * .1));
  ev.push({ t: t + HOP_DUR + .4, fn: () => { state = 'done'; againBtn.hidden = false; } });

  let idx = 0;
  (function loop() {
    const now = (performance.now() - clock0) / 1000;
    while (idx < ev.length && ev[idx].t <= now) ev[idx++].fn();
    if (idx < ev.length) raf = requestAnimationFrame(loop);
  })();
}

/* =========================================================
   EVENTOS
   ========================================================= */
startBtn.addEventListener('click', play);
againBtn.addEventListener('click', play);

let rt;
addEventListener('resize', () => {
  clearTimeout(rt);
  rt = setTimeout(() => {
    if (state === 'running') return;
    build();
    if (state === 'done') showAll();
  }, 250);
});

build();
