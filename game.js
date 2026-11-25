"use strict";

// Shape Match: drag each colored shape into the outline with the same shape.
// Each level adds a shape. From level 3 the outlines are gray, so the shape is
// the only clue.
(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("overlay");
  const startBtn = document.getElementById("start-btn");
  const muteBtn = document.getElementById("mute-btn");
  const voiceBtn = document.getElementById("voice-btn");
  const levelEl = document.getElementById("level");

  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const shuffle = (list) => {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const store = {
    get(key, fallback) {
      try {
        return localStorage.getItem(key) ?? fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, String(value));
      } catch {
        // storage blocked
      }
    },
  };

  // ---------- shapes (paths drawn around 0,0 with radius r) ----------
  function regular(sides, r, rotation = -Math.PI / 2) {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = rotation + (i / sides) * TAU;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.closePath();
  }

  const SHAPES = {
    circle: (r) => {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
    },
    square: (r) => {
      ctx.beginPath();
      ctx.rect(-r * 0.82, -r * 0.82, r * 1.64, r * 1.64);
    },
    triangle: (r) => {
      ctx.save();
      ctx.translate(0, r * 0.15);
      regular(3, r * 1.1);
      ctx.restore();
    },
    star: (r) => {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i / 10) * TAU;
        const rr = i % 2 ? r * 0.45 : r * 1.05;
        if (i) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
    },
    heart: (r) => {
      ctx.beginPath();
      ctx.moveTo(0, r * 0.95);
      ctx.bezierCurveTo(-r * 1.4, r * 0.05, -r * 0.75, -r * 1.05, 0, -r * 0.45);
      ctx.bezierCurveTo(r * 0.75, -r * 1.05, r * 1.4, r * 0.05, 0, r * 0.95);
      ctx.closePath();
    },
    diamond: (r) => {
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.05);
      ctx.lineTo(r * 0.7, 0);
      ctx.lineTo(0, r * 1.05);
      ctx.lineTo(-r * 0.7, 0);
      ctx.closePath();
    },
    hexagon: (r) => regular(6, r, 0),
    oval: (r) => {
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.05, r * 0.65, 0, 0, TAU);
    },
  };
  // The order new shapes are introduced, easiest first.
  const SHAPE_ORDER = [
    "circle",
    "square",
    "triangle",
    "star",
    "heart",
    "diamond",
    "hexagon",
    "oval",
  ];
  const COLORS = [
    ["red", "#ef4444"],
    ["orange", "#f97316"],
    ["yellow", "#eab308"],
    ["green", "#22c55e"],
    ["blue", "#3b82f6"],
    ["purple", "#8b5cf6"],
    ["pink", "#ec4899"],
  ];

  // ---------- sound and speech ----------
  let audio = null;
  let muted = store.get("shape-match-muted", "0") === "1";
  let talking = store.get("shape-match-voice", "1") === "1";

  function tone(freq, duration = 0.3, type = "sine", volume = 0.15, delay = 0) {
    if (muted) return;
    try {
      audio ??= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
      const t = audio.currentTime + delay;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(gain).connect(audio.destination);
      osc.start(t);
      osc.stop(t + duration);
    } catch {
      // no audio
    }
  }

  function boing() {
    if (muted) return;
    try {
      audio ??= new (window.AudioContext || window.webkitAudioContext)();
      const t = audio.currentTime;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.exponentialRampToValueAtTime(120, t + 0.3);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.connect(gain).connect(audio.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    } catch {
      // no audio
    }
  }

  let utterance = null;
  let speechReady = false;
  function say(text) {
    if (muted || !talking || !("speechSynthesis" in window)) return;
    try {
      if (speechSynthesis.speaking || speechSynthesis.pending) {
        speechSynthesis.cancel();
      }
      // iOS can leave the queue paused after an interruption (a call, the
      // screen locking), which silently swallows everything after it.
      speechSynthesis.resume();
      // Keep a reference: Safari can drop an utterance that gets
      // garbage-collected before it finishes.
      utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.2;
      speechSynthesis.speak(utterance);
    } catch {
      // no speech
    }
  }

  function updateButtons() {
    muteBtn.textContent = muted ? "🔇" : "🔊";
    muteBtn.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
    voiceBtn.textContent = talking ? "🗣️" : "🤐";
    voiceBtn.setAttribute(
      "aria-label",
      talking ? "Turn off talking" : "Turn on talking",
    );
  }
  function stopTalking() {
    try {
      speechSynthesis.cancel();
    } catch {
      // no speech
    }
  }
  muteBtn.addEventListener("click", () => {
    muted = !muted;
    store.set("shape-match-muted", muted ? "1" : "0");
    updateButtons();
    if (muted) stopTalking();
    else tone(660, 0.15); // confirm straight away, mid-game too
  });
  voiceBtn.addEventListener("click", () => {
    talking = !talking;
    store.set("shape-match-voice", talking ? "1" : "0");
    if (talking && muted) {
      // Talking is a sound, so turning it on turns the sound back on too.
      muted = false;
      store.set("shape-match-muted", "0");
    }
    updateButtons();
    if (!talking) {
      stopTalking();
      return;
    }
    // Speak right away, from this tap. That confirms it works, and on an
    // iPhone it is what allows the game to talk again mid-game.
    say("Talking is on!");
  });

  // ---------- level state ----------
  let width = 0;
  let height = 0;
  // Always start at level 1: siblings share the device.
  let level = 1;
  let targets = []; // { shape, slot }
  let pieces = []; // { shape, color, colorName, slot, state, x, y, ... }
  let layout = { targets: [], tray: [], r: 40 };
  let drag = null;
  let confetti = [];
  let doneTimer = 0;
  let time = 0;

  const shapesForLevel = (n) => Math.min(SHAPE_ORDER.length, n + 2);

  function newLevel() {
    levelEl.textContent = `Level ${level}`;
    const count = shapesForLevel(level);
    // Introduce new shapes in order, but mix which ones appear on later levels.
    const pool = SHAPE_ORDER.slice(0, Math.min(SHAPE_ORDER.length, count + 1));
    const shapes = shuffle(pool).slice(0, count);
    const colors = shuffle(COLORS);
    targets = shapes.map((shape, i) => ({ shape, slot: i }));
    const traySlots = shuffle(shapes.map((_, i) => i));
    pieces = shapes.map((shape, i) => ({
      shape,
      colorName: colors[i % colors.length][0],
      color: colors[i % colors.length][1],
      slot: traySlots[i],
      state: "tray", // tray | drag | placed | back
      x: 0,
      y: 0,
      pop: 0,
      wiggle: 0,
    }));
    computeLayout();
    for (const p of pieces) {
      const home = layout.tray[p.slot];
      p.x = home.x;
      p.y = home.y;
    }
  }

  // Grid positions for n items inside a box.
  function grid(n, box) {
    const cols = Math.min(n, box.w > box.h * 1.4 ? 4 : 3);
    const rows = Math.ceil(n / cols);
    const cw = box.w / cols;
    const ch = box.h / rows;
    const spots = [];
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / cols);
      const inRow = Math.min(cols, n - row * cols);
      const col = i % cols;
      const offset = ((cols - inRow) * cw) / 2;
      spots.push({
        x: box.x + offset + cw * (col + 0.5),
        y: box.y + ch * (row + 0.5),
      });
    }
    return { spots, cell: Math.min(cw, ch) };
  }

  function computeLayout() {
    const n = targets.length;
    const top = { x: 0, y: 0, w: width, h: height * 0.56 };
    const bottom = { x: 0, y: height * 0.6, w: width, h: height * 0.4 };
    const t = grid(n, top);
    const b = grid(n, bottom);
    layout = {
      targets: t.spots,
      tray: b.spots,
      r: Math.max(26, Math.min(t.cell, b.cell, 220) * 0.32),
      divider: height * 0.58,
    };
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (targets.length) {
      computeLayout();
      for (const p of pieces) {
        if (p.state === "tray" || p.state === "back")
          Object.assign(p, layout.tray[p.slot]);
      }
    }
  }
  window.addEventListener("resize", resize);

  // ---------- input ----------
  function pos(ev) {
    const rect = canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }

  canvas.addEventListener("pointerdown", (ev) => {
    if (!overlay.hidden || drag || doneTimer > 0) return;
    const p = pos(ev);
    let found = null;
    let best = Infinity;
    for (const piece of pieces) {
      if (piece.state !== "tray" && piece.state !== "back") continue;
      const d = Math.hypot(piece.x - p.x, piece.y - p.y);
      if (d < layout.r * 1.4 && d < best) {
        found = piece;
        best = d;
      }
    }
    if (!found) return;
    ev.preventDefault();
    canvas.setPointerCapture(ev.pointerId);
    found.state = "drag";
    drag = {
      piece: found,
      id: ev.pointerId,
      dx: found.x - p.x,
      dy: found.y - p.y,
    };
    // Draw the dragged piece on top.
    pieces.splice(pieces.indexOf(found), 1);
    pieces.push(found);
    tone(660, 0.12, "triangle", 0.1);
  });

  canvas.addEventListener("pointermove", (ev) => {
    if (!drag || ev.pointerId !== drag.id) return;
    const p = pos(ev);
    drag.piece.x = p.x + drag.dx;
    drag.piece.y = p.y + drag.dy;
  });

  function drop(ev) {
    if (!drag || ev.pointerId !== drag.id) return;
    const piece = drag.piece;
    drag = null;
    const r = layout.r;
    const match = targets.find((t) => t.shape === piece.shape);
    const spot = layout.targets[match.slot];
    if (Math.hypot(spot.x - piece.x, spot.y - piece.y) < r * 1.3) {
      piece.state = "placed";
      piece.x = spot.x;
      piece.y = spot.y;
      piece.pop = 0.4;
      tone(784, 0.15, "triangle", 0.15);
      tone(1047, 0.3, "triangle", 0.15, 0.1);
      say(`${piece.colorName} ${piece.shape}!`);
      if (pieces.every((p) => p.state === "placed")) levelDone();
      return;
    }
    // Dropped on the wrong outline: wiggle and slide back home.
    const wrong = targets.some((t) => {
      const s = layout.targets[t.slot];
      return Math.hypot(s.x - piece.x, s.y - piece.y) < r * 1.3;
    });
    if (wrong) {
      boing();
      say(`Find the ${piece.shape}!`);
    }
    piece.state = "back";
    piece.wiggle = wrong ? 0.4 : 0;
  }
  canvas.addEventListener("pointerup", drop);
  canvas.addEventListener("pointercancel", drop);
  canvas.addEventListener("contextmenu", (ev) => ev.preventDefault());

  const PRAISE = [
    "Great job!",
    "You did it!",
    "Awesome!",
    "Super!",
    "Way to go!",
  ];

  function levelDone() {
    doneTimer = 2.8;
    setTimeout(
      () => say(PRAISE[Math.floor(Math.random() * PRAISE.length)]),
      600,
    );
    [523, 659, 784, 1047].forEach((f, i) =>
      tone(f, 0.35, "triangle", 0.15, 0.25 + i * 0.12),
    );
    for (let i = 0; i < 140; i++) {
      confetti.push({
        x: rand(0, width),
        y: rand(-height * 0.5, 0),
        vx: rand(-30, 30),
        vy: rand(120, 260),
        rot: rand(0, TAU),
        color: COLORS[i % COLORS.length][1],
        size: rand(6, 12),
        life: 3.5,
      });
    }
  }

  startBtn.addEventListener("click", () => {
    overlay.hidden = true;
    guardHistory();
    resize();
    newLevel();
    say("Match the shapes!");
  });

  // ---------- loop ----------
  function update(dt) {
    time += dt;
    for (const p of pieces) {
      p.pop = Math.max(0, p.pop - dt);
      p.wiggle = Math.max(0, p.wiggle - dt);
      if (p.state === "back") {
        const home = layout.tray[p.slot];
        const k = Math.min(1, dt * 10);
        p.x += (home.x - p.x) * k;
        p.y += (home.y - p.y) * k;
        if (Math.hypot(home.x - p.x, home.y - p.y) < 1) {
          p.state = "tray";
          p.x = home.x;
          p.y = home.y;
        }
      } else if (p.state === "placed") {
        const t = targets.find((tt) => tt.shape === p.shape);
        Object.assign(p, {
          x: layout.targets[t.slot].x,
          y: layout.targets[t.slot].y,
        });
      }
    }
    for (const c of confetti) {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rot += dt * 5;
      c.life -= dt;
    }
    confetti = confetti.filter((c) => c.life > 0 && c.y < height + 20);
    if (doneTimer > 0) {
      doneTimer -= dt;
      if (doneTimer <= 0) {
        level++;
        newLevel();
      }
    }
  }

  function drawShape(
    shape,
    x,
    y,
    r,
    { fill, stroke, dash, scale = 1, rot = 0 },
  ) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(scale, scale);
    SHAPES[shape](r);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.setLineDash(dash ?? []);
      ctx.lineWidth = Math.max(3, r * 0.08);
      ctx.strokeStyle = stroke;
      ctx.lineJoin = "round";
      ctx.stroke();
    }
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    if (!targets.length) return;
    const r = layout.r;

    // tray background
    ctx.fillStyle = "#ffe8c2";
    ctx.beginPath();
    const trayArgs = [
      8,
      layout.divider,
      width - 16,
      height - layout.divider - 8,
    ];
    if (ctx.roundRect) ctx.roundRect(...trayArgs, 24);
    else ctx.rect(...trayArgs);
    ctx.fill();

    // outlines
    const hint = level <= 2;
    for (const t of targets) {
      const s = layout.targets[t.slot];
      const piece = pieces.find((p) => p.shape === t.shape);
      const filled = piece.state === "placed";
      if (!filled) {
        drawShape(t.shape, s.x, s.y, r, {
          fill: hint ? piece.color + "22" : "#00000010",
          stroke: hint ? piece.color : "#a8a29e",
          dash: [r * 0.18, r * 0.12],
        });
      }
    }

    // pieces
    for (const p of pieces) {
      const lifted = p.state === "drag";
      const scale = lifted ? 1.12 : 1 + Math.sin(p.pop * 15) * p.pop * 0.5;
      const rot = p.wiggle > 0 ? Math.sin(p.wiggle * 40) * 0.25 : 0;
      if (lifted) {
        drawShape(p.shape, p.x + 6, p.y + 10, r, { fill: "#00000022", scale });
      }
      drawShape(p.shape, p.x, p.y, r, {
        fill: p.color,
        stroke: "#ffffffaa",
        scale,
        rot,
      });
      if (p.state === "placed") {
        // a happy face on finished shapes
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(p.x - r * 0.22, p.y - r * 0.08, r * 0.08, 0, TAU);
        ctx.arc(p.x + r * 0.22, p.y - r * 0.08, r * 0.08, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = Math.max(2, r * 0.06);
        ctx.beginPath();
        ctx.arc(p.x, p.y + r * 0.05, r * 0.22, 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.stroke();
      }
    }

    for (const c of confetti) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.size / 2, -c.size / 4, c.size, c.size / 2);
      ctx.restore();
    }

    if (doneTimer > 0) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const s = 1 + Math.sin(time * 8) * 0.05;
      ctx.translate(width / 2, layout.divider + (height - layout.divider) / 2);
      ctx.scale(s, s);
      ctx.font = `bold ${Math.round(Math.min(width, 600) / 10)}px 'Roboto Mono', monospace`;
      ctx.lineWidth = 8;
      ctx.strokeStyle = "#fff";
      ctx.strokeText("Great job! ⭐", 0, 0);
      ctx.fillStyle = "#8b5cf6";
      ctx.fillText("Great job! ⭐", 0, 0);
      ctx.restore();
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  updateButtons();
  levelEl.textContent = `Level ${level}`;
  resize();
  startBtn.focus({ preventScroll: true });
  requestAnimationFrame(frame);

  // ---------- touch-screen kid-proofing ----------
  // Little hands tap fast and start swipes at the very edge of the screen. On
  // an iPhone that zooms the page, or swipes back through history mid-game.
  // style.css also sets `touch-action: manipulation` to stop double-tap zoom.
  let lastTouchEnd = 0;
  document.addEventListener(
    "touchend",
    (ev) => {
      // A second tap within 350 ms is a double tap: don't let it zoom. Links
      // and buttons are left alone so they still click.
      const onControl = ev.target.closest?.("a, button");
      if (ev.timeStamp - lastTouchEnd < 350 && !onControl) ev.preventDefault();
      lastTouchEnd = ev.timeStamp;
    },
    { passive: false },
  );
  // Safari's pinch zoom.
  document.addEventListener("gesturestart", (ev) => ev.preventDefault());
  document.addEventListener(
    "touchstart",
    (ev) => {
      // Safari's back/forward swipe starts with a touch at the very edge.
      const x = ev.touches[0]?.clientX ?? window.innerWidth / 2;
      const atEdge = x < 24 || x > window.innerWidth - 24;
      if (atEdge && !ev.target.closest?.("a, button")) ev.preventDefault();
    },
    { passive: false },
  );

  // Once a game starts, a back swipe that still gets through lands back on the
  // game instead of leaving it. The ← link still leaves.
  let guardingHistory = false;
  function guardHistory() {
    if (guardingHistory) return;
    guardingHistory = true;
    try {
      history.pushState({ inGame: true }, "");
      window.addEventListener("popstate", () =>
        history.pushState({ inGame: true }, ""),
      );
    } catch {
      // history unavailable
    }
  }

  // iPhones only let sound start from a finished tap (touchend or click), not
  // from pointerdown, so wake the audio on every finished tap and key press.
  function wakeAudio() {
    if (muted) return;
    try {
      audio ??= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state !== "running") audio.resume();
    } catch {
      // no audio
    }
    // Speech has the same rule: the first words must come from a finished tap.
    if (!speechReady && "speechSynthesis" in window) {
      speechReady = true;
      try {
        const u = new SpeechSynthesisUtterance(" ");
        u.volume = 0;
        speechSynthesis.speak(u);
      } catch {
        // no speech
      }
    }
  }
  for (const type of ["touchend", "click", "keydown"]) {
    document.addEventListener(type, wakeAudio, true);
  }
})();
