document.addEventListener("DOMContentLoaded", function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };

  var cake = $(".cake");
  var tapHint = $(".tap-hint");
  var chip = $("#chip");
  var chipN = $("#chipN");
  var meterWrap = $("#meterWrap");
  var meterFill = $("#meter i");
  var blowBtn = $("#blowBtn");
  var cta = $(".nav-button");
  var steps = Array.prototype.slice.call(document.querySelectorAll(".step"));

  // cake is drawn in a 340 x 280 box; candles stand on the top of the upper tier
  var VB_W = 340, VB_H = 280;
  var TOP = { cx: 170, cy: 108, rx: 60, ry: 14 };
  var THRESH = 40; //ETO CHANGEEEEEE (lower = easier to blow out)

  var candles = [];
  var audioContext, analyser, micActive = false, micStarted = false;
  var celebrated = false, audioUnlocked = false;
  var endlessTimer = null, stepTimer = null, fallbackTimer = null;
  var audio = new Audio("hbd.mp3");

  var PALETTE = ["#ff2d6f", "#ff8fb1", "#ffd6e4", "#ffffff", "#ffd166"];
  var heartShape = null;
  try {
    if (typeof confetti !== "undefined" && confetti.shapeFromPath) {
      heartShape = confetti.shapeFromPath({
        path: "M167 72c19,-38 37,-56 75,-56 42,0 76,33 76,75 0,76 -76,151 -151,227 -76,-76 -151,-151 -151,-227 0,-42 33,-75 75,-75 38,0 57,18 76,56z"
      });
    }
  } catch (e) { heartShape = null; }

  /* ---------- steps ---------- */
  function setSteps(current) {
    steps.forEach(function (s, i) {
      var n = i + 1;
      s.classList.toggle("done", n < current);
      s.classList.toggle("current", n === current);
      s.querySelector(".num").textContent = n < current ? "\u2713" : String(n);
    });
  }
  setSteps(1);

  /* ---------- candles ---------- */
  function litCount() {
    return candles.filter(function (c) { return !c.classList.contains("out"); }).length;
  }

  function updateUI() {
    var lit = litCount();
    chipN.textContent = lit;
    chip.classList.toggle("show", candles.length > 0);
    meterWrap.classList.toggle("show", micActive && lit > 0 && !celebrated);
  }

  function addCandleAt(vx, vy) {
    // snap to the top of the cake so candles always stand on the frosting
    var dx = (vx - TOP.cx) / TOP.rx, dy = (vy - TOP.cy) / TOP.ry;
    var r = Math.sqrt(dx * dx + dy * dy);
    if (r > 1) { dx /= r; dy /= r; }
    var x = TOP.cx + dx * TOP.rx, y = TOP.cy + dy * TOP.ry;

    var c = document.createElement("div");
    c.className = "candle c" + Math.floor(Math.random() * 4);
    c.style.left = (x / VB_W * 100) + "%";
    c.style.top = (y / VB_H * 100) + "%";
    c.style.zIndex = 10 + Math.round(y);
    c.innerHTML = '<i class="wick"></i><div class="glow"></div><div class="flame"></div><div class="smoke"></div>';
    cake.appendChild(c);
    candles.push(c);

    tapHint.classList.add("hide");
    if (celebrated) resetCelebration();
    setSteps(2);
    updateUI();
    armFallback();
  }

  cake.addEventListener("click", function (e) {
    var rect = cake.getBoundingClientRect();
    var vx = (e.clientX - rect.left) / rect.width * VB_W;
    var vy = (e.clientY - rect.top) / rect.height * VB_H;
    addCandleAt(vx, vy);
    wakeAudio();
    if (!micStarted) startMic(); // some phones only allow the mic after a tap
  });
  cake.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      addCandleAt(TOP.cx + (Math.random() - 0.5) * 2 * TOP.rx, TOP.cy + (Math.random() - 0.5) * 2 * TOP.ry);
      wakeAudio();
      if (!micStarted) startMic();
    }
  });

  /* ---------- blowing ---------- */
  function blowOut(force) {
    var lit = candles.filter(function (c) { return !c.classList.contains("out"); });
    if (!lit.length) return;
    lit.forEach(function (c) {
      if (force === true || Math.random() > 0.5) c.classList.add("out");
    });
    updateUI();
    if (candles.every(function (c) { return c.classList.contains("out"); })) celebrate();
  }

  function level() {
    var data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    var sum = 0;
    for (var i = 0; i < data.length; i++) sum += data[i];
    return sum / data.length;
  }

  function tick() {
    if (!analyser) return;
    var lv = level();
    meterFill.style.width = Math.min(100, lv / (THRESH * 2) * 100) + "%";
    if (litCount() > 0 && lv > THRESH) blowOut(false);
  }

  /* ---------- celebration ---------- */
  function rand(a, b) { return a + Math.random() * (b - a); }

  function triggerConfetti() {
    if (typeof confetti !== "function") return;
    confetti({
      particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: PALETTE,
      shapes: heartShape ? [heartShape, "circle"] : ["circle", "star"], scalar: heartShape ? 1.2 : 1
    });
  }

  function startEndless() {
    if (typeof confetti !== "function" || endlessTimer) return;
    var count = window.innerWidth < 768 ? 60 : 110;
    endlessTimer = setInterval(function () {
      confetti({
        particleCount: count, spread: 90, startVelocity: 28, origin: { x: rand(0.1, 0.9), y: 0 }, colors: PALETTE,
        shapes: heartShape ? [heartShape, "circle"] : ["circle", "star"], scalar: heartShape ? 1.2 : 1
      });
    }, 1000);
  }

  function celebrate() {
    if (celebrated) return;
    celebrated = true;
    clearTimeout(fallbackTimer);
    blowBtn.hidden = true;
    meterWrap.classList.remove("show");
    setSteps(3); // "Wait for it"
    setTimeout(triggerConfetti, 200);
    startEndless();
    var p = audio.play();
    if (p && p.catch) p.catch(function () {});
    stepTimer = setTimeout(function () {
      setSteps(4);
      cta.classList.add("ready");
    }, 2800);
  }

  function resetCelebration() {
    celebrated = false;
    clearTimeout(stepTimer);
    clearInterval(endlessTimer);
    endlessTimer = null;
    try { audio.pause(); audio.currentTime = 0; } catch (e) {}
    cta.classList.remove("ready");
  }

  /* ---------- audio unlock (phones block sound until the first tap) ---------- */
  function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    audio.muted = true;
    var p = audio.play();
    if (p && p.then) {
      p.then(function () { audio.pause(); audio.currentTime = 0; audio.muted = false; })
        .catch(function () { audio.muted = false; audioUnlocked = false; });
    } else {
      audio.muted = false;
    }
  }
  function wakeAudio() {
    if (audioContext && audioContext.state === "suspended") audioContext.resume();
    unlockAudio();
  }

  /* ---------- microphone ---------- */
  function armFallback() {
    // if blowing isn't working after a while, offer a tap button
    clearTimeout(fallbackTimer);
    fallbackTimer = setTimeout(function () {
      if (litCount() > 0 && !celebrated) blowBtn.hidden = false;
    }, 15000);
  }

  function micFailed() {
    micActive = false;
    blowBtn.hidden = false;
    updateUI();
  }

  function startMic() {
    var md = navigator.mediaDevices;
    if (!md || !md.getUserMedia) { micFailed(); return; }
    micStarted = true;
    md.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } })
      .then(function (stream) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        audioContext.createMediaStreamSource(stream).connect(analyser);
        if (audioContext.state === "suspended") audioContext.resume();
        micActive = true;
        setInterval(tick, 120);
        updateUI();
      })
      .catch(function (err) {
        micStarted = false;
        console.log("Unable to access microphone: " + err);
        micFailed();
      });
  }

  blowBtn.addEventListener("click", function () {
    wakeAudio();
    blowOut(true);
  });

  startMic();

  /* ---------- floating hearts in the background ---------- */
  var floatBox = $(".float");
  var HEART = "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";
  var NS = "http://www.w3.org/2000/svg";
  var n = window.innerWidth < 600 ? 10 : 16;
  for (var i = 0; i < n; i++) {
    var s = document.createElementNS(NS, "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("class", "fh");
    var size = rand(12, 30);
    s.style.width = size + "px";
    s.style.height = size + "px";
    s.style.left = rand(0, 100) + "%";
    s.style.animationDuration = rand(12, 24) + "s";
    s.style.animationDelay = (-rand(0, 20)) + "s";
    var p = document.createElementNS(NS, "path");
    p.setAttribute("d", HEART);
    s.appendChild(p);
    floatBox.appendChild(s);
  }

  /* ---------- page transition ---------- */
  document.querySelectorAll("a[href]").forEach(function (link) {
    link.addEventListener("click", function (e) {
      var href = this.getAttribute("href");
      if (href && href.charAt(0) !== "#" && href.indexOf("javascript") !== 0) {
        e.preventDefault();
        document.body.classList.add("fade-out");
        setTimeout(function () { window.location.href = href; }, 600);
      }
    });
  });
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) document.body.classList.remove("fade-out");
  });
});
