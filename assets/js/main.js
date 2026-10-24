/* Portfolio behaviour: theme, menu, split-word reveals, counted stats,
   a request diagram that keeps running, brand tooltips, shuffleable
   principles and a scrollbar that reacts to scrolling. No dependencies.
   Everything degrades to a fully legible page when JS is absent
   (CSS gates all motion on :root.js). */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var raf = window.requestAnimationFrame.bind(window);

  /* ---- Theme ------------------------------------------------ */
  var STORAGE_KEY = "dp-theme";
  var toggle = document.getElementById("theme-toggle");
  var themeLabel = document.getElementById("theme-label");

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    if (themeLabel) themeLabel.textContent = theme === "dark" ? "DARK" : "LIGHT";
    if (toggle) {
      toggle.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#0c0b0a" : "#f2efe9");
  }

  applyTheme(root.getAttribute("data-theme") === "light" ? "light" : "dark");

  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
      try { localStorage.setItem(STORAGE_KEY, next); } catch (e) {}
    });
  }

  /* ---- Menu overlay ----------------------------------------- */
  var menuBtn = document.getElementById("menu-toggle");
  var menu = document.getElementById("menu");

  var menuClock = null;

  function setMenu(open) {
    if (!menu || !menuBtn) return;
    menu.hidden = !open;
    menuBtn.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("menu-open", open);
    document.body.style.overflow = open ? "hidden" : "";

    // Restart the row entrance every time it opens.
    menu.classList.remove("is-open");
    if (open) {
      void menu.offsetWidth;
      menu.classList.add("is-open");
    }

    var clock = document.getElementById("menu-clock");
    if (clock) {
      if (menuClock) { window.clearInterval(menuClock); menuClock = null; }
      if (open) {
        var tick = function () {
          var d = new Date();
          function p(n) { return ("0" + n).slice(-2); }
          clock.textContent = p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
        };
        tick();
        menuClock = window.setInterval(tick, 1000);
      }
    }
  }

  if (menuBtn && menu) {
    menuBtn.addEventListener("click", function () {
      setMenu(menu.hidden);
    });
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) setMenu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !menu.hidden) setMenu(false);
    });
  }

  /* ---- Split headings into words ---------------------------- */
  Array.prototype.forEach.call(document.querySelectorAll("[data-split]"), function (el) {
    var words = el.textContent.trim().split(/\s+/);
    el.textContent = "";
    words.forEach(function (word, i) {
      var span = document.createElement("span");
      span.className = "w";
      span.style.setProperty("--i", i);
      span.textContent = word;
      el.appendChild(span);
      if (i < words.length - 1) el.appendChild(document.createTextNode(" "));
    });
  });

  /* ---- Counted stats ---------------------------------------- */
  /* The numbers are the claim, so they get counted rather than dropped
     in: 7 years should take a moment to arrive. */
  function countUp(el) {
    var raw = el.getAttribute("data-count") || el.textContent;
    var target = parseInt(raw, 10);
    var suffix = raw.replace(/[0-9]/g, "");
    if (reduced || !target) { el.textContent = raw; return; }

    var started = null;
    raf(function step(now) {
      if (started === null) started = now;
      var p = Math.min(1, (now - started) / 900);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + (p === 1 ? suffix : "");
      if (p < 1) raf(step);
    });
  }

  /* ---- Reveal on enter -------------------------------------- */
  /* Siblings stagger, so a list arrives as a list and not as a slab. */
  Array.prototype.forEach.call(document.querySelectorAll(".up"), function (el) {
    var sibs = el.parentNode ? el.parentNode.querySelectorAll(":scope > .up") : [];
    var i = Array.prototype.indexOf.call(sibs, el);
    if (i > 0) el.style.transitionDelay = Math.min(i * 70, 350) + "ms";
  });

  var targets = document.querySelectorAll("[data-split], .up");

  function reveal(el) {
    el.classList.add("is-in");
    Array.prototype.forEach.call(el.querySelectorAll("[data-count]"), countUp);
  }

  if (!("IntersectionObserver" in window)) {
    Array.prototype.forEach.call(targets, reveal);
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        reveal(entry.target);
        io.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.1 });

    Array.prototype.forEach.call(targets, function (el) { io.observe(el); });
  }

  /* Each section sews its own top edge shut as it comes into view. */
  if ("IntersectionObserver" in window) {
    var seamIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-seam");
        seamIo.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -4% 0px", threshold: 0 });
    Array.prototype.forEach.call(document.querySelectorAll(".band"), function (el) {
      seamIo.observe(el);
    });
  } else {
    Array.prototype.forEach.call(document.querySelectorAll(".band"), function (el) {
      el.classList.add("is-seam");
    });
  }

  /* ---- The mark retypes itself ------------------------------- */
  /* It says hello while you are at the top, then erases itself and
     types his name once you start reading. Going back up reverses it. */
  var hudName = document.getElementById("hud-name");
  var GREETING = "HEY THERE";
  var FULL_NAME = "Dhamodaran Pandiyan";
  var markWant = GREETING;
  var markBusy = false;

  function retype(target) {
    if (!hudName || markBusy) return;
    if (hudName.textContent === target) return;
    if (reduced) { hudName.textContent = target; return; }

    markBusy = true;
    var text = hudName.textContent;

    (function erase() {
      if (text.length > 0) {
        text = text.slice(0, -1);
        hudName.textContent = text;
        window.setTimeout(erase, 26);
        return;
      }
      var k = 0;
      (function type() {
        if (k < target.length) {
          k++;
          hudName.textContent = target.slice(0, k);
          window.setTimeout(type, 45);
          return;
        }
        markBusy = false;
        // The intent may have changed while it was typing.
        if (hudName.textContent !== markWant) retype(markWant);
      })();
    })();
  }

  function wantMark(text) {
    if (text === markWant) return;
    markWant = text;
    retype(text);
  }

  /* Which name shows depends on whether the landing has been left behind.
     Measured from the element's own rect, so it holds on any viewport. */
  var markHero = document.getElementById("hero");

  function markForScroll() {
    if (!hudName || !markHero) return;
    var r = markHero.getBoundingClientRect();
    wantMark(r.bottom < window.innerHeight * 0.55 ? FULL_NAME : GREETING);
  }

  /* ---- The notes --------------------------------------------- */
  /* Each one fires once, when its section first comes into view. */
  var hints = document.querySelectorAll("[data-hint]");

  /* A note is put against the block it is about: above it, or beside it
     when there is room, with the arrow turned to face it. */
  function aimHint(el) {
    var sel = el.getAttribute("data-hint");
    if (!sel) return;                       // the landing note places itself
    var band = el.parentNode;
    var target = band.querySelector(sel);
    if (!target) return;

    var side = el.getAttribute("data-hint-side") || "top";
    var bandBox = band.getBoundingClientRect();
    var targetBox = target.getBoundingClientRect();

    el.classList.remove("hint--down", "hint--left", "hint--right");
    el.classList.add(side === "left" ? "hint--right" :
                     side === "right" ? "hint--left" :
                     side === "bottom" ? "hint--up" : "hint--down");

    // Measure the note itself before deciding where its corner goes.
    var noteBox = el.getBoundingClientRect();
    var x, y;

    if (side === "left") {
      // Note sits to the left of the block, arrow reaching right.
      x = targetBox.left - bandBox.left - noteBox.width - 2;
      y = targetBox.top - bandBox.top + 12;
    } else if (side === "right") {
      x = targetBox.right - bandBox.left + 2;
      y = targetBox.top - bandBox.top + 12;
    } else if (side === "bottom") {
      // Under the block, arrow reaching back up at it.
      x = targetBox.right - bandBox.left - noteBox.width + 26;
      y = targetBox.bottom - bandBox.top + 2;
    } else if (side === "inside") {
      // Blocks with room to spare take the note in their own top corner.
      x = targetBox.right - bandBox.left - noteBox.width - 10;
      y = targetBox.top - bandBox.top + 8;
    } else {
      // Directly above it, arrow tip overlapping the block's own edge.
      x = targetBox.right - bandBox.left - noteBox.width + 26;
      y = targetBox.top - bandBox.top - noteBox.height + 4;
    }

    // Never let a note fall outside its own section.
    x = Math.max(8, Math.min(x, bandBox.width - noteBox.width - 8));
    y = Math.max(4, y);

    el.style.left = Math.round(x) + "px";
    el.style.top = Math.round(y) + "px";
  }

  var NOTE_HOLD = 7000;

  function showHint(el) {
    aimHint(el);
    el.classList.remove("is-faded");
    el.classList.add("is-on");
    if (el.fadeTimer) window.clearTimeout(el.fadeTimer);
    // It has had its say in accent. From here it is just a grey note.
    el.fadeTimer = window.setTimeout(function () {
      el.fadeTimer = null;
      el.classList.add("is-faded");
    }, NOTE_HOLD);
  }

  if (hints.length && !reduced) {
    if (!("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(hints, function (el) { showHint(el); });
    } else {
      var hintIo = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var el = entry.target;

          if (!entry.isIntersecting) {
            // Cleared on the way out so it plays again on the way back.
            el.classList.remove("is-on");
            el.classList.remove("is-faded");
            if (el.hintTimer) { window.clearTimeout(el.hintTimer); el.hintTimer = null; }
            if (el.fadeTimer) { window.clearTimeout(el.fadeTimer); el.fadeTimer = null; }
            return;
          }

          if (el.classList.contains("is-on") || el.hintTimer) return;
          // The landing one waits for the name to finish arriving.
          el.hintTimer = window.setTimeout(function () {
            el.hintTimer = null;
            showHint(el);
          }, el.id === "hero-hint" ? 1400 : 350);
        });
      }, { threshold: 0.25 });
      Array.prototype.forEach.call(hints, function (el) { hintIo.observe(el); });
    }

    window.addEventListener("resize", function () {
      Array.prototype.forEach.call(hints, function (el) {
        if (el.classList.contains("is-on")) aimHint(el);
      });
    }, { passive: true });
  }

  /* ---- HUD rail --------------------------------------------- */
  var railTicks = document.getElementById("rail-ticks");
  var railPct = document.getElementById("rail-pct");
  var TICKS = 22;
  var tickEls = [];

  if (railTicks) {
    for (var i = 0; i < TICKS; i++) {
      var tick = document.createElement("span");
      railTicks.appendChild(tick);
      tickEls.push(tick);
    }
  }

  /* ---- Hero name -------------------------------------------- */
  /* The name is set letter by letter so it can climb into place on
     arrival and then answer the pointer, one letter at a time. */
  var title = document.getElementById("hero-title");
  var hero = document.getElementById("hero");
  var chars = [];

  var charLine = [];

  if (title) {
    var index = 0;
    Array.prototype.forEach.call(title.querySelectorAll(".hero__line"), function (line, lineNo) {
      var text = line.getAttribute("data-line") || line.textContent;
      line.textContent = "";
      text.split("").forEach(function (letter) {
        var span = document.createElement("span");
        span.className = "hero__ch";
        span.style.setProperty("--i", index++);
        span.textContent = letter;
        line.appendChild(span);
        chars.push(span);
        // Each line is its own band of rubber. A pull on one never
        // reaches the other.
        charLine.push(lineNo);
      });
    });

    requestAnimationFrame(function () {
      title.classList.add("is-in");
    });
    window.setTimeout(function () {
      title.classList.add("is-ready");
    }, reduced ? 0 : 600 + chars.length * 42);
  }

  /* Slingshot letters: grab one and the two letters beside it turn into
     poles with a band strung between them. Let go and the letter is fired
     across the hero under gravity, and whatever it lands on takes the
     damage. Three hits and a letter bursts apart, then puts itself back
     together. */
  /* Kept in a scope of its own: the game holds a lot of state and none
     of it belongs to the rest of the page. */
  if (title && chars.length && !reduced && hero) (function () {
    var REST = 0, HELD = 1, FREE = 2, HOMING = 3, GONE = 4;

    var STEP = 1 / 120;     // fixed physics tick, in seconds
    var GRAV = 2300;        // px per second, per second
    var AIR = 0.9;          // drag on a letter, per second
    var WALL_E = 0.42;      // bounce off the edges of the hero
    var PAIR_E = 0.34;      // bounce between two letters
    var FLOOR_MU = 0.82;    // how much a landing scrubs off sideways speed
    var SPIN_DRAG = 1.7;
    var BAND_K = 9.4;       // band stiffness: pull in px to speed in px/s
    var MAX_PULL = 210;
    var GRAB_RANGE = 64;
    var HOVER_RANGE = 120;
    var HIT_SPEED = 90;     // anything softer does not even raise dust
    /* What an impact has to be worth to leave a mark, as a share of a
       letter of average weight taking the whole band at full stretch.
       Reading the work rather than the speed is what keeps a small letter
       from doing a big one's damage. */
    var HIT_WORK = 0.22;
    var HIT_GAP = 170;      // ms before the same letter can be hit again
    var FREE_MAX = 1800;    // ms a loose letter is left to its own devices
    var SETTLE_V = 60;
    var KNOCK_V = 50;       // below this two letters are only leaning
    var OMEGA = 15;         // spring rate on the way home
    var ZETA = 0.5;
    var MAX_STRETCH = 0.34;
    var BREAK_AT = 3;
    var REFORM = 1500;      // ms a broken letter stays in pieces
    var REPAIR = 7000;      // ms of quiet before one crack closes again

    /* Two layers of canvas: the band is strung behind the name, and every
       piece of the impact is thrown in front of it. */
    var backCv = document.createElement("canvas");
    backCv.className = "sling sling--back";
    backCv.setAttribute("aria-hidden", "true");
    var frontCv = document.createElement("canvas");
    frontCv.className = "sling sling--front";
    frontCv.setAttribute("aria-hidden", "true");
    hero.insertBefore(backCv, title);
    hero.appendChild(frontCv);
    var bg = backCv.getContext("2d");
    var fg = frontCv.getContext("2d");

    var state = chars.map(function () {
      return {
        x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0,
        mode: REST, heat: -1, hits: 0,
        freeAt: 0, calm: 0, lastHit: -9999, healT: 0, cracks: []
      };
    });

    var homes = [];
    var rads = [];
    var mass = [];
    var massRef = 1;
    var heroBox = { x: 0, y: 0, w: 0, h: 0 };
    var dpr = 1;

    /* ---- ink ---- */
    var inkText = [236, 231, 223];
    var inkAccent = [255, 82, 51];
    var accentCss = "rgb(255,82,51)";
    var textCss = "rgb(236,231,223)";
    var dustCss = [140, 138, 132];

    function parseInk(value) {
      if (!value) return null;
      value = value.trim();
      if (value.charAt(0) === "#") {
        var h = value.slice(1);
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        var n = parseInt(h, 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      }
      var m = value.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
      return m ? [+m[1], +m[2], +m[3]] : null;
    }

    function readInk() {
      var cs = getComputedStyle(root);
      inkText = parseInk(cs.getPropertyValue("--text")) || inkText;
      inkAccent = parseInk(cs.getPropertyValue("--accent")) || inkAccent;
      accentCss = "rgb(" + inkAccent.join(",") + ")";
      textCss = "rgb(" + inkText.join(",") + ")";
      /* Dust sits halfway between the ink and the paper, so it reads as
         smoke on a dark page and as chalk on a light one. */
      var bg2 = parseInk(cs.getPropertyValue("--bg")) || [12, 11, 10];
      dustCss = [
        Math.round((inkText[0] + bg2[0]) / 2),
        Math.round((inkText[1] + bg2[1]) / 2),
        Math.round((inkText[2] + bg2[2]) / 2)
      ];
    }

    function mixInk(heat) {
      var r = Math.round(inkText[0] + (inkAccent[0] - inkText[0]) * heat);
      var g = Math.round(inkText[1] + (inkAccent[1] - inkText[1]) * heat);
      var b = Math.round(inkText[2] + (inkAccent[2] - inkText[2]) * heat);
      return "rgb(" + r + "," + g + "," + b + ")";
    }

    function accentA(a) { return "rgba(" + inkAccent.join(",") + "," + a + ")"; }
    function textA(a) { return "rgba(" + inkText.join(",") + "," + a + ")"; }
    function dustA(a) { return "rgba(" + dustCss.join(",") + "," + a + ")"; }

    readInk();
    if (toggle) toggle.addEventListener("click", function () {
      readInk();
      state.forEach(function (p) { p.heat = -1; });
    });

    /* ---- geometry ---- */
    function sizeCanvas() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      [backCv, frontCv].forEach(function (cv) {
        cv.width = Math.max(1, Math.round(heroBox.w * dpr));
        cv.height = Math.max(1, Math.round(heroBox.h * dpr));
      });
      bg.setTransform(dpr, 0, 0, dpr, 0, 0);
      fg.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /* Homes are held in hero space, so scrolling never moves the board.
       The transforms come off for the read and go straight back on. */
    function measure() {
      var kept = chars.map(function (el) {
        var t = el.style.transform;
        el.style.transform = "";
        return t;
      });
      var hr = hero.getBoundingClientRect();
      heroBox.x = hr.left; heroBox.y = hr.top;
      heroBox.w = hr.width; heroBox.h = hr.height;
      for (var i = 0; i < chars.length; i++) {
        var r = chars[i].getBoundingClientRect();
        homes[i] = {
          x: r.left - hr.left + r.width / 2,
          y: r.top - hr.top + r.height / 2
        };
        rads[i] = {
          x: Math.max(5, r.width * 0.40),
          y: Math.max(5, r.height * 0.40)
        };
        mass[i] = Math.max(0.35, (r.width * r.height) / 2600);
      }
      var sorted = mass.slice().sort(function (a, b) { return a - b; });
      massRef = sorted[sorted.length >> 1] || 1;
      chars.forEach(function (el, i) { if (kept[i]) el.style.transform = kept[i]; });
      sizeCanvas();
    }

    function heroPos() {
      var hr = hero.getBoundingClientRect();
      heroBox.x = hr.left; heroBox.y = hr.top;
      if (Math.abs(hr.width - heroBox.w) > 1 || Math.abs(hr.height - heroBox.h) > 1) measure();
    }

    measure();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    window.setTimeout(measure, 700 + chars.length * 42);

    /* ---- what an impact throws off ---- */
    var trail = [];    // the dotted line a shot leaves behind it
    var shake = { mag: 0, x: 0, y: 0 };
    var sparks = [];   // hot slivers, thrown along the blow
    var chips = [];    // splinters knocked off the letter
    var puffs = [];    // dust, which hangs and drifts
    var rings = [];    // the ring of air leaving the hit
    var shards = [];   // a broken letter, in pieces of its own outline

    function rand(a, b) { return a + Math.random() * (b - a); }

    /* One hit throws all four kinds at once, aimed along the blow and
       spread wider the harder it landed. */
    function burst(x, y, nx, ny, power) {
      var force = Math.max(0.35, Math.min(2.2, power));
      var base = Math.atan2(ny, nx);
      var n = Math.round(6 + 8 * force);
      var i;

      for (i = 0; i < n; i++) {
        var a = base + rand(-1.1, 1.1);
        var s = rand(150, 470) * force;
        sparks.push({
          x: x, y: y,
          vx: Math.cos(a) * s, vy: Math.sin(a) * s - rand(0, 110),
          life: 0, max: rand(0.2, 0.42), w: rand(1, 2)
        });
      }

      n = Math.round(3 + 4 * force);
      for (i = 0; i < n; i++) {
        var ca = base + rand(-1.5, 1.5);
        var cs = rand(80, 300) * force;
        chips.push({
          x: x, y: y,
          vx: Math.cos(ca) * cs, vy: Math.sin(ca) * cs - rand(50, 200),
          rot: rand(0, 6.28), vr: rand(-11, 11),
          w: rand(3, 7), h: rand(2, 4),
          life: 0, max: rand(0.6, 1.1),
          hot: i % 3 === 0
        });
      }

      n = Math.round(3 + 4 * force);
      for (i = 0; i < n; i++) {
        puffs.push({
          x: x + rand(-16, 16), y: y + rand(-16, 16),
          vx: rand(-70, 70) + nx * 60 * force, vy: rand(-90, -20),
          r: rand(6, 14), grow: rand(30, 62),
          life: 0, max: rand(0.5, 0.95)
        });
      }

      if (force > 0.7) {
        rings.push({ x: x, y: y, r: 6, grow: 260 + 260 * force, life: 0, max: 0.26 });
      }
      // The hero itself takes the knock, briefly.
      shake.mag = Math.min(10, Math.max(shake.mag, 2.5 + 4 * force));
    }

    /* A letter on its third hit comes apart along its own outline: the
       glyph is drawn again inside every piece, so the bits still read as
       the letter they came from. */
    function breakUp(i, nx, ny, power) {
      var p = state[i];
      var el = chars[i];
      var cs = getComputedStyle(el);
      var font = cs.fontStyle + " " + cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
      var strokeW = parseFloat(cs.webkitTextStrokeWidth) || 0;
      var strokeCol = cs.webkitTextStrokeColor || textCss;
      var fill = cs.color;
      var hollow = charLine[i] === 1 || /rgba\([^)]*,\s*0\s*\)/.test(fill);

      var cx = homes[i].x + p.x;
      var cy = homes[i].y + p.y;
      var hw = rads[i].x;
      var hh = rads[i].y;
      var reach = Math.sqrt(hw * hw + hh * hh) * 1.6;

      // The break starts where it was struck and runs outward in wedges.
      var ix = -nx * hw * 0.5;
      var iy = -ny * hh * 0.5;
      var n = 7 + Math.floor(Math.random() * 4);
      var a0 = Math.random() * Math.PI * 2;
      var edges = [];
      var k, s;
      for (k = 0; k < n; k++) {
        edges.push(a0 + (k / n) * Math.PI * 2 + rand(-0.4, 0.4) / n * Math.PI);
      }
      edges.sort(function (a, b) { return a - b; });

      for (k = 0; k < n; k++) {
        var a1 = edges[k];
        var a2 = k + 1 < n ? edges[k + 1] : edges[0] + Math.PI * 2;
        var poly = [[ix, iy]];
        var segs = 3;
        for (s = 0; s <= segs; s++) {
          var a = a1 + (a2 - a1) * (s / segs);
          var rr = reach * rand(0.86, 1.18);
          poly.push([ix + Math.cos(a) * rr, iy + Math.sin(a) * rr]);
        }
        // Spun about its own middle so a piece tumbles rather than orbits.
        var gx = 0, gy = 0;
        for (s = 0; s < poly.length; s++) { gx += poly[s][0]; gy += poly[s][1]; }
        gx /= poly.length; gy /= poly.length;

        var mid = (a1 + a2) / 2;
        var out = 110 + 230 * Math.max(0.4, Math.min(2, power));
        shards.push({
          poly: poly, gx: gx, gy: gy,
          x: cx + gx, y: cy + gy,
          vx: p.vx * 0.32 + Math.cos(mid) * out * rand(0.6, 1.25) + nx * 80,
          vy: p.vy * 0.32 + Math.sin(mid) * out * rand(0.6, 1.25) - rand(80, 260),
          rot: p.rot, vr: rand(-11, 11),
          ch: el.textContent, font: font, hollow: hollow,
          fill: fill, stroke: strokeCol, strokeW: strokeW,
          life: 0, max: rand(1.1, 1.7)
        });
      }

      burst(cx, cy, nx, ny, power * 1.15);
      for (k = 0; k < 6; k++) {
        puffs.push({
          x: cx + rand(-hw, hw), y: cy + rand(-hh, hh),
          vx: rand(-110, 110), vy: rand(-120, -30),
          r: rand(8, 15), grow: rand(40, 70),
          life: 0, max: rand(0.6, 1)
        });
      }
      rings.push({ x: cx, y: cy, r: 10, grow: 520, life: 0, max: 0.32 });

      p.mode = GONE;
      p.vx = p.vy = p.vr = 0;
      p.cracks.length = 0;
      if (p.healT) { window.clearTimeout(p.healT); p.healT = 0; }
      el.style.opacity = "0";
      el.style.transform = "";
      window.setTimeout(function () { reform(i); }, REFORM);
    }

    function reform(i) {
      var p = state[i];
      if (p.mode !== GONE) return;
      p.x = p.y = p.vx = p.vy = p.rot = p.vr = 0;
      p.hits = 0; p.heat = -1;
      p.mode = REST;
      chars[i].style.opacity = "";
      chars[i].style.transform = "";
      chars[i].classList.add("is-back");
      window.setTimeout(function () { chars[i].classList.remove("is-back"); }, 520);
      wake();
    }

    /* ---- damage ---- */
    /* Left alone, a letter closes one crack at a time. Three hits in a
       rally still break it. Three hits spread across an afternoon do not,
       so the name is never left standing in ruins. */
    function heal(i) {
      var p = state[i];
      p.healT = 0;
      if (p.mode === GONE || !p.hits) return;
      var since = performance.now() - p.lastHit;
      if (since < REPAIR - 20) {
        p.healT = window.setTimeout(function () { heal(i); }, REPAIR - since);
        return;
      }
      p.hits--;
      p.cracks.length = p.hits ? Math.max(0, p.cracks.length - 4) : 0;
      p.heat = -1;
      if (p.hits) p.healT = window.setTimeout(function () { heal(i); }, REPAIR);
      wake();
    }

    function damage(i, nx, ny, power) {
      var p = state[i];
      var now = performance.now();
      if (p.mode === GONE || now - p.lastHit < HIT_GAP) return;
      p.lastHit = now;
      p.hits++;

      var hx = homes[i].x + p.x - nx * rads[i].x * 0.8;
      var hy = homes[i].y + p.y - ny * rads[i].y * 0.8;

      if (p.hits >= BREAK_AT) { breakUp(i, nx, ny, power); return; }

      if (p.healT) window.clearTimeout(p.healT);
      p.healT = window.setTimeout(function () { heal(i); }, REPAIR);

      // Cracks are kept in the letter box, so they ride along with it.
      var c = Math.cos(-p.rot), s = Math.sin(-p.rot);
      var ox = -nx * 0.72, oy = -ny * 0.72;
      var lx = ox * c - oy * s;
      var ly = ox * s + oy * c;
      var n = 2 + Math.round(Math.random() * 2) + p.hits;
      for (var k = 0; k < n; k++) {
        p.cracks.push({
          x: lx, y: ly,
          a: Math.atan2(ny, nx) + Math.PI + rand(-1.5, 1.5),
          len: rand(0.55, 1.5),
          kink: rand(-0.22, 0.22),
          w: rand(1.4, 2.6)
        });
      }
      burst(hx, hy, nx, ny, power);
    }

    /* ---- the loop ---- */
    var pointer = { x: -9999, y: -9999 };
    var held = -1;
    var grab = { x: 0, y: 0 };
    var poles = [-1, -1];
    var live = false, looping = false, lastT = 0, acc = 0;

    function nearest(px, py) {
      var best = -1;
      var bestD = GRAB_RANGE * GRAB_RANGE;
      for (var i = 0; i < chars.length; i++) {
        if (state[i].mode === GONE) continue;
        var dx = px - (homes[i].x + state[i].x);
        var dy = py - (homes[i].y + state[i].y);
        var d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = i; }
      }
      return best;
    }

    /* The nearest standing letter on each side takes the band. */
    function findPoles(i) {
      var out = [-1, -1];
      var line = charLine[i];
      var k;
      for (k = i - 1; k >= 0; k--) {
        if (charLine[k] !== line) break;
        if (state[k].mode !== GONE) { out[0] = k; break; }
      }
      for (k = i + 1; k < chars.length; k++) {
        if (charLine[k] !== line) break;
        if (state[k].mode !== GONE) { out[1] = k; break; }
      }
      // A letter on the end borrows the next one along, so the band always
      // has two poles to hang from.
      if (out[0] < 0) {
        for (k = i + 1; k < chars.length; k++) {
          if (charLine[k] !== line) break;
          if (k !== out[1] && state[k].mode !== GONE) { out[0] = k; break; }
        }
      }
      if (out[1] < 0) {
        for (k = i - 1; k >= 0; k--) {
          if (charLine[k] !== line) break;
          if (k !== out[0] && state[k].mode !== GONE) { out[1] = k; break; }
        }
      }
      return out;
    }

    function pullVec() {
      var p = state[held];
      return { x: p.x, y: p.y, len: Math.sqrt(p.x * p.x + p.y * p.y) };
    }

    /* A heavier letter leaves the band slower, which is the only honest
       way to read one spring against different weights. */
    function launchVel(i, pl) {
      if (pl.len < 1) return { x: 0, y: 0 };
      var gain = BAND_K * Math.sqrt(massRef / mass[i]);
      return { x: -pl.x * gain, y: -pl.y * gain };
    }

    function step(h) {
      var i, p;

      for (i = 0; i < chars.length; i++) {
        p = state[i];
        if (p.mode === GONE || p.mode === HELD) continue;

        if (p.mode === FREE) {
          p.vy += GRAV * h;
          p.vx -= p.vx * AIR * h;
          p.vy -= p.vy * AIR * h;
          p.x += p.vx * h;
          p.y += p.vy * h;
          p.rot += p.vr * h;
          p.vr -= p.vr * SPIN_DRAG * h;
          walls(i);

          var fast = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          p.dot = (p.dot || 0) + h;
          if (fast > 420 && p.dot > 0.065) {
            p.dot = 0;
            trail.push({ x: homes[i].x + p.x, y: homes[i].y + p.y, life: 0, max: 0.85 });
            if (trail.length > 180) trail.shift();
          }

          var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          p.calm = sp < SETTLE_V ? p.calm + h : 0;
          if (p.calm > 0.4 || performance.now() - p.freeAt > FREE_MAX) {
            p.mode = HOMING;
            p.calm = 0;
          }
        } else {
          // Rest and the walk home run on the same spring, aimed at
          // whatever the letter is meant to be doing.
          var tx = 0, ty = 0;
          if (p.mode === REST && held >= 0 && (i === poles[0] || i === poles[1])) {
            // A pole leans under the tension it is holding.
            var pl = pullVec();
            var lean = Math.min(11, pl.len / 19);
            var hp = state[held];
            var dx = (homes[held].x + hp.x) - homes[i].x;
            var dy = (homes[held].y + hp.y) - homes[i].y;
            var dl = Math.sqrt(dx * dx + dy * dy) || 1;
            tx = dx / dl * lean;
            ty = dy / dl * lean;
          } else if (p.mode === REST && held < 0 && pointer.x > -9000) {
            var mx = pointer.x - homes[i].x;
            var my = pointer.y - homes[i].y;
            var md = Math.sqrt(mx * mx + my * my);
            if (md < HOVER_RANGE) ty = -2.5 * (1 - md / HOVER_RANGE);
          }
          p.vx += (-OMEGA * OMEGA * (p.x - tx) - 2 * ZETA * OMEGA * p.vx) * h;
          p.vy += (-OMEGA * OMEGA * (p.y - ty) - 2 * ZETA * OMEGA * p.vy) * h;
          p.x += p.vx * h;
          p.y += p.vy * h;
          p.vr += (-OMEGA * OMEGA * p.rot - 1.4 * OMEGA * p.vr) * h;
          p.rot += p.vr * h;

          if (p.mode === HOMING) {
            var off = Math.sqrt(p.x * p.x + p.y * p.y);
            var v = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
            if (off < 0.5 && v < 8 && Math.abs(p.rot) < 0.01) {
              p.x = p.y = p.vx = p.vy = p.rot = p.vr = 0;
              p.mode = REST;
            }
          }
        }
      }

      for (i = 0; i < chars.length; i++) {
        if (state[i].mode !== FREE) continue;
        for (var j = 0; j < chars.length; j++) {
          if (j === i) continue;
          var m = state[j].mode;
          if (m === GONE || m === HELD) continue;
          if (m === FREE && j < i) continue;   // each pair once
          bump(i, j);
        }
      }

      moveDebris(h);
    }

    function walls(i) {
      var p = state[i];
      var cx = homes[i].x + p.x;
      var cy = homes[i].y + p.y;
      var rx = rads[i].x, ry = rads[i].y;
      var blow = 0;

      if (cx - rx < 0) {
        p.x -= (cx - rx);
        blow = Math.abs(p.vx);
        p.vx = Math.abs(p.vx) * WALL_E;
      } else if (cx + rx > heroBox.w) {
        p.x -= (cx + rx - heroBox.w);
        blow = Math.abs(p.vx);
        p.vx = -Math.abs(p.vx) * WALL_E;
      }

      if (cy + ry > heroBox.h && p.vy > 0) {
        p.y -= (cy + ry - heroBox.h);
        blow = Math.max(blow, Math.abs(p.vy));
        p.vy = -p.vy * WALL_E;
        p.vx *= FLOOR_MU;
        p.vr = p.vr * 0.7 - p.vx * 0.004;
        if (blow > 380) burst(homes[i].x + p.x, heroBox.h - 2, 0, -1, blow / 900);
      }
      if (blow > 260) p.vr += rand(-4, 4);
    }

    /* Which pairs are touching right now. A pair that stays in contact
       counts as one blow, not one for every tick it spends there. */
    var touching = {};

    /* Two letters as ellipses. The space is squashed until both read as
       circles, which keeps the normal honest for tall glyphs. */
    function bump(i, j) {
      var A = state[i], B = state[j];
      var key = i < j ? i * 64 + j : j * 64 + i;
      var ax = homes[i].x + A.x, ay = homes[i].y + A.y;
      var bx = homes[j].x + B.x, by = homes[j].y + B.y;
      var sx = rads[i].x + rads[j].x, sy = rads[i].y + rads[j].y;
      var dx = bx - ax, dy = by - ay;
      var ux = dx / sx, uy = dy / sy;
      var d = Math.sqrt(ux * ux + uy * uy);
      if (d === 0 || d >= 1) { touching[key] = 0; return; }
      var fresh = !touching[key];
      touching[key] = 1;

      var dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
      var nx = ux / sx, ny = uy / sy;
      var nl = Math.sqrt(nx * nx + ny * ny) || 1;
      nx /= nl; ny /= nl;

      var pen = Math.min(Math.min(sx, sy) * 0.5, dist * (1 - d) / d);
      var iA = 1 / mass[i], iB = 1 / mass[j];
      var sum = iA + iB;

      var rvx = B.vx - A.vx, rvy = B.vy - A.vy;
      var vn = rvx * nx + rvy * ny;

      // They are pushed apart whatever they are doing, so nothing ever
      // ends up sitting inside anything else.
      var shove = pen * 0.7;
      A.x -= nx * shove * (iA / sum);
      A.y -= ny * shove * (iA / sum);
      B.x += nx * shove * (iB / sum);
      B.y += ny * shove * (iB / sum);

      /* Parting, or merely leaning on each other, is not a blow. Letters
         piled on the floor lean all the time, and if that counted they
         would hold each other down for good and the name would never
         stand back up. */
      if (vn > -KNOCK_V) return;

      // Anything still standing is knocked loose by a real blow.
      if (B.mode !== FREE) {
        B.mode = FREE;
        B.freeAt = performance.now();
        B.calm = 0;
      }

      var jn = -(1 + PAIR_E) * vn / sum;
      A.vx -= nx * jn * iA; A.vy -= ny * jn * iA;
      B.vx += nx * jn * iB; B.vy += ny * jn * iB;

      // Whatever slides across the normal is what sets the two spinning.
      var vt = rvx * -ny + rvy * nx;
      A.vr -= vt * 0.012;
      B.vr += vt * 0.012;

      if (!fresh) return;
      var speed = Math.abs(vn);
      var mred = (mass[i] * mass[j]) / (mass[i] + mass[j]);
      var refV = MAX_PULL * BAND_K;
      var work = (mred / massRef) * (speed * speed) / (refV * refV);

      if (work > HIT_WORK) {
        var power = Math.min(2, work * 3.2);
        damage(j, nx, ny, power);
        damage(i, -nx, -ny, power * 0.6);
      } else if (speed > HIT_SPEED) {
        burst(ax + nx * rads[i].x, ay + ny * rads[i].y, nx, ny, 0.3);
      }
    }

    function moveDebris(h) {
      var k, o;
      shake.mag *= Math.max(0, 1 - 7 * h);
      if (shake.mag < 0.15) shake.mag = 0;
      shake.x = shake.mag ? (Math.random() - 0.5) * 2 * shake.mag : 0;
      shake.y = shake.mag ? (Math.random() - 0.5) * 2 * shake.mag : 0;
      for (k = trail.length - 1; k >= 0; k--) {
        o = trail[k];
        o.life += h;
        if (o.life > o.max) trail.splice(k, 1);
      }
      for (k = sparks.length - 1; k >= 0; k--) {
        o = sparks[k];
        o.vy += GRAV * 0.75 * h;
        o.vx -= o.vx * 2.1 * h;
        o.vy -= o.vy * 2.1 * h;
        o.x += o.vx * h; o.y += o.vy * h;
        o.life += h;
        if (o.life > o.max) sparks.splice(k, 1);
      }
      for (k = chips.length - 1; k >= 0; k--) {
        o = chips[k];
        o.vy += GRAV * h;
        o.vx -= o.vx * 0.7 * h;
        o.x += o.vx * h; o.y += o.vy * h;
        o.rot += o.vr * h;
        if (o.y > heroBox.h - 2 && o.vy > 0) {
          o.y = heroBox.h - 2; o.vy *= -0.35; o.vx *= 0.7; o.vr *= 0.5;
        }
        o.life += h;
        if (o.life > o.max) chips.splice(k, 1);
      }
      for (k = puffs.length - 1; k >= 0; k--) {
        o = puffs[k];
        o.vx -= o.vx * 1.5 * h;
        o.vy -= o.vy * 1.5 * h;
        o.vy -= 26 * h;             // dust drifts up as it thins
        o.x += o.vx * h; o.y += o.vy * h;
        o.r += o.grow * h;
        o.life += h;
        if (o.life > o.max) puffs.splice(k, 1);
      }
      for (k = rings.length - 1; k >= 0; k--) {
        o = rings[k];
        o.r += o.grow * h;
        o.life += h;
        if (o.life > o.max) rings.splice(k, 1);
      }
      for (k = shards.length - 1; k >= 0; k--) {
        o = shards[k];
        o.vy += GRAV * h;
        o.vx -= o.vx * 0.8 * h;
        o.x += o.vx * h; o.y += o.vy * h;
        o.rot += o.vr * h;
        o.vr -= o.vr * 0.9 * h;
        if (o.y > heroBox.h - 4 && o.vy > 0) {
          o.y = heroBox.h - 4; o.vy *= -0.32; o.vx *= 0.72; o.vr *= 0.6;
        }
        o.life += h;
        if (o.life > o.max) shards.splice(k, 1);
      }
    }

    /* ---- paint ---- */
    function bandAnchor(i, hx) {
      // The band is tied near the top of a pole, on the side facing the
      // letter being pulled.
      var cx = homes[i].x + state[i].x;
      var cy = homes[i].y + state[i].y - rads[i].y * 0.55;
      var dx = hx - cx;
      var dl = Math.abs(dx) || 1;
      return { x: cx + (dx / dl) * rads[i].x * 0.45, y: cy };
    }

    function drawBand() {
      if (held < 0) return;
      var hx = homes[held].x + state[held].x;
      var hy = homes[held].y + state[held].y;
      var pl = pullVec();
      // The band thins as it is drawn out, the way rubber does.
      var slack = Math.max(0.32, 1 - pl.len / 420);

      for (var s = 0; s < 2; s++) {
        var pi = poles[s];
        if (pi < 0) continue;
        var a = bandAnchor(pi, hx);
        bg.save();
        bg.lineCap = "round";
        bg.beginPath();
        bg.moveTo(a.x, a.y);
        bg.lineTo(hx, hy);
        bg.strokeStyle = textA(0.16);
        bg.lineWidth = 9 * slack;
        bg.stroke();
        bg.strokeStyle = accentA(0.85);
        bg.lineWidth = Math.max(1.6, 5.5 * slack);
        bg.stroke();
        bg.beginPath();
        bg.arc(a.x, a.y, 3.4, 0, 6.2832);
        bg.fillStyle = accentCss;
        bg.fill();
        bg.restore();
      }
    }

    function drawPouch() {
      if (held < 0) return;
      var p = state[held];
      var pl = pullVec();
      if (pl.len < 6) return;
      var hx = homes[held].x + p.x;
      var hy = homes[held].y + p.y;
      var w = rads[held].y * 1.05;

      fg.save();
      fg.translate(hx, hy);
      fg.rotate(Math.atan2(pl.y, pl.x));
      fg.beginPath();
      fg.moveTo(rads[held].x * 0.5, -w);
      fg.lineTo(rads[held].x * 0.5, w);
      fg.lineCap = "round";
      fg.lineWidth = 7;
      fg.strokeStyle = accentA(0.9);
      fg.stroke();
      fg.restore();

      // Where the shot is headed, in fading steps.
      var v = launchVel(held, pl);
      var x = hx, y = hy, vx = v.x, vy = v.y, h = 1 / 45;
      fg.save();
      for (var k = 0; k < 36; k++) {
        vy += GRAV * h;
        vx -= vx * AIR * h;
        vy -= vy * AIR * h;
        x += vx * h; y += vy * h;
        if (x < -20 || x > heroBox.w + 20 || y > heroBox.h + 20) break;
        fg.globalAlpha = 0.42 * (1 - k / 36);
        fg.beginPath();
        fg.arc(x, y, Math.max(1.2, 3.4 - k * 0.06), 0, 6.2832);
        fg.fillStyle = accentCss;
        fg.fill();
      }
      fg.restore();
    }

    function drawCracks(i) {
      var p = state[i];
      if (!p.cracks.length) return;
      var hw = rads[i].x, hh = rads[i].y;
      fg.save();
      fg.translate(homes[i].x + p.x, homes[i].y + p.y);
      fg.rotate(p.rot);
      fg.lineCap = "round";
      fg.lineJoin = "round";
      for (var k = 0; k < p.cracks.length; k++) {
        var c = p.cracks[k];
        var x0 = c.x * hw, y0 = c.y * hh;
        var x1 = x0 + Math.cos(c.a) * c.len * hw;
        var y1 = y0 + Math.sin(c.a) * c.len * hh;
        var mx = (x0 + x1) / 2 + Math.cos(c.a + 1.5708) * c.kink * hw;
        var my = (y0 + y1) / 2 + Math.sin(c.a + 1.5708) * c.kink * hh;
        fg.beginPath();
        fg.moveTo(x0, y0); fg.lineTo(mx, my); fg.lineTo(x1, y1);
        fg.strokeStyle = "rgba(0,0,0,0.4)";
        fg.lineWidth = c.w + 1.8;
        fg.stroke();
        fg.strokeStyle = accentCss;
        fg.lineWidth = c.w;
        fg.stroke();
      }
      fg.restore();
    }

    function drawDebris() {
      var k, o, t, s;

      for (k = 0; k < trail.length; k++) {
        o = trail[k];
        t = o.life / o.max;
        fg.beginPath();
        fg.arc(o.x, o.y, 2.8 * (1 - t * 0.6), 0, 6.2832);
        fg.fillStyle = accentA(0.32 * (1 - t));
        fg.fill();
      }

      // dust first, so everything else reads through it
      for (k = 0; k < puffs.length; k++) {
        o = puffs[k];
        t = o.life / o.max;
        var a = (1 - t) * (1 - t) * 0.18 * Math.min(1, t * 5);
        var g = fg.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        g.addColorStop(0, dustA(a));
        g.addColorStop(0.4, dustA(a * 0.6));
        g.addColorStop(0.75, dustA(a * 0.2));
        g.addColorStop(1, dustA(0));
        fg.fillStyle = g;
        fg.beginPath();
        fg.arc(o.x, o.y, o.r, 0, 6.2832);
        fg.fill();
      }

      for (k = 0; k < rings.length; k++) {
        o = rings[k];
        t = o.life / o.max;
        fg.beginPath();
        fg.arc(o.x, o.y, o.r, 0, 6.2832);
        fg.strokeStyle = accentA((1 - t) * 0.32);
        fg.lineWidth = Math.max(0.6, 5 * (1 - t));
        fg.stroke();
      }

      for (k = 0; k < shards.length; k++) {
        o = shards[k];
        t = o.life / o.max;
        fg.save();
        fg.globalAlpha = t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1;
        fg.translate(o.x, o.y);
        fg.rotate(o.rot);
        fg.translate(-o.gx, -o.gy);
        fg.beginPath();
        fg.moveTo(o.poly[0][0], o.poly[0][1]);
        for (s = 1; s < o.poly.length; s++) fg.lineTo(o.poly[s][0], o.poly[s][1]);
        fg.closePath();
        fg.clip();
        fg.font = o.font;
        fg.textAlign = "center";
        fg.textBaseline = "middle";
        if (o.hollow) {
          fg.lineWidth = o.strokeW || 1.5;
          fg.strokeStyle = o.stroke;
          fg.strokeText(o.ch, 0, 0);
        } else {
          fg.fillStyle = o.fill;
          fg.fillText(o.ch, 0, 0);
        }
        fg.restore();
      }

      for (k = 0; k < chips.length; k++) {
        o = chips[k];
        t = o.life / o.max;
        fg.save();
        fg.globalAlpha = 1 - t * t;
        fg.translate(o.x, o.y);
        fg.rotate(o.rot);
        fg.fillStyle = o.hot ? accentCss : textCss;
        fg.fillRect(-o.w / 2, -o.h / 2, o.w, o.h);
        fg.restore();
      }

      // sparks last and additive, so they sit on top of the dust
      if (sparks.length) {
        fg.save();
        fg.globalCompositeOperation = "lighter";
        fg.lineCap = "round";
        for (k = 0; k < sparks.length; k++) {
          o = sparks[k];
          t = o.life / o.max;
          var sp = Math.sqrt(o.vx * o.vx + o.vy * o.vy);
          var tail = Math.min(22, sp * 0.03);
          var dx = sp ? o.vx / sp : 0, dy = sp ? o.vy / sp : 0;
          fg.beginPath();
          fg.moveTo(o.x, o.y);
          fg.lineTo(o.x - dx * tail, o.y - dy * tail);
          fg.strokeStyle = "rgba(255," + Math.round(150 + 90 * (1 - t)) + ",90," + (1 - t).toFixed(2) + ")";
          fg.lineWidth = o.w * (1 - t * 0.6);
          fg.stroke();
        }
        fg.restore();
      }
    }

    function paint() {
      bg.clearRect(0, 0, heroBox.w, heroBox.h);
      fg.clearRect(0, 0, heroBox.w, heroBox.h);

      var sx = shake.x, sy = shake.y;
      if (sx || sy) {
        bg.save(); bg.translate(sx, sy);
        fg.save(); fg.translate(sx, sy);
      }
      if (title.style.transform || sx || sy) {
        title.style.transform = sx || sy
          ? "translate3d(" + sx.toFixed(1) + "px," + sy.toFixed(1) + "px,0)"
          : "";
      }
      drawBand();

      for (var i = 0; i < chars.length; i++) {
        var p = state[i];
        if (p.mode === GONE) continue;

        // Colour: the pointer warms a letter, and damage keeps it warm.
        var heat = 0;
        if (held >= 0) {
          if (i === held) heat = 1;
          else if (i === poles[0] || i === poles[1]) heat = 0.55;
        } else if (pointer.x > -9000) {
          var dx = pointer.x - (homes[i].x + p.x);
          var dy = pointer.y - (homes[i].y + p.y);
          var hd = Math.sqrt(dx * dx + dy * dy);
          if (hd < HOVER_RANGE) heat = Math.pow(1 - hd / HOVER_RANGE, 1.7) * 0.8;
          if (Math.abs(dx) < rads[i].x && Math.abs(dy) < rads[i].y) heat = 1;
        }
        if (p.hits) heat = Math.max(heat, 0.3 + p.hits * 0.22);

        var q = Math.round(heat * 12) / 12;
        if (q !== p.heat) {
          p.heat = q;
          if (q <= 0) {
            chars[i].style.color = "";
            chars[i].style.webkitTextStrokeColor = "";
            chars[i].style.textShadow = "";
          } else {
            var ink = mixInk(q);
            chars[i].style.color = ink;
            chars[i].style.webkitTextStrokeColor = ink;
            chars[i].style.textShadow = "0 0 " + (18 * q).toFixed(1) + "px rgba(" +
              inkAccent.join(",") + "," + (0.35 * q).toFixed(2) + ")";
          }
        }

        var off = Math.sqrt(p.x * p.x + p.y * p.y);
        if (off < 0.25 && Math.abs(p.rot) < 0.004) {
          if (chars[i].style.transform) chars[i].style.transform = "";
        } else {
          /* Stretched along whichever way it is being worked and thinner
             across it, which is what makes it read as rubber. */
          var ax, ay, amt;
          if (p.mode === HELD || p.mode === HOMING) {
            ax = p.x; ay = p.y;
            amt = Math.min(MAX_STRETCH, off / 300);
          } else {
            ax = p.vx; ay = p.vy;
            amt = Math.min(0.26, Math.sqrt(p.vx * p.vx + p.vy * p.vy) / 5200);
          }
          var ang = Math.atan2(ay, ax) * 180 / Math.PI;
          chars[i].style.transform =
            "translate3d(" + p.x.toFixed(2) + "px," + p.y.toFixed(2) + "px,0)" +
            " rotate(" + (p.rot * 180 / Math.PI).toFixed(2) + "deg)" +
            " rotate(" + ang.toFixed(2) + "deg)" +
            " scale(" + (1 + amt).toFixed(3) + "," + (1 - amt * 0.5).toFixed(3) + ")" +
            " rotate(" + (-ang).toFixed(2) + "deg)";
        }

        drawCracks(i);
      }

      drawPouch();
      drawDebris();
      if (sx || sy) { bg.restore(); fg.restore(); }
    }

    function busy() {
      if (held >= 0) return true;
      if (sparks.length || chips.length || puffs.length || rings.length) return true;
      if (shards.length || trail.length || shake.mag) return true;
      for (var i = 0; i < chars.length; i++) {
        var p = state[i];
        if (p.mode !== REST) return true;
        if (Math.abs(p.x) > 0.25 || Math.abs(p.y) > 0.25) return true;
        if (Math.abs(p.vx) > 4 || Math.abs(p.vy) > 4) return true;
        if (p.heat > 0 && !p.hits) return true;
      }
      return false;
    }

    function frame(now) {
      if (!live) { looping = false; return; }
      if (!lastT) lastT = now;
      var dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      acc += dt;
      var n = 0;
      while (acc >= STEP && n < 6) { step(STEP); acc -= STEP; n++; }
      if (n === 6) acc = 0;
      paint();
      if (!busy()) {
        live = false;
        looping = false;
        touching = {};
        title.classList.remove("is-live");
        return;
      }
      requestAnimationFrame(frame);
    }

    function wake() {
      live = true;
      if (!looping) { looping = true; lastT = 0; acc = 0; requestAnimationFrame(frame); }
    }

    /* ---- pointer ---- */
    window.addEventListener("pointermove", function (e) {
      heroPos();
      pointer.x = e.clientX - heroBox.x;
      pointer.y = e.clientY - heroBox.y;

      if (held >= 0) {
        var p = state[held];
        var tx = pointer.x - grab.x - homes[held].x;
        var ty = pointer.y - grab.y - homes[held].y;
        var len = Math.sqrt(tx * tx + ty * ty);
        // Past the limit the band gives, but barely.
        if (len > MAX_PULL) {
          var k = (MAX_PULL + (len - MAX_PULL) * 0.16) / len;
          tx *= k; ty *= k;
        }
        p.x = tx; p.y = ty;
        p.vx = p.vy = 0;
      }
      wake();
    }, { passive: true });

    hero.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "touch") return;
      heroPos();
      var px = e.clientX - heroBox.x;
      var py = e.clientY - heroBox.y;
      var i = nearest(px, py);
      if (i < 0) return;

      held = i;
      poles = findPoles(i);
      var p = state[i];
      p.mode = HELD;
      p.vx = p.vy = p.vr = 0;
      grab.x = px - (homes[i].x + p.x);
      grab.y = py - (homes[i].y + p.y);
      pointer.x = px; pointer.y = py;

      title.classList.add("is-held");
      title.classList.add("is-live");
      if (hero.setPointerCapture) { try { hero.setPointerCapture(e.pointerId); } catch (err) {} }
      e.preventDefault();
      wake();
    });

    function letGo() {
      if (held < 0) return;
      var i = held;
      var p = state[i];
      var pl = pullVec();
      var v = launchVel(i, pl);
      held = -1;
      poles = [-1, -1];
      touching = {};
      title.classList.remove("is-held");

      if (pl.len < 8) {
        p.mode = HOMING;
      } else {
        p.mode = FREE;
        p.vx = v.x;
        p.vy = v.y;
        p.vr = -pl.x * 0.02 + rand(-1.5, 1.5);
        p.freeAt = performance.now();
        p.calm = 0;
        burst(homes[i].x + p.x, homes[i].y + p.y, -pl.x / pl.len, -pl.y / pl.len, 0.5);
      }
      wake();
    }

    window.addEventListener("pointerup", letGo);
    window.addEventListener("pointercancel", letGo);

    function reset() {
      held = -1;
      poles = [-1, -1];
      sparks.length = 0; chips.length = 0; puffs.length = 0;
      rings.length = 0; shards.length = 0; trail.length = 0;
      shake.mag = shake.x = shake.y = 0;
      title.style.transform = "";
      touching = {};
      title.classList.remove("is-held");
      title.classList.remove("is-live");
      chars.forEach(function (el, i) {
        el.style.transform = "";
        el.style.color = "";
        el.style.webkitTextStrokeColor = "";
        el.style.textShadow = "";
        el.style.opacity = "";
        var p = state[i];
        p.x = p.y = p.vx = p.vy = p.rot = p.vr = 0;
        p.mode = REST; p.heat = -1; p.hits = 0;
        p.cracks.length = 0;
        if (p.healT) { window.clearTimeout(p.healT); p.healT = 0; }
      });
      bg.clearRect(0, 0, heroBox.w, heroBox.h);
      fg.clearRect(0, 0, heroBox.w, heroBox.h);
    }

    var resizeT = 0;
    window.addEventListener("resize", function () {
      window.clearTimeout(resizeT);
      resizeT = window.setTimeout(function () {
        reset();
        measure();
      }, 160);
    });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) {
          heroPos();
          wake();
        } else {
          live = false;
          pointer.x = pointer.y = -9999;
          reset();
        }
      }, { threshold: 0.05 }).observe(title);
    } else {
      wake();
    }
  })();

  /* If the artwork is missing the hero falls back to type alone rather
     than showing a broken frame. */
  var figure = document.getElementById("figure");
  var figureImg = document.getElementById("figure-img");

  if (figure && figureImg) {
    var showFigure = function () { figure.classList.add("is-in"); };
    if (figureImg.complete && figureImg.naturalWidth > 0) {
      requestAnimationFrame(showFigure);
    } else {
      figureImg.addEventListener("load", showFigure);
      // Never leave it hidden because a load event went missing.
      window.setTimeout(showFigure, 2500);
    }

    var dropFigure = function () {
      figure.classList.add("is-empty");
      var hero = figure.closest(".hero");
      if (hero) hero.classList.add("is-figureless");
    };
    if (figureImg.complete && figureImg.naturalWidth === 0) dropFigure();
    figureImg.addEventListener("error", dropFigure);
  }

  /* ---- Paint trail ------------------------------------------ */
  /* A pool of soft blobs follows the cursor across the landing and dries
     out behind it. No canvas, no loop: each blob fades on its own. */
  var paint = document.getElementById("paint");

  if (paint && hero && !reduced) {
    var POOL = 40;
    var SPACING = 30;
    var VARS = ["--accent", "--pop-1", "--pop-3", "--pop-4", "--pop-2"];
    var blobs = [];
    var nextBlob = 0;
    var swatch = 0;
    var lastPoint = null;
    var palette = [];

    function readPalette() {
      var cs = getComputedStyle(root);
      palette = VARS.map(function (v) { return cs.getPropertyValue(v).trim() || "#ff5233"; });
    }
    readPalette();

    for (var bi = 0; bi < POOL; bi++) {
      var blob = document.createElement("span");
      blob.className = "paint__blob";
      paint.appendChild(blob);
      blobs.push(blob);
    }

    function stampAt(x, y) {
      var el = blobs[nextBlob++ % POOL];
      var size = 150 + Math.random() * 130;
      el.classList.remove("is-on");
      void el.offsetWidth;                       // restart the fade
      el.style.width = size + "px";
      el.style.height = size + "px";
      el.style.left = (x - size / 2) + "px";
      el.style.top = (y - size / 2) + "px";
      el.style.background = palette[swatch++ % palette.length];
      el.classList.add("is-on");
    }

    hero.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch") return;
      var r = hero.getBoundingClientRect();
      var x = e.clientX - r.left;
      var y = e.clientY - r.top;

      if (!lastPoint) { lastPoint = { x: x, y: y }; stampAt(x, y); return; }
      var dx = x - lastPoint.x;
      var dy = y - lastPoint.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < SPACING) return;

      // Fill the gap between frames so a fast sweep still reads as a stroke.
      var steps = Math.min(4, Math.floor(dist / SPACING));
      for (var i = 1; i <= steps; i++) {
        stampAt(lastPoint.x + dx * (i / steps), lastPoint.y + dy * (i / steps));
      }
      lastPoint = { x: x, y: y };
    }, { passive: true });

    hero.addEventListener("pointerleave", function () { lastPoint = null; });
    if (toggle) toggle.addEventListener("click", readPalette);
  }

  /* ---- Tool pit ---------------------------------------------- */
  /* A box of things with weight. Gravity pulls them down, the cursor
     shoves them apart, and you can throw them at the walls. */
  var pit = document.getElementById("pit");

  if (pit && !reduced && pit.children.length) {
    var bodies = [];
    var pitW = 0, pitH = 0;
    var mouseX = -9999, mouseY = -9999;
    var held = null;
    var pitLive = false;
    var pitLoop = false;

    var GRAVITY = 0.62;
    var DAMPING = 0.992;
    var BOUNCE = 0.46;
    var FLOOR_FRICTION = 0.9;
    var PUSH_RADIUS = 150;

    var ring = document.getElementById("pit-ring");
    var lock = document.getElementById("pit-lock");
    var flash = document.getElementById("pit-flash");
    var charging = null;
    var chargeStart = 0;
    var blasted = false;
    var resetTimer = null;
    var HOLD = 750;
    var RESET_AFTER = 8000;
    var RING = 100;

    /* The one who catches them: he flies after the pointer and holds
       the beams on whatever the pointer is over. */
    var flier = document.getElementById("pit-hero");
    var beams = document.getElementById("pit-beams");
    var hud = document.getElementById("pit-lock-hud");
    var b1 = document.getElementById("beam-1"), b1g = document.getElementById("beam-1g");
    var b2 = document.getElementById("beam-2"), b2g = document.getElementById("beam-2g");
    var heroX = 0, heroY = 0, heroVX = 0, heroVY = 0;
    var heroOn = false, heroFlip = false;
    var HERO_AX = 60, HERO_AY = 45, HUD_A = 60, STANDOFF = 150;
    var shield = document.getElementById("pit-shield");
    var EYE = [[110, 28], [103, 33]];

    /* The timer. It goes off unless somebody stops it. */
    var bomb = document.getElementById("pit-bomb");
    var bombT = document.getElementById("pit-bomb-t");
    var bombNote = document.getElementById("pit-bomb-note");
    var bombTick = null, bombEnd = 0, bombLeft = 0, bombPaused = false;

    if (ring) {
      ring.style.strokeDasharray = RING;
      ring.style.strokeDashoffset = RING;
    }

    function aimAt(body, progress) {
      if (ring) ring.style.strokeDashoffset = (RING * (1 - progress)).toFixed(1);
      if (lock) {
        var left = (1 - progress) * (HOLD / 1000);
        lock.textContent = progress >= 1 ? "GOT IT" : left.toFixed(2);
      }
      // The badge drops out of the sky on to whatever he is holding.
      if (shield) {
        shield.setAttribute("transform", "translate(60 60) rotate(" +
          (-30 + 30 * progress).toFixed(1) + ") scale(" +
          (1.75 - 0.75 * progress).toFixed(3) + ")");
      }
      if (hud) { hud.classList.add("is-hot"); hud.style.opacity = "1"; }
      if (beams) beams.classList.add("is-on");
      if (flier) flier.classList.add("is-firing");
    }

    function clearAim() {
      if (hud) { hud.classList.remove("is-hot"); hud.style.opacity = heroOn ? "0.8" : "0"; }
      if (beams) beams.classList.remove("is-on");
      if (flier) flier.classList.remove("is-firing");
      if (ring) ring.style.strokeDashoffset = RING;
      if (lock) lock.textContent = (HOLD / 1000).toFixed(2);
      if (shield) shield.setAttribute("transform", "translate(60 60)");
    }

    Array.prototype.forEach.call(pit.children, function (el) {
      if (!el.classList.contains("chip") && !el.classList.contains("shape")) return;
      bodies.push({ el: el, w: el.offsetWidth, h: el.offsetHeight,
                    r: Math.max(el.offsetWidth, el.offsetHeight) / 2,
                    x: 0, y: 0, vx: 0, vy: 0, a: 0, va: 0,
                    chip: el.classList.contains("chip"), dead: false, slot: null });
    });

    /* Grab a real tool and hold on to it: the loose shapes get thrown out
       of the box and the tools sort themselves. Shapes do nothing. */

    function labelChips() {
      // The name comes from the text the screen reader was already given.
      bodies.forEach(function (b) {
        if (!b.chip || b.el.querySelector(".chip__name")) return;
        var vh = b.el.querySelector(".vh");
        if (!vh) return;
        var tag = document.createElement("span");
        tag.className = "chip__name";
        tag.textContent = vh.textContent;
        b.el.appendChild(tag);
      });
      pit.classList.add("is-sorted");
    }

    function arrange() {
      // Tools line up in a tidy grid, with room under each for its name.
      var live = bodies.filter(function (b) { return b.chip; });
      var cols = Math.max(1, Math.floor((pitW - 40) / 96));
      var rows = Math.ceil(live.length / cols);
      var gapX = 96;
      var gapY = 96;
      var startX = (pitW - (Math.min(cols, live.length) - 1) * gapX) / 2;
      var startY = pitH - 64 - (rows - 1) * gapY;
      live.forEach(function (b, i) {
        b.slot = {
          x: startX + (i % cols) * gapX,
          y: startY + Math.floor(i / cols) * gapY
        };
      });
    }

    function blast(from) {
      if (blasted) return;
      blasted = true;
      var center = from || { x: pitW / 2, y: pitH / 2 };

      // The hit: flash, shake, then the shapes leave.
      if (lock) lock.textContent = "LOCKED";
      if (flash) {
        flash.classList.remove("is-on");
        void flash.offsetWidth;
        flash.classList.add("is-on");
      }
      pit.classList.remove("is-hit");
      void pit.offsetWidth;
      pit.classList.add("is-hit");
      window.setTimeout(function () { pit.classList.remove("is-hit"); }, 500);

      window.setTimeout(clearAim, 260);
      if (charging) { charging.el.classList.remove("is-charging"); charging = null; }

      bodies.forEach(function (b) {
        if (b.chip) return;
        // Shapes are thrown clear of the box. They stay on the board so the
        // whole thing can be put back the way it was.
        var dx = b.x - center.x;
        var dy = b.y - center.y;
        var d = Math.sqrt(dx * dx + dy * dy) || 1;
        b.vx = (dx / d) * 36 + (Math.random() - 0.5) * 8;
        b.vy = (dy / d) * 36 - 18;
        b.va = (Math.random() - 0.5) * 0.6;
        b.dead = true;
        b.el.classList.add("is-blasted");
      });

      window.setTimeout(function () {
        arrange();
        labelChips();
      }, 560);

      if (resetTimer) window.clearTimeout(resetTimer);
      resetTimer = null;
      window.setTimeout(armBomb, 620);
    }

    /* Tidy never lasts. After a while everything is tipped back out. */
    function reset() {
      resetTimer = null;
      blasted = false;
      disarmBomb();
      pit.classList.remove("is-sorted");
      bodies.forEach(function (b) {
        b.dead = false;
        b.slot = null;
        b.el.classList.remove("is-blasted");
      });
      scatter();
      bodies.forEach(function (b) {
        b.vy = -6 - Math.random() * 6;
        b.vx = (Math.random() - 0.5) * 8;
      });
      startPit();
    }

    pit.classList.add("is-live");

    function scatter() {
      pitW = pit.clientWidth;
      pitH = pit.clientHeight;
      bodies.forEach(function (b, i) {
        var cols = Math.max(1, Math.floor(pitW / 90));
        b.x = ((i % cols) + 0.5) * (pitW / cols) + (Math.random() - 0.5) * 20;
        b.y = 40 + Math.floor(i / cols) * 80 + Math.random() * 30;
        b.vx = (Math.random() - 0.5) * 3;
        b.vy = 0;
        b.a = (Math.random() - 0.5) * 0.5;
        b.va = 0;
      });
    }

    /* He keeps his distance and keeps the beams on the target. */
    function stepHero() {
      if (!flier || !heroOn) return;

      var dx = mouseX - heroX, dy = mouseY - heroY;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      var tx = mouseX - (dx / d) * STANDOFF;
      var ty = mouseY - (dy / d) * STANDOFF;
      heroVX += (tx - heroX) * 0.1;
      heroVY += (ty - heroY) * 0.1;
      heroVX *= 0.8;
      heroVY *= 0.8;
      heroX += heroVX;
      heroY += heroVY;
      heroX = Math.min(Math.max(heroX, 30), Math.max(30, pitW - 30));
      heroY = Math.min(Math.max(heroY, 40), Math.max(40, pitH - 30));

      dx = mouseX - heroX;
      dy = mouseY - heroY;
      var flip = dx < 0;
      if (flip !== heroFlip) {
        heroFlip = flip;
        flier.classList.toggle("is-flip", flip);
      }
      var ang = Math.atan2(dy, Math.abs(dx) || 0.001) * 180 / Math.PI;
      if (ang > 42) ang = 42;
      if (ang < -42) ang = -42;
      flier.style.transform = "translate3d(" + (heroX - HERO_AX).toFixed(1) + "px," +
                             (heroY - HERO_AY).toFixed(1) + "px,0) rotate(" + ang.toFixed(1) + "deg)";

      // Where the eyes ended up once he is turned and flipped.
      var ar = ang * Math.PI / 180;
      var cos = Math.cos(ar), sin = Math.sin(ar);
      var ends = [];
      for (var k = 0; k < 2; k++) {
        var ex = EYE[k][0] - HERO_AX;
        var ey = EYE[k][1] - HERO_AY;
        if (heroFlip) ex = -ex;
        ends.push([heroX + ex * cos - ey * sin, heroY + ex * sin + ey * cos]);
      }
      if (b1) setBeam(b1, b1g, ends[0]);
      if (b2) setBeam(b2, b2g, ends[1]);

      if (hud) {
        hud.style.transform = "translate3d(" + (mouseX - HUD_A).toFixed(1) + "px," +
                              (mouseY - HUD_A).toFixed(1) + "px,0)";
      }
    }

    function setBeam(core, glow, from) {
      [core, glow].forEach(function (ln) {
        if (!ln) return;
        ln.setAttribute("x1", from[0].toFixed(1));
        ln.setAttribute("y1", from[1].toFixed(1));
        ln.setAttribute("x2", mouseX.toFixed(1));
        ln.setAttribute("y2", mouseY.toFixed(1));
      });
    }

    function showHero(on) {
      if (!flier) return;
      heroOn = on;
      flier.classList.toggle("is-on", on);
      if (hud) {
        hud.classList.toggle("is-on", on);
        hud.style.opacity = on ? "0.8" : "0";
      }
      if (!on) {
        if (beams) beams.classList.remove("is-on");
        if (hud) { hud.classList.remove("is-hot"); hud.style.opacity = "0"; }
      }
    }

    /* ---- The timer on the shelf ------------------------------ */
    function runBomb(ms) {
      bombEnd = performance.now() + ms;
      if (bombTick) window.clearInterval(bombTick);
      bombTick = window.setInterval(function () {
        var left = Math.max(0, bombEnd - performance.now());
        if (bombT) bombT.textContent = String(Math.ceil(left / 1000));
        bomb.classList.toggle("is-close", left < 3200);
        if (left <= 0) { window.clearInterval(bombTick); bombTick = null; }
      }, 100);
      if (resetTimer) window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(reset, ms);
    }

    function armBomb() {
      if (!bomb) return;
      bombPaused = false;
      bomb.classList.add("is-on");
      bomb.classList.remove("is-safe");
      if (bombNote) bombNote.textContent = "tap to stop";
      runBomb(RESET_AFTER);
    }

    function disarmBomb() {
      if (bombTick) { window.clearInterval(bombTick); bombTick = null; }
      bombPaused = false;
      if (bomb) bomb.classList.remove("is-on", "is-close", "is-safe");
    }

    if (bomb) {
      bomb.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
      bomb.addEventListener("click", function (e) {
        // One tap holds it. Another lets it carry on counting.
        e.stopPropagation();
        e.preventDefault();
        if (!bombPaused) {
          bombPaused = true;
          bombLeft = Math.max(600, bombEnd - performance.now());
          if (bombTick) { window.clearInterval(bombTick); bombTick = null; }
          if (resetTimer) { window.clearTimeout(resetTimer); resetTimer = null; }
          bomb.classList.remove("is-close");
          bomb.classList.add("is-safe");
          if (bombT) bombT.textContent = String(Math.ceil(bombLeft / 1000));
          if (bombNote) bombNote.textContent = "tap to start";
        } else {
          bombPaused = false;
          bomb.classList.remove("is-safe");
          if (bombNote) bombNote.textContent = "tap to stop";
          runBomb(bombLeft);
        }
      });
    }

    function pitFrame() {
      if (!pitLive) { pitLoop = false; return; }
      var i, j, b;

      stepHero();

      if (charging) {
        var heldFor = performance.now() - chargeStart;
        var progress = Math.min(1, heldFor / HOLD);
        aimAt(charging, progress);
        if (progress >= 1) blast(charging);
      }

      for (i = 0; i < bodies.length; i++) {
        b = bodies[i];
        if (b === held) continue;

        // Once the box is sorted, tools travel to their slot and stay.
        if (b.slot) {
          b.x += (b.slot.x - b.x) * 0.12;
          b.y += (b.slot.y - b.y) * 0.12;
          b.a += (0 - b.a) * 0.12;
          b.vx = 0;
          b.vy = 0;
          b.el.style.transform = "translate3d(" + (b.x - b.w / 2).toFixed(2) + "px," +
                                 (b.y - b.h / 2).toFixed(2) + "px,0) rotate(" +
                                 (b.a * 20).toFixed(2) + "deg)";
          continue;
        }

        b.vy += GRAVITY;

        var dx = b.x - mouseX, dy = b.y - mouseY;
        var d2 = dx * dx + dy * dy;
        if (d2 < PUSH_RADIUS * PUSH_RADIUS) {
          var d = Math.sqrt(d2) || 1;
          var f = (1 - d / PUSH_RADIUS) * 2.94;
          b.vx += (dx / d) * f;
          b.vy += (dy / d) * f;
          b.va += (dx / d) * 0.02;
        }

        b.vx *= DAMPING;
        b.vy *= DAMPING;
        b.x += b.vx;
        b.y += b.vy;
        b.va *= 0.94;
        b.a += b.va;
      }

      /* Everything is treated as a circle. Close enough for a toy box. */
      for (i = 0; i < bodies.length; i++) {
        for (j = i + 1; j < bodies.length; j++) {
          var a = bodies[i], c = bodies[j];
          if (a.dead || c.dead || a.slot || c.slot) continue;
          var nx = c.x - a.x, ny = c.y - a.y;
          var dist = Math.sqrt(nx * nx + ny * ny) || 1;
          var min = a.r + c.r;
          if (dist >= min) continue;
          var ux = nx / dist, uy = ny / dist;
          var overlap = (min - dist) / 2;
          if (a !== held) { a.x -= ux * overlap; a.y -= uy * overlap; }
          if (c !== held) { c.x += ux * overlap; c.y += uy * overlap; }
          var p = (a.vx - c.vx) * ux + (a.vy - c.vy) * uy;
          if (p > 0) {
            if (a !== held) { a.vx -= p * ux * 0.5; a.vy -= p * uy * 0.5; }
            if (c !== held) { c.vx += p * ux * 0.5; c.vy += p * uy * 0.5; }
          }
        }
      }

      for (i = 0; i < bodies.length; i++) {
        b = bodies[i];
        if (b.slot) continue;
        if (b.dead) {
          b.el.style.transform = "translate3d(" + (b.x - b.w / 2).toFixed(2) + "px," +
                                 (b.y - b.h / 2).toFixed(2) + "px,0) rotate(" +
                                 (b.a * 20).toFixed(2) + "deg)";
          continue;
        }
        if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * BOUNCE; }
        if (b.x > pitW - b.r) { b.x = pitW - b.r; b.vx = -Math.abs(b.vx) * BOUNCE; }
        if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy) * BOUNCE; }
        if (b.y > pitH - b.r) {
          b.y = pitH - b.r;
          b.vy = -Math.abs(b.vy) * BOUNCE;
          b.vx *= FLOOR_FRICTION;
          b.va *= FLOOR_FRICTION;
        }
        b.el.style.transform = "translate3d(" + (b.x - b.w / 2).toFixed(2) + "px," +
                               (b.y - b.h / 2).toFixed(2) + "px,0) rotate(" +
                               (b.a * 20).toFixed(2) + "deg)";
      }

      requestAnimationFrame(pitFrame);
    }

    function startPit() {
      pitLive = true;
      if (!pitLoop) { pitLoop = true; requestAnimationFrame(pitFrame); }
    }

    pit.addEventListener("pointermove", function (e) {
      startPit();
      var r = pit.getBoundingClientRect();
      mouseX = e.clientX - r.left;
      mouseY = e.clientY - r.top;
      if (!heroOn) {
        // He drops in near where the pointer came from rather than
        // flying the whole width of the box to get there.
        heroX = mouseX - (heroFlip ? -STANDOFF : STANDOFF) * 0.7;
        heroY = mouseY - 60;
        heroVX = 0;
        heroVY = 0;
        showHero(true);
        stepHero();
      }
      if (held) {
        held.vx = (mouseX - held.x) * 0.35;
        held.vy = (mouseY - held.y) * 0.35;
        held.x = mouseX;
        held.y = mouseY;
      }
    }, { passive: true });

    pit.addEventListener("pointerleave", function () {
      mouseX = -9999;
      mouseY = -9999;
      showHero(false);
      release();
    });

    pit.addEventListener("pointerdown", function (e) {
      // Touching the box always wakes the simulation, even if the observer
      // has already put it to sleep.
      startPit();
      var r = pit.getBoundingClientRect();
      var mx = e.clientX - r.left, my = e.clientY - r.top;
      var best = null, bestD = Infinity;
      bodies.forEach(function (b) {
        var d = (b.x - mx) * (b.x - mx) + (b.y - my) * (b.y - my);
        if (d < bestD && d < b.r * b.r * 1.6) { bestD = d; best = b; }
      });
      if (best) {
        held = best;
        mouseX = mx;
        mouseY = my;
        if (pit.setPointerCapture) { try { pit.setPointerCapture(e.pointerId); } catch (err) {} }

        if (best.chip && !blasted) {
          charging = best;
          chargeStart = performance.now();
          best.el.classList.add("is-charging");
          if (reticle) reticle.classList.add("is-on");
          aimAt(best, 0);
        }
      }
    });

    function release() {
      held = null;
      if (charging) {
        charging.el.classList.remove("is-charging");
        charging = null;
        clearAim();
      }
    }

    pit.addEventListener("pointerup", release);
    pit.addEventListener("pointercancel", release);

    window.addEventListener("resize", function () {
      var oldW = pitW || 1, oldH = pitH || 1;
      pitW = pit.clientWidth;
      pitH = pit.clientHeight;
      bodies.forEach(function (b) {
        b.x = Math.min(Math.max(b.x * (pitW / oldW), b.r), pitW - b.r);
        b.y = Math.min(Math.max(b.y * (pitH / oldH), b.r), pitH - b.r);
      });
    }, { passive: true });

    scatter();

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { startPit(); } else { pitLive = false; }
      }, { threshold: 0.05 }).observe(pit);
    } else {
      startPit();
    }
  }

  /* ---- The request diagram ---------------------------------- */
  var diagram = document.getElementById("diagram");
  var wire = document.getElementById("wire");
  var pulse = document.getElementById("pulse");
  var nodes = diagram ? diagram.querySelectorAll(".node") : [];
  var packets = diagram ? diagram.querySelectorAll(".pkt") : [];
  var wireLength = 0;
  var drawn = 0;

  if (wire && wire.getTotalLength) {
    wireLength = wire.getTotalLength();
    wire.style.strokeDasharray = wireLength;
    wire.style.strokeDashoffset = reduced ? 0 : wireLength;
    if (reduced) {
      Array.prototype.forEach.call(nodes, function (n) { n.classList.add("on"); });
    }
  }

  function drawDiagram() {
    if (!diagram || !wire || !wireLength || reduced) return;
    var rect = diagram.getBoundingClientRect();
    var vh = window.innerHeight;
    // 0 when the figure's top reaches 85% of the viewport, 1 once it has
    // travelled up to 25% — the drawing tracks that window.
    var p = (vh * 0.85 - rect.top) / (vh * 0.6);
    p = Math.max(0, Math.min(1, p));
    drawn = p;

    wire.style.strokeDashoffset = wireLength * (1 - p);

    Array.prototype.forEach.call(nodes, function (n) {
      var at = parseFloat(n.getAttribute("data-at")) || 0;
      n.classList.toggle("on", p >= at);
    });

    if (pulse) {
      if (p > 0.01 && p < 0.995) {
        var pt = wire.getPointAtLength(wireLength * p);
        pulse.setAttribute("cx", pt.x);
        pulse.setAttribute("cy", pt.y);
        pulse.classList.add("on");
      } else {
        pulse.classList.remove("on");
      }
    }
  }

  /* Traffic: once the route is drawn, requests keep travelling it. */
  var systemLive = false;

  function movePackets(now) {
    if (!packets.length || !wireLength) return;
    var flowing = drawn > 0.97 && !reduced;
    for (var i = 0; i < packets.length; i++) {
      if (!flowing) { packets[i].classList.remove("on"); continue; }
      var t = ((now / 3400) + i / packets.length) % 1;
      var pt = wire.getPointAtLength(wireLength * t);
      packets[i].setAttribute("cx", pt.x);
      packets[i].setAttribute("cy", pt.y);
      packets[i].classList.add("on");
    }
  }

  /* ---- The trace: this page's own arrival -------------------- */
  /* Nothing invented. Every number below comes from the Navigation and
     Paint timing APIs for the request that fetched this document. */
  var traceList = document.getElementById("trace-list");
  var traceHint = document.getElementById("trace-hint");

  function ms(v) {
    if (v == null || !isFinite(v) || v < 0) return null;
    return v < 10 ? Math.round(v * 10) / 10 : Math.round(v);
  }

  var TRACE_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&/";

  /* The key resolves out of noise, the message types after it, and a block
     cursor sits at the end of whichever line is still being written. */
  function scrambleInto(el, text, done) {
    if (reduced) { el.textContent = text; if (done) done(); return; }
    var settled = 0;
    var frame = 0;
    (function step() {
      frame++;
      if (frame % 2 === 0) settled++;
      var out = text.slice(0, settled);
      for (var i = settled; i < text.length; i++) {
        out += text[i] === " " ? " " : TRACE_GLYPHS[(Math.random() * TRACE_GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (settled < text.length) { raf(step); } else if (done) { done(); }
    })();
  }

  function typeInto(el, text, cursor, done) {
    if (reduced) { el.textContent = text; if (done) done(); return; }
    var n = 0;
    (function step() {
      n = Math.min(text.length, n + 2);
      el.textContent = text.slice(0, n);
      if (cursor) el.appendChild(cursor);
      if (n < text.length) { raf(step); } else if (done) { done(); }
    })();
  }

  function traceLine(key, msg, value, cls) {
    if (!traceList) return;

    // Whichever line was live stops being live.
    var oldCursor = traceList.querySelector(".trace__cursor");
    if (oldCursor && oldCursor.parentNode) oldCursor.parentNode.removeChild(oldCursor);
    Array.prototype.forEach.call(traceList.querySelectorAll(".is-writing"), function (el) {
      el.classList.remove("is-writing");
    });

    var li = document.createElement("li");
    li.className = (cls ? cls + " " : "") + "is-writing";
    li.innerHTML = '<span class="trace__t"></span><span class="trace__k"></span>' +
                   '<span class="trace__m"></span><span class="trace__ms"></span>';
    li.children[0].textContent = stamp();
    li.children[3].textContent = value;
    traceList.appendChild(li);

    var cursor = document.createElement("span");
    cursor.className = "trace__cursor";

    scrambleInto(li.children[1], key, function () {
      typeInto(li.children[2], msg, cursor, function () {
        li.classList.remove("is-writing");
        if (cursor.parentNode) cursor.parentNode.removeChild(cursor);
      });
    });

    while (traceList.children.length > 7) traceList.removeChild(traceList.firstChild);
  }

  /* Something to read while the timings are being gathered. */
  function traceWaiting() {
    if (!traceList) return null;
    var li = document.createElement("li");
    li.className = "trace__wait";
    li.innerHTML = '<span class="trace__t"></span><span>collecting timings</span>';
    li.children[0].textContent = stamp();
    traceList.appendChild(li);
    return li;
  }

  function stamp() {
    var d = new Date();
    function p(n, w) { return ("000" + n).slice(-w); }
    return p(d.getHours(), 2) + ":" + p(d.getMinutes(), 2) + ":" + p(d.getSeconds(), 2) +
           "." + p(d.getMilliseconds(), 3);
  }

  function measured() {
    var nav = null;
    try {
      nav = performance.getEntriesByType("navigation")[0];
    } catch (e) {}
    if (!nav) return null;

    var paint = 0;
    try {
      performance.getEntriesByType("paint").forEach(function (p) {
        if (p.name === "first-contentful-paint") paint = p.startTime;
      });
    } catch (e) {}

    var resources = 0;
    var bytes = nav.transferSize || 0;
    try {
      performance.getEntriesByType("resource").forEach(function (r) {
        resources++;
        bytes += r.transferSize || 0;
      });
    } catch (e) {}

    return {
      dns: ms(nav.domainLookupEnd - nav.domainLookupStart),
      connect: ms(nav.connectEnd - nav.connectStart),
      ttfb: ms(nav.responseStart - nav.requestStart),
      transfer: ms(nav.responseEnd - nav.responseStart),
      render: ms(paint ? paint : nav.domInteractive),
      dom: ms(nav.domContentLoadedEventEnd),
      total: ms(nav.loadEventEnd || nav.domComplete),
      protocol: nav.nextHopProtocol || "local",
      resources: resources,
      kb: bytes ? Math.round(bytes / 1024) : 0,
      docKb: nav.transferSize ? Math.round(nav.transferSize / 1024) :
             (nav.decodedBodySize ? Math.round(nav.decodedBodySize / 1024) : 0)
    };
  }

  function fill(el, value) {
    if (!el) return;
    el.textContent = value == null ? "not exposed" : value + " ms";
  }

  function paintNodes(m) {
    if (!diagram) return;
    var map = { dns: m.dns, connect: m.connect, ttfb: m.ttfb, transfer: m.transfer, render: m.render };
    Array.prototype.forEach.call(diagram.querySelectorAll("[data-ms]"), function (el) {
      fill(el, map[el.getAttribute("data-ms")]);
    });
  }

  /* ---- What else the browser knows -------------------------- */
  var traceFacts = document.getElementById("trace-facts");

  function kb(bytes) {
    if (!bytes) return null;
    return bytes >= 1024 * 1024
      ? (bytes / 1024 / 1024).toFixed(1) + " MB"
      : Math.round(bytes / 1024) + " KB";
  }

  function fact(term, value) {
    if (!traceFacts || value == null || value === "") return;
    var row = document.createElement("div");
    row.className = "trace__fact";
    var dt = document.createElement("dt");
    dt.textContent = term;
    var dots = document.createElement("span");
    dots.className = "trace__dots";
    var dd = document.createElement("dd");
    dd.textContent = value;
    dd.title = value;
    row.appendChild(dt);
    row.appendChild(dots);
    row.appendChild(dd);
    traceFacts.appendChild(row);
  }

  function runFacts(m) {
    if (!traceFacts) return;
    traceFacts.innerHTML = "";

    var nav = null;
    var res = [];
    try {
      nav = performance.getEntriesByType("navigation")[0];
      res = performance.getEntriesByType("resource");
    } catch (e) {}

    /* Connection, straight from the Network Information API. */
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (c) {
      var link = [];
      if (c.effectiveType) link.push(c.effectiveType);
      if (c.downlink) link.push(c.downlink + " Mbps");
      if (c.rtt) link.push("rtt " + c.rtt + " ms");
      if (c.saveData) link.push("data saver on");
      fact("LINK", link.join(", "));
    } else {
      fact("LINK", "not exposed by this browser");
    }

    fact("PROTOCOL", nav && nav.nextHopProtocol ? nav.nextHopProtocol : location.protocol.replace(":", ""));
    fact("SECURE", window.isSecureContext ? "yes, " + location.protocol.replace(":", "") : "no");

    /* Payload, split by what asked for it. */
    var byType = {};
    var total = nav && nav.transferSize ? nav.transferSize : 0;
    var cached = 0;
    var slowest = null;
    res.forEach(function (r) {
      var t = r.initiatorType || "other";
      byType[t] = (byType[t] || 0) + (r.transferSize || r.decodedBodySize || 0);
      total += r.transferSize || 0;
      if (!r.transferSize && r.decodedBodySize) cached++;
      if (!slowest || r.duration > slowest.duration) slowest = r;
    });

    var parts = [];
    Object.keys(byType).sort(function (a, b) { return byType[b] - byType[a]; })
      .slice(0, 4).forEach(function (t) {
        var size = kb(byType[t]);
        if (size) parts.push(t + " " + size);
      });

    fact("WEIGHT", kb(total) + " over " + (res.length + 1) + " requests");
    if (parts.length) fact("PAYLOAD", parts.join(", "));
    fact("CACHE", cached + " of " + res.length + " served from cache");

    /* Compression on the document itself. */
    if (nav && nav.decodedBodySize && nav.encodedBodySize) {
      var ratio = nav.decodedBodySize / nav.encodedBodySize;
      fact("DOCUMENT", kb(nav.encodedBodySize) + " on the wire, " +
           kb(nav.decodedBodySize) + " decoded, " + ratio.toFixed(1) + "x");
    }

    if (slowest && slowest.duration > 0) {
      var name = slowest.name.split("/").pop().split("?")[0];
      fact("SLOWEST", name + " at " + Math.round(slowest.duration) + " ms");
    }

    /* The machine on the other end of the request. */
    var device = [];
    if (navigator.hardwareConcurrency) device.push(navigator.hardwareConcurrency + " cores");
    if (navigator.deviceMemory) device.push(navigator.deviceMemory + " GB memory");
    if (device.length) fact("DEVICE", device.join(", "));

    fact("VIEWPORT", window.innerWidth + " by " + window.innerHeight + " at " +
         (window.devicePixelRatio || 1) + "x");

    try {
      fact("ZONE", Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch (e) {}

    if (nav && typeof nav.redirectCount === "number") {
      fact("REDIRECTS", nav.redirectCount === 0 ? "none" : String(nav.redirectCount));
    }

    if (performance.memory && performance.memory.usedJSHeapSize) {
      fact("JS HEAP", kb(performance.memory.usedJSHeapSize) + " in use");
    }

    if (m && m.render != null) {
      fact("PAINT", "first contentful paint at " + m.render + " ms");
    }

    try {
      var navType = performance.getEntriesByType("navigation")[0];
      if (navType && navType.type) fact("VISIT", navType.type.replace(/_/g, " "));
    } catch (e) {}

    if (navigator.language) {
      fact("LANGUAGE", (navigator.languages || [navigator.language]).slice(0, 3).join(", "));
    }

    if (screen && screen.colorDepth) {
      fact("DISPLAY", screen.width + " by " + screen.height + ", " + screen.colorDepth + "-bit");
    }

    if (typeof navigator.maxTouchPoints === "number") {
      fact("INPUT", navigator.maxTouchPoints > 0 ? navigator.maxTouchPoints + " touch points" : "mouse and keyboard");
    }

    fetchIpFacts();
  }

  /* Everything above comes straight from browser APIs, no network call
     involved. This is the one exception: a lightweight, HTTPS, no-key
     lookup that echoes back what any server you talk to already sees
     about this request, made transparent instead of hidden. Fails
     silently, since it is a bonus row, not something to block on. */
  var ipFactsFetched = false;
  function fetchIpFacts() {
    if (!traceFacts || ipFactsFetched || typeof fetch !== "function") return;
    ipFactsFetched = true;
    fetch("https://ipapi.co/json/", { mode: "cors" })
      .then(function (r) { return r && r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !traceFacts || data.error) return;
        if (data.ip) fact("PUBLIC IP", data.ip);
        var place = [data.city, data.region, data.country_name].filter(Boolean).join(", ");
        if (place) fact("LOCATION", place);
        if (data.org) fact("NETWORK", data.org);
      })
      .catch(function () {});
  }

  function runTrace() {
    var waiting = traceWaiting();
    var m = measured();
    if (!m) {
      traceLine("TIMING", "this browser does not expose navigation timing", "");
      return;
    }
    paintNodes(m);

    if (traceHint) {
      traceHint.textContent = m.protocol + " \u00b7 " + m.resources + " assets \u00b7 " + m.kb + " KB";
    }

    var rows = [
      ["DNS", "name resolved", m.dns],
      ["TCP AND TLS", "connection established", m.connect],
      ["SERVER", "first byte of the document", m.ttfb],
      ["TRANSFER", m.docKb + " KB of html read", m.transfer],
      ["RENDER", "first contentful paint", m.render]
    ];

    var i = 0;
    (function next() {
      if (i >= rows.length) {
        traceLine("READY", "document interactive, " + m.resources + " assets fetched",
                  (m.total == null ? m.dom : m.total) + " ms total");
        runFacts(m);
        return;
      }
      var row = rows[i++];
      if (waiting && waiting.parentNode) {
        waiting.parentNode.removeChild(waiting);
        waiting = null;
      }
      // Anything over 300 ms gets called out rather than quietly listed.
      traceLine(row[0], row[1], row[2] == null ? "not exposed" : row[2] + " ms",
                row[2] != null && row[2] > 300 ? "warn" : "");
      window.setTimeout(next, reduced ? 0 : 420);
    })();
  }

  /* The packets only fly, and the trace only runs, while the section is
     actually on screen. */
  var looping = false;
  var traceDone = false;

  function loop(now) {
    if (!systemLive || reduced) { looping = false; return; }
    movePackets(now);
    raf(loop);
  }

  function startSystem() {
    if (!systemLive) {
      systemLive = true;
      if (!looping && !reduced) { looping = true; raf(loop); }
    }
    if (!traceDone && traceList) {
      traceDone = true;
      if (document.readyState === "complete") {
        window.setTimeout(runTrace, 60);
      } else {
        window.addEventListener("load", function () { window.setTimeout(runTrace, 60); });
      }
    }
  }

  var system = document.getElementById("system");
  if (system && traceList) {
    if (!("IntersectionObserver" in window)) {
      startSystem();
    } else {
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { startSystem(); } else { systemLive = false; }
      }, { threshold: 0.05 }).observe(system);
    }
  }

  /* ---- Brand tooltips --------------------------------------- */
  /* One bubble, moved to whichever mark you are on — it reads like a
     remark about that brand rather than a caption bolted to the grid. */
  var grid = document.getElementById("brands-grid");
  var tip = document.getElementById("brands-tip");
  var tipNote = document.getElementById("brands-tip-note");
  var tipMeta = document.getElementById("brands-tip-meta");
  var tipDust = document.getElementById("brands-tip-dust");

  if (grid && tip && tipNote && tipMeta) {
    var cards = grid.querySelectorAll(".brand");
    var pinned = null;
    var shown = null;
    var vanishTimer = null;

    /* Re-seeded before every dissolve — never the same scatter twice.
       Dense 10×7 grid of three particle types (round specks, rounded bits,
       square chunks) fly off in a wide ±90° arc with a turbulence waypoint
       mid-path, creating a grainy, organic disintegration. Delay blends
       x-position and randomness so the dissolve edge stays jagged, not a
       clean column march. */
    function seedDust() {
      if (!tipDust) return;
      tipDust.textContent = "";
      var cols = 10, rows = 7;
      var frag = document.createDocumentFragment();

      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var sx = ((c + 0.5) / cols) * 100 + (Math.random() * 14 - 7);
          var sy = ((r + 0.5) / rows) * 100 + (Math.random() * 18 - 9);
          /* Wide scatter arc: mostly upward but fans out ±90°. */
          var angle = (-90 + (Math.random() * 180 - 90)) * (Math.PI / 180);
          var dist = 20 + Math.random() * 55;
          /* Turbulence waypoint — bends each particle's path mid-flight. */
          var wx = (Math.random() - 0.5) * 22;
          var wy = (Math.random() - 0.5) * 14 - 8;
          /* Three types: 0 = round speck, 1 = rounded bit, 2 = square chunk. */
          var rand = Math.random();
          var type = rand < 0.50 ? 0 : (rand < 0.82 ? 1 : 2);
          var sizeBase = type === 0 ? (0.08 + Math.random() * 0.10)
                       : type === 1 ? (0.15 + Math.random() * 0.12)
                       : (0.22 + Math.random() * 0.20);
          var speck = document.createElement("span");
          speck.className = "brands__tip-speck brands__tip-speck--t" + type;
          speck.style.setProperty("--sx", sx.toFixed(1) + "%");
          speck.style.setProperty("--sy", sy.toFixed(1) + "%");
          speck.style.setProperty("--dx", (Math.cos(angle) * dist).toFixed(1) + "px");
          speck.style.setProperty("--dy", (Math.sin(angle) * dist).toFixed(1) + "px");
          speck.style.setProperty("--wx", wx.toFixed(1) + "px");
          speck.style.setProperty("--wy", wy.toFixed(1) + "px");
          speck.style.setProperty("--ss", sizeBase.toFixed(2) + "rem");
          speck.style.setProperty("--sr", (Math.random() * 320 - 160).toFixed(0) + "deg");
          /* Delay: x-fraction drives sweep direction; randomness keeps edge jagged.
             Scaled to the ~0.8 s total effect window. */
          var xFrac = (c + 0.5) / cols;
          speck.style.setProperty("--sd", (xFrac * 0.18 + Math.random() * 0.1).toFixed(2) + "s");
          frag.appendChild(speck);
        }
      }

      /* Extra scatter particles at random positions for outer drama. */
      for (var i = 0; i < 16; i++) {
        var sx2 = Math.random() * 112 - 6;
        var sy2 = Math.random() * 112 - 6;
        var angle2 = (-90 + (Math.random() * 220 - 110)) * (Math.PI / 180);
        var dist2 = 38 + Math.random() * 72;
        var wx2 = (Math.random() - 0.5) * 28;
        var wy2 = (Math.random() - 0.5) * 18 - 12;
        var t2 = Math.random() < 0.65 ? 0 : 1;
        var sz2 = t2 === 0 ? (0.07 + Math.random() * 0.08) : (0.13 + Math.random() * 0.10);
        var s = document.createElement("span");
        s.className = "brands__tip-speck brands__tip-speck--t" + t2;
        s.style.setProperty("--sx", sx2.toFixed(1) + "%");
        s.style.setProperty("--sy", sy2.toFixed(1) + "%");
        s.style.setProperty("--dx", (Math.cos(angle2) * dist2).toFixed(1) + "px");
        s.style.setProperty("--dy", (Math.sin(angle2) * dist2).toFixed(1) + "px");
        s.style.setProperty("--wx", wx2.toFixed(1) + "px");
        s.style.setProperty("--wy", wy2.toFixed(1) + "px");
        s.style.setProperty("--ss", sz2.toFixed(2) + "rem");
        s.style.setProperty("--sr", (Math.random() * 320 - 160).toFixed(0) + "deg");
        s.style.setProperty("--sd", (Math.random() * 0.22).toFixed(2) + "s");
        frag.appendChild(s);
      }

      tipDust.appendChild(frag);
    }

    function showTip(card) {
      shown = card;
      tipNote.textContent = card.getAttribute("data-note") || "";
      tipMeta.textContent = card.getAttribute("data-name") + "  ·  " + card.getAttribute("data-meta");
      tip.classList.remove("is-vanishing");
      tip.classList.add("is-on");
      /* Alternate the handwritten tilt so the note doesn't lean the same
         way on every card. */
      tip.classList.toggle("is-flip", Array.prototype.indexOf.call(cards, card) % 2 === 1);

      var gw = grid.clientWidth;
      var tw = tip.offsetWidth;
      var th = tip.offsetHeight;
      var cx = card.offsetLeft + card.offsetWidth / 2;
      var half = tw / 2;
      var left = Math.min(Math.max(cx, half + 2), Math.max(gw - half - 2, half + 2));
      tip.style.left = left + "px";
      tip.style.top = (card.offsetTop - th - 6) + "px";
      tip.style.setProperty("--arrow", (cx - left + half) + "px");
    }

    function hideTip() {
      disarmVanish();
      if (pinned) return;
      shown = null;
      tip.classList.remove("is-on");
    }

    /* Stay put too long over a mark and the note turns to dust — a
       Thanos-snap instead of just sitting there. Hover only: pinned
       (tap) and keyboard-focused notes stay put till dismissed. */
    function armVanish(card) {
      disarmVanish();
      if (reduced) return;
      vanishTimer = window.setTimeout(function () {
        vanishTimer = null;
        if (shown !== card || pinned === card) return;
        seedDust();
        tip.classList.add("is-vanishing");
        window.setTimeout(function () {
          if (shown === card) {
            /* Two-step removal to prevent the 1-frame flash:
               1. Remove is-on first — the parent starts its 0.22 s opacity
                  transition to 0 while is-vanishing is still present, so all
                  child animations keep their forwards fill-mode hold.
               2. Remove is-vanishing 150 ms later — by then the parent is
                  already invisible, so children can't snap back visibly. */
            tip.classList.remove("is-on");
            shown = null;
            window.setTimeout(function () {
              tip.classList.remove("is-vanishing");
            }, 150);
          }
        }, 850);
      }, 3000);
    }

    function disarmVanish() {
      if (vanishTimer) {
        window.clearTimeout(vanishTimer);
        vanishTimer = null;
      }
      tip.classList.remove("is-vanishing");
    }

    grid.addEventListener("mouseover", function (e) {
      var card = e.target.closest(".brand");
      if (card && card !== shown) {
        showTip(card);
        armVanish(card);
      }
    });
    grid.addEventListener("mouseleave", hideTip);
    grid.addEventListener("focusin", function (e) {
      var card = e.target.closest(".brand");
      if (card) showTip(card);
    });
    grid.addEventListener("focusout", function (e) {
      if (!grid.contains(e.relatedTarget)) hideTip();
    });

    /* A tap has to work like a hover on touch, so a single click pins.
       A double click opens the brand's own site instead — held back
       behind a short timer so the pair of clicks a dblclick fires
       doesn't also toggle the pin twice on the way there. */
    var clickTimer = null;

    function pinCard(card) {
      Array.prototype.forEach.call(cards, function (c) { c.classList.remove("is-live"); });
      if (pinned === card) {
        pinned = null;
        tip.classList.remove("is-on");
        shown = null;
        return;
      }
      pinned = card;
      card.classList.add("is-live");
      showTip(card);
    }

    grid.addEventListener("click", function (e) {
      var card = e.target.closest(".brand");
      if (!card) return;
      if (clickTimer) {
        window.clearTimeout(clickTimer);
        clickTimer = null;
        return;
      }
      clickTimer = window.setTimeout(function () {
        clickTimer = null;
        pinCard(card);
      }, 280);
    });

    grid.addEventListener("dblclick", function (e) {
      var card = e.target.closest(".brand");
      if (!card) return;
      if (clickTimer) {
        window.clearTimeout(clickTimer);
        clickTimer = null;
      }
      var url = card.getAttribute("data-url");
      if (url) window.open(url, "_blank", "noopener");
    });

    window.addEventListener("resize", function () {
      if (shown) showTip(shown);
    }, { passive: true });
  }

  /* ---- The profile readout ----------------------------------- */
  /* A panel that reads as something switched on: a clock that keeps
     Bengaluru time, and fields that resolve out of noise once you get
     to them. */
  var specs = document.getElementById("specs");
  var specsClock = document.getElementById("specs-clock");
  var specsWave = document.getElementById("specs-wave");
  var specsUptime = document.getElementById("specs-uptime");
  var pad2 = function (n) { return (n < 10 ? "0" : "") + n; };

  if (specsClock) {
    var tickClock = function () {
      // IST is a fixed offset, so it can be read straight off UTC.
      var now = new Date(Date.now() + (330 + new Date().getTimezoneOffset()) * 60000);
      specsClock.textContent = pad2(now.getHours()) + ":" + pad2(now.getMinutes()) +
                               ":" + pad2(now.getSeconds()) + " IST";
    };
    tickClock();
    window.setInterval(tickClock, 1000);
  }

  if (specsUptime) {
    // Career start: 2 Jan 2019, IST.
    var uptimeStart = new Date(Date.UTC(2019, 0, 1, 18, 30, 0));
    var tickUptime = function () {
      var now = new Date();
      var years = now.getUTCFullYear() - uptimeStart.getUTCFullYear();
      var anniv = new Date(uptimeStart.getTime());
      anniv.setUTCFullYear(uptimeStart.getUTCFullYear() + years);
      if (anniv.getTime() > now.getTime()) {
        years -= 1;
        anniv.setUTCFullYear(uptimeStart.getUTCFullYear() + years);
      }
      var rem = now.getTime() - anniv.getTime();
      var days = Math.floor(rem / 86400000); rem -= days * 86400000;
      var hours = Math.floor(rem / 3600000); rem -= hours * 3600000;
      var mins = Math.floor(rem / 60000); rem -= mins * 60000;
      var secs = Math.floor(rem / 1000);
      specsUptime.textContent = years + "Y " + days + "D " +
        pad2(hours) + ":" + pad2(mins) + ":" + pad2(secs) + " UPTIME";
    };
    tickUptime();
    window.setInterval(tickUptime, 1000);
  }

  if (specs) {
    var fields = specs.querySelectorAll("[data-decode]");
    var GLYPH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#*+=<>";

    function decode(el, delay) {
      var text = el.getAttribute("data-decode") || "";
      if (reduced) { el.textContent = text; return; }
      var done = 0;
      var t = window.setInterval(function () {
        var out = "";
        for (var i = 0; i < text.length; i++) {
          if (i < done || text.charAt(i) === " ") { out += text.charAt(i); continue; }
          out += GLYPH.charAt(Math.floor(Math.random() * GLYPH.length));
        }
        el.textContent = out;
        done += 1.4;
        if (done >= text.length) {
          window.clearInterval(t);
          el.textContent = text;
        }
      }, 34);
    }

    var runSpecs = function () {
      Array.prototype.forEach.call(fields, function (el, i) {
        window.setTimeout(function () { decode(el); }, i * 110);
      });
      if (specsWave && !reduced) {
        var shift = 0;
        window.setInterval(function () {
          shift = (shift + 1) % 6;
          specsWave.style.backgroundPosition = shift + "px 0";
        }, 90);
      }
    };

    if (!("IntersectionObserver" in window)) {
      runSpecs();
    } else {
      var specsIo = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        specsIo.disconnect();
        runSpecs();
      }, { threshold: 0.25 });
      specsIo.observe(specs);
    }
  }

  /* ---- Experience: the spine and the years ------------------- */
  /* The line fills as you read down it. The drawing beside it is
     captioned with whichever role you are level with. */
  var rolesEl = document.getElementById("roles");
  var spine = document.getElementById("roles-spine");
  var ageA = document.getElementById("ages-a");
  var ageB = document.getElementById("ages-b");
  var ageYear = document.getElementById("ages-year");
  var ageRole = document.getElementById("ages-role");

  if (rolesEl) {
    var roleEls = Array.prototype.slice.call(rolesEl.querySelectorAll(".role"));

    // Tenure, drawn to scale against the longest run.
    var longest = 1;
    roleEls.forEach(function (el) {
      var bar = el.querySelector(".role__bar");
      var m = bar ? parseInt(bar.getAttribute("data-months"), 10) || 0 : 0;
      if (m > longest) longest = m;
    });
    roleEls.forEach(function (el) {
      var bar = el.querySelector(".role__bar");
      var m = bar ? parseInt(bar.getAttribute("data-months"), 10) || 0 : 0;
      el.style.setProperty("--w", Math.max(6, Math.round((m / longest) * 100)) + "%");
    });

    var faceOn = ageA;
    var faceOff = ageB;
    var current = -1;

    function markRole(i) {
      if (i === current || i < 0 || i >= roleEls.length) return;
      current = i;
      var el = roleEls[i];
      var yearEl = el.querySelector(".role__year");
      var titleEl = el.querySelector("h3");
      var year = yearEl ? (yearEl.textContent.match(/\d{4}/) || [""])[0] : "";
      var title = titleEl && titleEl.firstChild ? titleEl.firstChild.textContent.trim() : "";
      if (ageYear && year) ageYear.textContent = year;
      if (ageRole && title) ageRole.textContent = title;

      // Further back, a little smaller. He was, after all, younger.
      if (faceOn && faceOff) {
        var scale = Math.max(0.78, 1 - i * 0.055);
        faceOff.style.setProperty("--age", scale.toFixed(3));
        faceOff.classList.add("is-on");
        faceOn.classList.remove("is-on");
        var swap = faceOn; faceOn = faceOff; faceOff = swap;
      }
    }

    function trackRoles() {
      var box = rolesEl.getBoundingClientRect();
      var mid = window.innerHeight * 0.45;

      if (spine) {
        var run = box.height + window.innerHeight * 0.25;
        var seen = mid - box.top;
        var pct = Math.max(0, Math.min(100, (seen / run) * 100));
        spine.style.setProperty("--fill", pct.toFixed(1) + "%");
      }

      var pick = -1;
      for (var i = 0; i < roleEls.length; i++) {
        if (roleEls[i].getBoundingClientRect().top <= mid) pick = i;
      }
      if (pick >= 0) markRole(pick);
    }

    markRole(0);
    trackRoles();
    window.addEventListener("scroll", trackRoles, { passive: true });
    window.addEventListener("resize", trackRoles, { passive: true });
  }

  /* ---- Stack: three orbits ----------------------------------- */
  /* Every chip is placed on its track by hand. Hovering one holds the
     whole thing still and the middle says which ring it belongs to. */
  var orbit = document.getElementById("orbit");
  var orbitLabel = document.getElementById("orbit-label");

  if (orbit) {
    var ringEls = Array.prototype.slice.call(orbit.querySelectorAll(".orbit__ring"));
    var orbHeld = 0;
    var orbLive = false, orbLoop = false, orbLast = 0;

    var tracks = ringEls.map(function (el, ri) {
      return {
        el: el,
        chips: Array.prototype.slice.call(el.querySelectorAll(".orbit__chip")),
        name: el.getAttribute("data-name") || "STACK",
        a: (ri * 2.1) % 6.2832,
        speed: [0.052, -0.036, 0.024][ri] || 0.02,
        rx: 100,
        ry: 70
      };
    });

    function sizeOrbit() {
      var w = orbit.clientWidth, h = orbit.clientHeight;
      var maxX = Math.min(w * 0.43, 620);
      var maxY = h * 0.415;
      tracks.forEach(function (r, i) {
        var k = 0.46 + i * 0.27;
        r.rx = maxX * k;
        r.ry = maxY * k;
        r.el.style.setProperty("--dx", (r.rx * 2).toFixed(0) + "px");
        r.el.style.setProperty("--dy", (r.ry * 2).toFixed(0) + "px");
      });
    }

    function placeOrbit() {
      var cx = orbit.clientWidth / 2, cy = orbit.clientHeight / 2;
      tracks.forEach(function (r) {
        var n = r.chips.length || 1;
        r.chips.forEach(function (chip, i) {
          var a = r.a + (i / n) * 6.2832;
          var x = cx + Math.cos(a) * r.rx - chip.offsetWidth / 2;
          var y = cy + Math.sin(a) * r.ry - chip.offsetHeight / 2;
          chip.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0)";
        });
      });
    }

    function orbitFrame(now) {
      if (!orbLive) { orbLoop = false; return; }
      var dt = orbLast ? Math.min(0.05, (now - orbLast) / 1000) : 0.016;
      orbLast = now;
      if (!orbHeld) {
        tracks.forEach(function (r) { r.a += r.speed * dt; });
      }
      placeOrbit();
      requestAnimationFrame(orbitFrame);
    }

    function startOrbit() {
      orbLive = true;
      orbLast = 0;
      if (!orbLoop) { orbLoop = true; requestAnimationFrame(orbitFrame); }
    }

    tracks.forEach(function (r) {
      r.chips.forEach(function (chip) {
        function hold() {
          orbHeld++;
          if (orbitLabel) orbitLabel.textContent = r.name;
        }
        function let_go() {
          orbHeld = Math.max(0, orbHeld - 1);
          if (!orbHeld && orbitLabel) orbitLabel.textContent = "STACK";
        }
        chip.addEventListener("mouseenter", hold);
        chip.addEventListener("mouseleave", let_go);
        chip.addEventListener("focus", hold);
        chip.addEventListener("blur", let_go);
      });
    });

    sizeOrbit();
    placeOrbit();
    window.addEventListener("resize", function () {
      sizeOrbit();
      placeOrbit();
    }, { passive: true });

    if (!reduced) {
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
          if (entries[0].isIntersecting) { startOrbit(); } else { orbLive = false; }
        }, { threshold: 0.05 }).observe(orbit);
      } else {
        startOrbit();
      }
    }
  }

  /* ---- The thoughtful list: the notes are dealt -------------- */
  /* They peel off the wall, turn face down, gather into a deck in the
     middle, get riffled twice, and are then dealt back out one at a
     time, each turning face up as it lands. Positions come from the
     layout rather than the viewport, so scrolling part way through does
     not throw the deck around. */
  var plist = document.getElementById("principles-list");

  if (plist) {
    var noteCards = Array.prototype.slice.call(plist.children);

    function shuffled(n) {
      var order = [];
      for (var i = 0; i < n; i++) order.push(i);
      for (i = n - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = order[i]; order[i] = order[j]; order[j] = t;
      }
      return order;
    }

    function plainShuffle() {
      shuffled(noteCards.length).forEach(function (i) { plist.appendChild(noteCards[i]); });
    }

    /* Every transform is written the same way round, so the browser can
       interpolate it a piece at a time instead of guessing at a matrix. */
    function tf(x, y, z, rx, ry, rz, s) {
      return "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px," + z.toFixed(1) + "px)" +
             " rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg)" +
             " rotateZ(" + rz.toFixed(2) + "deg) scale(" + s.toFixed(3) + ")";
    }

    function tiltOf(el) {
      return parseFloat(el.style.getPropertyValue("--tilt")) || 0;
    }

    function seats() {
      return noteCards.map(function (el) {
        return { x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop + el.offsetHeight / 2 };
      });
    }

    function middleOf(list) {
      var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      list.forEach(function (s) {
        if (s.x < minX) minX = s.x;
        if (s.x > maxX) maxX = s.x;
        if (s.y < minY) minY = s.y;
        if (s.y > maxY) maxY = s.y;
      });
      return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    }

    function runShuffle() {
      var slots = seats();
      var mid = middleOf(slots);
      var n = noteCards.length;

      /* Face down on the pile: lifted off the wall, tipped away from
         you, and each one a shade higher than the one under it. */
      function onPile(k, nudgeX, spin, out) {
        return tf(mid.x - slots[k].x + nudgeX,
                  mid.y - slots[k].y,
                  18 + k * 2.2 + (out || 0),
                  13, 180, spin, 0.9);
      }

      plist.classList.add("is-shuffling");
      noteCards.forEach(function (el, k) {
        el.style.zIndex = String(10 + k);
        el.style.willChange = "transform";
      });

      // 1. the gather, drawn inward from the middle of the wall
      var inward = [];
      for (var i = 0; i < n; i++) inward.push(i);
      inward.sort(function (a, b) {
        return Math.abs(slots[a].x - mid.x) - Math.abs(slots[b].x - mid.x);
      });
      inward.forEach(function (k, rank) {
        var el = noteCards[k];
        el.style.transition = "transform 700ms cubic-bezier(0.3, 0.85, 0.25, 1) " + (rank * 42) + "ms";
        el.style.transform = onPile(k, (rank - n / 2) * 0.8, k % 2 ? 1.5 : -1.5, 0);
      });

      /* 2. two riffles. The deck splits, each half arcs out, and the
         noteCards drop back on to the pile one after another. */
      function riffle(when, spread) {
        noteCards.forEach(function (el, k) {
          var side = k % 2 ? 1 : -1;
          window.setTimeout(function () {
            el.style.transition = "transform 340ms cubic-bezier(0.35, 0, 0.2, 1)";
            el.style.transform = onPile(k, side * spread, side * 13, 40 + (k % 2) * 14);
          }, when + k * 14);
          window.setTimeout(function () {
            el.style.transition = "transform 380ms cubic-bezier(0.25, 0.9, 0.3, 1)";
            el.style.transform = onPile(k, (k - n / 2) * 0.9, k % 2 ? 1.4 : -1.4, 0);
          }, when + 380 + k * 22);
        });
      }
      riffle(1000, 118);
      riffle(1800, 92);

      window.setTimeout(deal, 2760);

      /* 3. the deal. They are reseated in a new order, pinned back on to
         the pile, then flicked out one at a time, turning face up on the
         way and picking their tape back up as they land. */
      function deal() {
        var order = shuffled(n);
        var byPos = [];
        order.forEach(function (slot, k) { byPos[slot] = noteCards[k]; });
        byPos.forEach(function (el) { plist.appendChild(el); });

        var now = seats();
        var mid2 = middleOf(now);
        noteCards.forEach(function (el, k) {
          el.style.transition = "none";
          el.style.transform = tf(mid2.x - now[k].x, mid2.y - now[k].y, 18 + k * 2.2,
                                  13, 180, k % 2 ? 1.4 : -1.4, 0.9);
        });

        // Reading the layout back flushes those styles, so every card is
        // already on the pile before the transitions are handed out.
        void plist.offsetWidth;

        var lastLand = 0;
        noteCards.forEach(function (el, k) {
          var wait = 90 + order[k] * 98;
          var trip = 780;
          if (wait + trip > lastLand) lastLand = wait + trip;
          el.style.transition = "transform " + trip + "ms cubic-bezier(0.18, 0.86, 0.24, 1) " + wait + "ms";
          el.style.transform = tf(0, 0, 0, 0, 0, tiltOf(el), 1);
          window.setTimeout(function () {
            el.classList.add("is-home");
          }, wait + trip * 0.62);
          window.setTimeout(function () {
            el.style.zIndex = "";
            el.style.willChange = "";
            el.style.transition = "";
            el.style.transform = "";
          }, wait + trip + 40);
        });

        window.setTimeout(function () {
          plist.classList.remove("is-shuffling");
          noteCards.forEach(function (el) { el.classList.remove("is-home"); });
        }, lastLand + 80);
      }
    }

    if (reduced || !("IntersectionObserver" in window)) {
      plainShuffle();
    } else {
      var dealIo = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        dealIo.disconnect();
        runShuffle();
      }, { threshold: 0.2 });
      dealIo.observe(plist);
    }

    /* ---- Hover a note for 2s and it gets lifted into your clipboard */
    var COPY_LINES = [
      "now flex it as your own idea.",
      "guard it. royalties may apply.",
      "future main-character energy, unlocked.",
      "screenshot-and-forget, engaged.",
      "that's basically a personality now.",
      "ctrl+V it. no one will know.",
      "wisdom, zero effort required.",
      "sticky notes have no rights.",
      "peak productivity, achieved.",
      "somewhere, a fortune cookie is jealous.",
      "instant depth. deploy responsibly.",
      "you didn't earn this, but here you go.",
      "bookmark it. you'll never reread it.",
      "one step closer to your personal brand.",
      "borrowed wisdom, zero royalties owed.",
      "paste it and sound deep at parties."
    ];

    var copyToast = document.createElement("div");
    copyToast.className = "copy-toast";
    copyToast.setAttribute("aria-hidden", "true");
    document.body.appendChild(copyToast);

    var mouseX = 0, mouseY = 0;
    document.addEventListener("mousemove", function (e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
    }, { passive: true });

    var copyHoldTimer = null;
    var toastHideTimer = null;

    function showCopyToast() {
      var line = COPY_LINES[Math.floor(Math.random() * COPY_LINES.length)];
      copyToast.textContent = "Copied! " + line;
      copyToast.style.left = Math.min(mouseX + 16, window.innerWidth - 220) + "px";
      copyToast.style.top = Math.max(mouseY - 14, 8) + "px";
      copyToast.classList.add("is-on");
      if (toastHideTimer) window.clearTimeout(toastHideTimer);
      toastHideTimer = window.setTimeout(function () {
        copyToast.classList.remove("is-on");
      }, 1700);
    }

    function copyNoteText(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(showCopyToast, showCopyToast);
        return;
      }
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (err) {}
      document.body.removeChild(ta);
      showCopyToast();
    }

    noteCards.forEach(function (el) {
      el.addEventListener("mouseenter", function () {
        copyHoldTimer = window.setTimeout(function () {
          copyHoldTimer = null;
          var t = el.querySelector(".note__t");
          if (t) copyNoteText(t.textContent.trim());
        }, 2000);
      });
      el.addEventListener("mouseleave", function () {
        if (copyHoldTimer) {
          window.clearTimeout(copyHoldTimer);
          copyHoldTimer = null;
        }
      });
    });
  }

  /* ---- One pass per scroll ----------------------------------- */
  /* Everything that answers to the scroll position is read in a single
     frame from a single listener, so the page measures itself once
     rather than once per feature. */
  var scrollQueued = false;

  function scrollPass() {
    scrollQueued = false;

    var doc = document.documentElement;
    var max = Math.max(1, doc.scrollHeight - window.innerHeight);
    var p = Math.min(1, Math.max(0, (window.pageYOffset || doc.scrollTop || 0) / max));

    // the depth gauge down the right edge
    if (railPct) {
      var pct = Math.round(p * 100);
      railPct.textContent = (pct < 10 ? "0" : "") + pct;
    }
    if (tickEls.length) {
      var lit = Math.round(p * (tickEls.length - 1));
      for (var i = 0; i < tickEls.length; i++) {
        tickEls[i].classList.toggle("on", i <= lit);
      }
    }

    // The landing page keeps the HUD visually light. Once it has fully
    // passed, give the fixed controls a blurred ground of their own.
    if (markHero) root.classList.toggle("is-past-top", markHero.getBoundingClientRect().bottom <= 0);

    markForScroll();
    drawDiagram();
  }

  function onScroll() {
    if (scrollQueued) return;
    scrollQueued = true;
    raf(scrollPass);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  scrollPass();

  /* ---- Contact: slide into the DMs --------------------------- */
  /* Taken literally. A ladder on the left, a hole in the ground on the
     right, and the slide between them is the part you draw. Let go and
     the rabbit rides whatever line was drawn, on gravity and friction
     alone. Down the hole opens the DM. Anywhere else it lands on its
     head and sees stars. */
  var slide = document.getElementById("slide");

  if (slide) (function () {
    var cv = document.getElementById("slide-cv");
    var goBtn = document.getElementById("slide-go");
    var resetBtn = document.getElementById("slide-reset");
    var tip = document.getElementById("slide-tip");
    var link = document.querySelector(".contact__link");
    var DM = link ? link.getAttribute("href") : "https://www.linkedin.com/in/dhamodaranpandiyan";
    if (!cv || !cv.getContext) return;
    var g = cv.getContext("2d");

    var WAIT = 0, DRAW = 1, RIDE = 2, IN = 3, BUMP = 4;

    var STEP = 1 / 240;
    var GRAV = 1500;
    var AIR = 0.04;         // what the air takes back, per second
    var BOUNCE = 0.06;      // a slide is not a trampoline
    var RUB = 0.12;         // what a slide rubs off, per second of contact
    var VMAX = 1600;
    var DRIVE = 720;        // the shove the dial adds, per second squared
    var R = 15;             // the rabbit, as far as the slide is concerned
    var BIG = 1.4;          // and how much bigger it is drawn than that
    var DAZE = 1.7;         // seconds of seeing stars
    var WIPE = 2000;        // ms before a line that failed is rubbed out
    var AUTO = 5000;        // ms before any line is cleared off on its own
    var autoT = 0;

    /* Said once, when a line ends in the sand rather than in the hole. */
    var QUIPS = [
      "that was a face plant. draw a steeper one",
      "the sand caught it. aim lower and longer",
      "gravity 1 you 0, go again",
      "lovely line. but terrible ending",
      "the rabbit is fine. your drawing is not",
      "so close. the hole is over there"
    ];
    var lastQuip = -1;

    /* Said on the way out, in the two seconds before the tab opens. */
    var SENDOFF = [
      "in the hole. straight into my DMs",
      "delivered. try not to open with hi",
      "that landed. taking you there now",
      "one rabbit, one message. off we go",
      "clean drop. your reward is my profile"
    ];
    var lastSend = -1;
    var LOST = "that one has left the playground. wind the dial back";

    var W = 0, H = 0, ground = 0, dpr = 1;
    var plat = { x: 0, y: 0, w: 80 };
    var hole = { x: 0, y: 0, rx: 66, ry: 21, edge: [], tufts: [], stones: [] };

    /* The rim is knocked out of true and the grass around it is dealt
       once, so the hole keeps the same face from one frame to the next
       instead of crawling. */
    function digHole() {
      var i, a;
      hole.edge = [];
      for (i = 0; i < 26; i++) {
        a = (i / 26) * Math.PI * 2;
        hole.edge.push(1 + Math.sin(a * 3 + 1.1) * 0.05 + Math.sin(a * 5 + 2.7) * 0.032);
      }
      hole.tufts = [];
      for (i = 0; i < 16; i++) {
        a = (i / 16) * Math.PI * 2 + rand(-0.1, 0.1);
        if (Math.sin(a) < -0.45) continue;      // none across the back lip
        hole.tufts.push({
          a: a,
          h: rand(7, 15),
          lean: rand(-0.5, 0.5),
          blades: 2 + Math.round(Math.random())
        });
      }
      hole.stones = [];
      for (i = 0; i < 5; i++) {
        hole.stones.push({
          a: rand(0.2, Math.PI - 0.2) + (i % 2 ? Math.PI : 0),
          out: rand(1.06, 1.3),
          r: rand(2.2, 4.4)
        });
      }
    }

    function edgeAt(a) {
      var n = hole.edge.length;
      if (!n) return 1;
      var f = (a / (Math.PI * 2)) * n;
      var i = Math.floor(f);
      var t = f - i;
      var v0 = hole.edge[((i % n) + n) % n];
      var v1 = hole.edge[((i + 1) % n + n) % n];
      return v0 + (v1 - v0) * t;
    }

    /* One wobbly ring, used for every layer of the hole. */
    function ringPath(cx, cy, rx, ry, k) {
      var n = 40, i, a, r;
      g.beginPath();
      for (i = 0; i <= n; i++) {
        a = (i / n) * Math.PI * 2;
        r = edgeAt(a);
        var px = cx + Math.cos(a) * rx * (1 + (r - 1) * k);
        var py = cy + Math.sin(a) * ry * (1 + (r - 1) * k);
        if (i) g.lineTo(px, py); else g.moveTo(px, py);
      }
      g.closePath();
    }

    /* The dial on the left. Bottom is half speed, the middle is normal
       and the top is three times, and it is a real push rather than a
       fast forward: a quick rabbit leaves the chute faster, flies flatter
       and further, and lands a good deal harder. */
    var dial = { left: 0, right: 0, y: 0, w: 15, t: 0.5, held: false };

    function rate() {
      var t = dial.t;
      return t <= 0.5 ? 0.5 + t : 1 + (t - 0.5) * 8;
    }

    var line = [];          // the slide, as the points it was drawn with
    var kid = {
      x: 0, y: 0, vx: 0, vy: 0, rot: 0, spin: 0,
      mode: WAIT, t: 0, stuck: 0, squash: 0, sink: 0, phase: 0, daze: 0, blink: 0
    };
    var sent = 0;
    var splats = [];
    var puffs = [];
    var wob = 0;            // the grass, still ringing from the last landing
    var live = false, looping = false, lastT = 0, acc = 0;

    var inkText = [236, 231, 223];
    var inkAccent = [255, 82, 51];
    var inkDim = [140, 138, 132];

    /* Everything on the board is mixed from the page: the ink, the paper
       and the accent, and nothing else. That way the playground reads as
       part of the site in either theme rather than as a sticker on it. */
    var inkBg = [12, 11, 10];
    var FRAME, FRAME_DARK, TREAD, EDGE, FUR, FUR_DARK, FUR_LIGHT, INK, RIM, PIT;

    function parse(v) {
      if (!v) return null;
      v = v.trim();
      if (v.charAt(0) === "#") {
        var h = v.slice(1);
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        var n = parseInt(h, 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      }
      var m = v.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
      return m ? [+m[1], +m[2], +m[3]] : null;
    }

    /* A tone somewhere between the ink and the paper. One ramp, used for
       every solid thing on the board. */
    function mix(k) {
      return "rgb(" +
        Math.round(inkBg[0] + (inkText[0] - inkBg[0]) * k) + "," +
        Math.round(inkBg[1] + (inkText[1] - inkBg[1]) * k) + "," +
        Math.round(inkBg[2] + (inkText[2] - inkBg[2]) * k) + ")";
    }

    function readInk() {
      var cs = getComputedStyle(root);
      inkText = parse(cs.getPropertyValue("--text")) || inkText;
      inkAccent = parse(cs.getPropertyValue("--accent")) || inkAccent;
      inkDim = parse(cs.getPropertyValue("--dim")) || inkDim;
      inkBg = parse(cs.getPropertyValue("--bg")) || inkBg;

      FRAME = mix(0.5);
      FRAME_DARK = mix(0.36);
      TREAD = mix(0.68);
      EDGE = mix(0.62);
      FUR = mix(0.52);
      FUR_DARK = mix(0.36);
      FUR_LIGHT = mix(0.16);   // the belly, which reads pale either way
      INK = mix(0.88);         // one outline weight, on everything
      RIM = mix(0.44);
      PIT = "rgba(0,0,0,0.62)";
    }

    function tA(a) { return "rgba(" + inkText.join(",") + "," + a + ")"; }
    function dA(a) { return "rgba(" + inkDim.join(",") + "," + a + ")"; }
    function shirt() { return "rgb(" + inkAccent.join(",") + ")"; }

    readInk();
    if (toggle) toggle.addEventListener("click", function () { readInk(); paint(); });

    function rand(a, b) { return a + Math.random() * (b - a); }

    function size() {
      var r = slide.getBoundingClientRect();
      W = Math.max(1, r.width);
      H = Math.max(1, r.height);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Room above for a pair of ears, and room below for the rim of
      // the hole and the grass around it.
      ground = H - 46;
      plat.w = Math.min(96, Math.max(66, W * 0.075));
      plat.x = Math.max(96, W * 0.14);
      plat.y = Math.max(62, H * 0.22);

      hole.rx = Math.min(96, Math.max(52, W * 0.085));
      hole.ry = hole.rx * 0.33;
      hole.x = W - hole.rx - Math.max(24, W * 0.05);
      hole.y = ground - 4;

      // A horizontal control in the open space above the destination.
      dial.left = Math.min(W - 130, Math.max(60, W * 0.62));
      dial.right = Math.max(dial.left + Math.min(92, W * 0.3), Math.min(W - 36, W * 0.9));
      dial.y = Math.max(24, H * 0.08);
      if (!hole.edge.length) digHole();

      line = [];
      if (kid.mode === WAIT || kid.mode === DRAW) park();
    }

    function park() {
      kid.x = plat.x + plat.w - 26;
      kid.y = plat.y - R;
      kid.vx = kid.vy = 0;
      kid.rot = 0;
      kid.spin = 0;
      kid.t = 0;
      kid.stuck = 0;
      kid.squash = 0;
      kid.sink = 0;
      kid.daze = 0;
      kid.phase = 0;
      kid.mode = WAIT;
    }

    /* A slide the rabbit can always ride, for the button and for a tap on
       a phone, so nobody is left looking at an empty frame. */
    function preset() {
      var x0 = plat.x + plat.w - 4;
      var y0 = plat.y + 2;
      var x1 = hole.x - hole.rx * rand(0.5, 0.8);
      var y1 = ground - rand(30, 44);
      var bend = rand(1.5, 2.1);
      var pts = [];
      var i, t;
      for (i = 0; i <= 44; i++) {
        t = i / 44;
        pts.push({
          x: x0 + (x1 - x0) * t,
          y: y0 + (y1 - y0) * (1 - Math.pow(1 - t, bend))
        });
      }
      // the lip at the bottom, tipped towards the hole
      for (i = 1; i <= 8; i++) {
        t = i / 8;
        pts.push({ x: x1 + hole.rx * 0.34 * t, y: y1 + 8 * t * t });
      }
      return pts;
    }

    /* ---- the ride ---- */
    function ride(h) {
      var k = kid;
      k.vy += GRAV * h;
      k.vx -= k.vx * AIR * h;
      k.vy -= k.vy * AIR * h;

      var r = rate();
      var cap = VMAX * Math.max(1, r);
      var sp = Math.sqrt(k.vx * k.vx + k.vy * k.vy);
      if (sp > cap) { k.vx = k.vx / sp * cap; k.vy = k.vy / sp * cap; }

      k.x += k.vx * h;
      k.y += k.vy * h;

      var met = false;
      for (var pass = 0; pass < 2; pass++) { if (touch()) met = true; }
      if (met) {
        var rub = Math.exp(-RUB * h);
        k.vx *= rub;
        k.vy *= rub;

        // The dial only has a hold on the rabbit while it is on the
        // slide. Once it is in the air, gravity has the last word.
        if (r !== 1) {
          var on = Math.sqrt(k.vx * k.vx + k.vy * k.vy);
          if (on > 1) {
            var push = (r - 1) * DRIVE * h;
            if (push < 0) push = Math.max(push, -on * 0.9);
            k.vx += (k.vx / on) * push;
            k.vy += (k.vy / on) * push;
          }
        }
      }
      k.squash += ((met ? 1 : 0) - k.squash) * Math.min(1, 8 * h);
      // The legs keep up with the ground going past.
      k.phase += (sp * 0.02 + 5) * h;

      // down the hole
      var dx = (k.x - hole.x) / hole.rx;
      var dy = (k.y - (hole.y - 6)) / (hole.ry + 12);
      if (dx * dx + dy * dy < 1 && k.vy > -20) { arrive(); return; }

      if (k.y + R > ground) {
        k.y = ground - R;
        if (k.vy > 260) { thud(); return; }      // a landing worth a bump
        if (k.vy > 90) dust(k.x, ground, 5);
        k.vy *= -0.24;
        k.vx *= 0.86;
      }

      k.t += h;
      var slow = sp < 34;
      k.stuck = slow ? k.stuck + h : 0;
      if (k.stuck > 0.7 || k.t > 9) { thud(); return; }
      if (k.x < -40 || k.x > W + 40) { lost(); return; }

      if (sp > 20) {
        var want = Math.atan2(k.vy, k.vx);
        var d = want - k.rot;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        k.rot += d * Math.min(1, 9 * h);
      }
    }

    /* The slide, one segment at a time, with the platform counted in as
       the ground the rabbit starts on. */
    function touch() {
      var k = kid;
      var met = false;
      var n = line.length;
      for (var i = -1; i + 1 < n; i++) {
        var ax, ay, bx, by;
        if (i < 0) {
          ax = plat.x; ay = plat.y;
          bx = plat.x + plat.w; by = plat.y;
        } else {
          ax = line[i].x; ay = line[i].y;
          bx = line[i + 1].x; by = line[i + 1].y;
        }
        var ex = bx - ax, ey = by - ay;
        var len2 = ex * ex + ey * ey;
        if (len2 < 0.001) continue;
        var t = ((k.x - ax) * ex + (k.y - ay) * ey) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        var qx = ax + ex * t, qy = ay + ey * t;
        var dx = k.x - qx, dy = k.y - qy;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d >= R) continue;

        var nx, ny;
        if (d > 0.001) { nx = dx / d; ny = dy / d; }
        else { var l = Math.sqrt(len2); nx = -ey / l; ny = ex / l; }

        k.x += nx * (R - d);
        k.y += ny * (R - d);

        met = true;
        var vn = k.vx * nx + k.vy * ny;
        if (vn < 0) {
          k.vx -= nx * vn * (1 + BOUNCE);
          k.vy -= ny * vn * (1 + BOUNCE);
        }
      }
      return met;
    }

    function dust(x, y, n) {
      for (var i = 0; i < n; i++) {
        puffs.push({
          x: x + rand(-8, 8), y: y - rand(0, 6),
          vx: rand(-70, 70), vy: rand(-50, -10),
          r: rand(4, 10), grow: rand(24, 50),
          life: 0, max: rand(0.4, 0.8)
        });
      }
    }

    /* Landed anywhere that is not the hole. Over it goes. */
    function thud() {
      var k = kid;
      if (k.mode !== RIDE) return;
      k.mode = BUMP;
      k.daze = 0;
      k.y = Math.min(k.y, ground - R);
      k.spin = k.vx > 0 ? 7 : -7;
      k.vx = 0;
      k.vy = 0;
      dust(k.x, ground, 8);
      clearSoon();
      window.setTimeout(function () { park(); wake(); }, DAZE * 1000);
      window.setTimeout(function () {
        // The line that failed is rubbed out, and the frame is left
        // empty for the next one.
        line = [];
        paint();
        quip();
      }, WIPE);
      wake();
    }

    function say(words, hold) {
      if (!tip) return;
      tip.textContent = words;
      tip.classList.add("is-on");
      window.clearTimeout(say.off);
      say.off = window.setTimeout(function () {
        tip.classList.remove("is-on");
      }, hold || 2400);
    }

    function quip() {
      var i = Math.floor(Math.random() * QUIPS.length);
      if (i === lastQuip) i = (i + 1) % QUIPS.length;
      lastQuip = i;
      say(QUIPS[i]);
    }

    function hideQuip() {
      if (!tip) return;
      window.clearTimeout(say.off);
      tip.classList.remove("is-on");
    }

    /* Sent so hard it clears the whole playground. */
    function lost() {
      if (kid.mode !== RIDE) return;
      park();
      clearSoon();
      window.setTimeout(function () {
        line = [];
        paint();
        say(LOST, 3000);
      }, WIPE);
      wake();
    }

    function splash() {
      var i;
      for (i = 0; i < 34; i++) {
        var a = rand(-2.9, -0.25);
        var s = rand(140, 460);
        splats.push({
          x: hole.x + rand(-hole.rx * 0.45, hole.rx * 0.45),
          y: hole.y - 10,
          vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          r: i % 6 === 0 ? rand(7, 11) : rand(3, 7),
          rot: rand(0, 6.28), vr: rand(-9, 9),
          life: 0, max: rand(0.7, 1.3)
        });
      }
      for (i = 0; i < 7; i++) {
        puffs.push({
          x: hole.x + rand(-hole.rx * 0.6, hole.rx * 0.6),
          y: hole.y - rand(4, 16),
          vx: rand(-80, 80), vy: rand(-70, -20),
          r: rand(6, 13), grow: rand(30, 60),
          life: 0, max: rand(0.5, 0.95), mud: true
        });
      }
      wob = 1;
    }

    function arrive() {
      kid.mode = IN;
      kid.t = 0;
      kid.sink = 0;
      sent++;
      splash();
      if (link) {
        link.classList.add("is-hit");
        window.setTimeout(function () { link.classList.remove("is-hit"); }, 4000);
      }
      // Two seconds of gloating, then the tab. It still rides on the
      // click or drag that sent the rabbit off, so the browser counts it
      // as something that was asked for.
      var i = Math.floor(Math.random() * SENDOFF.length);
      if (i === lastSend) i = (i + 1) % SENDOFF.length;
      lastSend = i;
      say(SENDOFF[i], 2600);
      window.setTimeout(function () {
        var w = null;
        try { w = window.open(DM, "_blank", "noopener"); } catch (err) {}
        park();
        wake();
        if (!w) say("your browser held the door shut. the link is right below", 4000);
      }, 2000);
      clearSoon();
    }

    function step(h) {
      if (kid.mode === RIDE) ride(h);
      if (kid.mode === IN) {
        kid.sink = Math.min(1, kid.sink + h * 3.2);
        kid.t += h;
      }
      if (kid.mode === BUMP) {
        kid.daze += h;
        kid.spin -= kid.spin * Math.min(1, 6 * h);
        kid.rot += kid.spin * h;
        // It settles back on its feet while the stars go round.
        kid.rot -= kid.rot * Math.min(1, 3 * h);
      }
      if (kid.mode === WAIT) {
        kid.blink += h;
        if (kid.blink > 3.4) kid.blink = 0;
      }
      if (wob > 0) wob = Math.max(0, wob - h * 1.6);

      var i, o;
      for (i = puffs.length - 1; i >= 0; i--) {
        o = puffs[i];
        o.vy -= 26 * h;
        o.x += o.vx * h; o.y += o.vy * h;
        o.r += o.grow * h;
        o.life += h;
        if (o.life > o.max) puffs.splice(i, 1);
      }
      for (i = splats.length - 1; i >= 0; i--) {
        o = splats[i];
        o.vy += GRAV * h;
        o.x += o.vx * h; o.y += o.vy * h;
        o.rot += o.vr * h;
        if (o.y > ground && o.vy > 0) { o.y = ground; o.vy *= -0.24; o.vx *= 0.6; o.vr *= 0.5; }
        o.life += h;
        if (o.life > o.max) splats.splice(i, 1);
      }
    }

    /* ---- the playground ---- */
    /* The steps, drawn the way a toy is: fat rounded shapes, one weight
       of outline on all of them, and nothing standing above the deck so
       the top of it stays clear. */
    function bead(x, y, w, h, r, fill) {
      g.beginPath();
      g.moveTo(x + r, y);
      g.lineTo(x + w - r, y);
      g.quadraticCurveTo(x + w, y, x + w, y + r);
      g.lineTo(x + w, y + h - r);
      g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      g.lineTo(x + r, y + h);
      g.quadraticCurveTo(x, y + h, x, y + h - r);
      g.lineTo(x, y + r);
      g.quadraticCurveTo(x, y, x + r, y);
      g.closePath();
      g.fillStyle = fill;
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 2;
      g.stroke();
    }

    function drawLadder() {
      var x = plat.x, y = plat.y, w = plat.w;
      var n = 6;
      var foot = Math.max(24, x - Math.min(190, W * 0.16));
      var accent = "rgb(" + inkAccent.join(",") + ")";
      var i;

      g.lineCap = "round";
      g.lineJoin = "round";

      function post(x1, y1, x2, y2, wide) {
        g.strokeStyle = INK;
        g.lineWidth = wide + 4;
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.stroke();
        g.strokeStyle = FRAME;
        g.lineWidth = wide;
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.stroke();
      }

      // The leg the deck stands on, at the far side.
      post(x + w - 16, ground - 2, x + w - 22, y + 16, 13);

      /* The ladder itself: two rails the same distance apart the whole
         way up, with the rungs square across them. */
      var topX = x + 14, topY = y + 6;
      var dx = topX - foot, dy = topY - ground;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var ux = dx / len, uy = dy / len;
      var px = -uy, py = ux;
      var half = 16;

      post(foot + px * half, ground + py * half, topX + px * half, topY + py * half, 11);
      post(foot - px * half, ground - py * half, topX - px * half, topY - py * half, 11);

      for (i = 1; i <= n; i++) {
        var t = i / (n + 0.7);
        var cx = foot + dx * t, cy = ground + dy * t;
        g.save();
        g.translate(cx, cy);
        g.rotate(Math.atan2(py, px));
        bead(-half - 5, -5.5, half * 2 + 10, 11, 5, TREAD);
        g.restore();
      }

      /* A handrail on the near side, parallel to the rails, standing off
         on two short posts. */
      var off = half + 22;
      var r1x = foot + ux * len * 0.16 - px * off, r1y = ground + uy * len * 0.16 - py * off;
      var r2x = foot + ux * len * 0.88 - px * off, r2y = ground + uy * len * 0.88 - py * off;
      post(r1x + px * off * 0.62, r1y + py * off * 0.62, r1x, r1y, 5);
      post(r2x + px * off * 0.62, r2y + py * off * 0.62, r2x, r2y, 5);
      g.strokeStyle = INK;
      g.lineWidth = 9;
      g.beginPath();
      g.moveTo(r1x, r1y);
      g.lineTo(r2x, r2y);
      g.stroke();
      g.strokeStyle = accent;
      g.lineWidth = 5.5;
      g.beginPath();
      g.moveTo(r1x, r1y);
      g.lineTo(r2x, r2y);
      g.stroke();

      // the deck, the only thing standing at the top
      bead(x - 6, y - 3, w + 12, 13, 6.5, accent);
      g.beginPath();
      g.moveTo(x, y + 1);
      g.lineTo(x + w, y + 1);
      g.strokeStyle = "rgba(255,255,255,0.35)";
      g.lineWidth = 2;
      g.stroke();
    }

    function trace(off, width, colour) {
      g.beginPath();
      g.moveTo(line[0].x, line[0].y + off);
      for (var i = 1; i < line.length; i++) g.lineTo(line[i].x, line[i].y + off);
      g.strokeStyle = colour;
      g.lineWidth = width;
      g.stroke();
    }

    /* The drawn line, built into a slide: slim, with a lip along the near
       side, a shine down the middle and legs holding it up. */
    function drawSlide() {
      if (line.length < 2) return;
      var last = line[line.length - 1];
      var mid = line[Math.floor(line.length * 0.62)];
      var accent = "rgb(" + inkAccent.join(",") + ")";

      g.lineCap = "round";
      g.lineJoin = "round";

      // the legs under it
      g.strokeStyle = FRAME_DARK;
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(mid.x, mid.y + 4);
      g.lineTo(mid.x, ground);
      g.moveTo(last.x - 8, last.y + 4);
      g.lineTo(last.x - 8, ground);
      g.stroke();
      g.strokeStyle = INK;
      g.lineWidth = 1.4;
      g.stroke();

      trace(3.5, 11, INK);            // the outline, in one weight
      trace(3.5, 8, FRAME_DARK);      // the underside
      trace(0, 9, accent);            // the bed
      trace(-2.6, 2, "rgba(255,255,255,0.4)");
    }

    function drawHole() {
      var x = hole.x, y = hole.y, rx = hole.rx, ry = hole.ry;
      var w = wob * Math.sin(wob * 26) * 3;
      var accent = "rgb(" + inkAccent.join(",") + ")";
      var i, t, tx, ty, b;

      g.save();
      g.lineJoin = "round";
      g.lineCap = "round";

      // the earth thrown up around it, sitting a little proud of the ground
      ringPath(x, y + 3 + w * 0.3, rx * 1.04, ry * 1.12, 1);
      g.fillStyle = FRAME_DARK;
      g.fill();

      ringPath(x, y + w * 0.3, rx, ry, 1);
      g.fillStyle = RIM;
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 2.4;
      g.stroke();

      // the sides of the shaft, each ring a little further in and darker,
      // which is what gives it a floor to fall towards
      ringPath(x, y + 1 + w * 0.22, rx * 0.87, ry * 0.8, 0.9);
      g.fillStyle = mix(0.3);
      g.fill();
      ringPath(x + rx * 0.02, y + 2 + w * 0.16, rx * 0.74, ry * 0.62, 0.8);
      g.fillStyle = mix(0.17);
      g.fill();
      ringPath(x + rx * 0.04, y + 3 + w * 0.1, rx * 0.58, ry * 0.44, 0.7);
      g.fillStyle = PIT;
      g.fill();

      // something is lit down there
      var glow = g.createRadialGradient(x + rx * 0.04, y + 4, 1,
                                        x + rx * 0.04, y + 4, rx * 0.6);
      glow.addColorStop(0, "rgba(" + inkAccent.join(",") + ",0.34)");
      glow.addColorStop(0.6, "rgba(" + inkAccent.join(",") + ",0.08)");
      glow.addColorStop(1, "rgba(" + inkAccent.join(",") + ",0)");
      ringPath(x + rx * 0.04, y + 3 + w * 0.1, rx * 0.58, ry * 0.44, 0.7);
      g.fillStyle = glow;
      g.fill();

      // the near lip, caught by the light
      g.beginPath();
      g.ellipse(x, y + 1 + w * 0.22, rx * 0.87, ry * 0.8, 0, Math.PI + 0.35, -0.35);
      g.strokeStyle = accent;
      g.lineWidth = 2.6;
      g.stroke();

      // a few stones turned out with the digging
      for (i = 0; i < hole.stones.length; i++) {
        b = hole.stones[i];
        tx = x + Math.cos(b.a) * rx * b.out;
        ty = y + Math.sin(b.a) * ry * b.out + w * 0.3;
        g.beginPath();
        g.ellipse(tx, ty, b.r, b.r * 0.72, b.a, 0, 6.2832);
        g.fillStyle = RIM;
        g.fill();
        g.strokeStyle = INK;
        g.lineWidth = 1.2;
        g.stroke();
      }

      // and the grass that has grown back over the spoil
      g.strokeStyle = EDGE;
      g.lineWidth = 2;
      for (i = 0; i < hole.tufts.length; i++) {
        t = hole.tufts[i];
        tx = x + Math.cos(t.a) * rx * 0.94;
        ty = y + Math.sin(t.a) * ry * 0.94 + w * 0.3;
        for (b = 0; b < t.blades; b++) {
          var lean = t.lean + (b - 1) * 0.55;
          g.beginPath();
          g.moveTo(tx, ty + 1);
          g.quadraticCurveTo(tx + lean * t.h * 0.4, ty - t.h * 0.6,
                             tx + lean * t.h, ty - t.h);
          g.stroke();
        }
      }
      g.restore();
    }

    /* ---- the rabbit ---- */
    function leg(hx, hy, p, len, colour, wide) {
      // The foot goes round a small oval, which is all a run cycle is.
      var fx = hx + Math.cos(p) * len * 0.75;
      var fy = hy + len - Math.max(0, Math.sin(p)) * len * 0.85;
      var kx = (hx + fx) / 2 + 2;
      var ky = (hy + fy) / 2 - 1;
      g.strokeStyle = colour;
      g.lineWidth = wide;
      g.lineCap = "round";
      g.lineJoin = "round";
      g.beginPath();
      g.moveTo(hx, hy);
      g.quadraticCurveTo(kx, ky, fx, fy);
      g.stroke();
      g.beginPath();
      g.ellipse(fx + 1.5, fy, 3.4, 2, 0, 0, 6.2832);
      g.fillStyle = colour;
      g.fill();
    }

    function star(x, y, r, a) {
      g.save();
      g.translate(x, y);
      g.rotate(a);
      g.beginPath();
      for (var i = 0; i < 10; i++) {
        var rr = i % 2 ? r * 0.44 : r;
        var t = (i / 10) * Math.PI * 2 - Math.PI / 2;
        var px = Math.cos(t) * rr, py = Math.sin(t) * rr;
        if (i) g.lineTo(px, py); else g.moveTo(px, py);
      }
      g.closePath();
      g.fillStyle = "rgb(" + inkAccent.join(",") + ")";
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 0.9;
      g.stroke();
      g.restore();
    }

    function drawRabbit() {
      var k = kid;
      if (k.mode === IN && k.sink >= 1) return;

      var v = Math.sqrt(k.vx * k.vx + k.vy * k.vy);
      var riding = k.mode === RIDE;
      var dazed = k.mode === BUMP;
      var s = k.mode === IN ? 1 - k.sink : 1;
      if (s <= 0) return;

      var accent = "rgb(" + inkAccent.join(",") + ")";
      var p = k.phase;
      var bob = riding ? Math.sin(p * 2) * 1.2 : 0;
      var flat = dazed ? Math.max(0, 0.34 - k.daze * 0.9) : k.squash * 0.07;

      g.save();
      g.translate(k.x, k.y + (k.mode === IN ? k.sink * 14 : 0));
      g.rotate(dazed ? k.rot : k.rot * 0.5);
      g.scale(s * BIG * (1 + flat * 0.6), s * BIG * (1 - flat));
      g.translate(0, bob);

      g.lineJoin = "round";
      g.lineCap = "round";

      /* The cape, drawn first so it sits behind everything. It streams
         out with the speed and hangs in a flutter when there is none. */
      var reach = riding ? 20 + Math.min(16, v / 42) : 13;
      var lift = riding ? -8 : 4;
      var wave = Math.sin((riding ? p * 2.6 : k.blink * 3 + k.daze * 6)) * 3;
      g.beginPath();
      g.moveTo(5, -9);
      g.quadraticCurveTo(-6, -13 + wave, -reach, lift + wave * 1.4);
      g.quadraticCurveTo(-reach + 5, lift + 7 + wave, -reach + 1, lift + 13);
      g.quadraticCurveTo(-9, 8 - wave * 0.4, 4, 2);
      g.closePath();
      g.fillStyle = accent;
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 1.6;
      g.stroke();

      // the far pair of legs
      if (riding) {
        leg(-5, 4, p + Math.PI, 11, FUR_DARK, 3.4);
        leg(7, 4, p, 9, FUR_DARK, 3);
      } else {
        leg(-5, 4, dazed ? 1.2 : 1.9, 10, FUR_DARK, 3.4);
        leg(7, 4, dazed ? 2.4 : 1.5, 8, FUR_DARK, 3);
      }

      // the body
      g.beginPath();
      g.ellipse(0, 0, 15, 10.2, -0.06, 0, 6.2832);
      g.fillStyle = FUR;
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 1.8;
      g.stroke();

      // the haunch, which is the bit that makes a rabbit a rabbit
      g.beginPath();
      g.ellipse(-5, 1.5, 10.2, 9.2, 0, 0, 6.2832);
      g.fillStyle = FUR_DARK;
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 1.2;
      g.stroke();

      // the tail, a puff clear of the back so it can be seen
      g.beginPath();
      g.arc(-16.5, -2.5, 5.2, 0, 6.2832);
      g.fillStyle = FUR_LIGHT;
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 1.5;
      g.stroke();

      // the suit across the chest
      g.save();
      g.beginPath();
      g.ellipse(0, 0, 14.6, 9.9, -0.06, 0, 6.2832);
      g.clip();
      g.fillStyle = accent;
      g.fillRect(1, -12, 22, 24);
      g.restore();

      // and the badge on it
      g.beginPath();
      g.moveTo(7.5, -5.6);
      g.lineTo(11.6, -1.6);
      g.lineTo(7.5, 2.6);
      g.lineTo(3.6, -1.6);
      g.closePath();
      g.fillStyle = FUR_LIGHT;
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 1.1;
      g.stroke();
      g.beginPath();
      g.moveTo(8.6, -4);
      g.lineTo(6.2, -1.2);
      g.lineTo(8, -1.2);
      g.lineTo(6.4, 1.4);
      g.strokeStyle = accent;
      g.lineWidth = 1.3;
      g.stroke();

      // the near pair of legs
      if (riding) {
        leg(-5, 5, p, 12, FUR, 4);
        leg(8, 5, p + Math.PI, 10, FUR, 3.4);
      } else {
        leg(-5, 5, dazed ? 2.6 : 2.1, 11, FUR, 4);
        leg(8, 5, dazed ? 0.9 : 1.2, 9, FUR, 3.4);
      }

      // the head
      var hx = 14.5, hy = -8;
      g.beginPath();
      g.ellipse(hx, hy, 9.2, 8.2, -0.15, 0, 6.2832);
      g.fillStyle = FUR;
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 1.8;
      g.stroke();

      // the ears, swept back by the speed of the thing
      // Standing still they go up. At speed they lie back along the wind.
      var sweep = riding ? -1.2 - Math.min(0.55, v / 1400) : 1.42;
      var flap = riding ? Math.sin(p * 1.5) * 0.16
                        : (dazed ? Math.sin(k.daze * 9) * 0.12 : 0);
      for (var e = 0; e < 2; e++) {
        g.save();
        g.translate(hx + 1, hy - 4.5);
        g.rotate(sweep + flap + (riding ? e * 0.34 : e * 0.3 - 0.15));
        g.beginPath();
        g.ellipse(-11, 0, 12.5, 3.6, 0, 0, 6.2832);
        g.fillStyle = e ? FUR_DARK : FUR;
        g.fill();
        g.strokeStyle = INK;
        g.lineWidth = 1.5;
        g.stroke();
        g.beginPath();
        g.ellipse(-11.5, 0, 8.4, 1.6, 0, 0, 6.2832);
        g.fillStyle = FUR_LIGHT;
        g.fill();
        g.restore();
      }

      // the muzzle and the cheek under it
      g.beginPath();
      g.ellipse(hx + 5.4, hy + 3.4, 5, 4, 0, 0, 6.2832);
      g.fillStyle = FUR_LIGHT;
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 1.2;
      g.stroke();

      // the face
      g.fillStyle = INK;
      g.strokeStyle = INK;
      if (dazed) {
        g.lineWidth = 1.4;
        g.beginPath();
        g.moveTo(hx + 1.4, hy - 1.8); g.lineTo(hx + 5, hy - 0.2);
        g.moveTo(hx + 5, hy - 1.8); g.lineTo(hx + 1.4, hy - 0.2);
        g.stroke();
      } else if (k.mode === WAIT && k.blink > 3.2) {
        g.lineWidth = 1.4;
        g.beginPath();
        g.moveTo(hx + 1.4, hy - 1); g.lineTo(hx + 5, hy - 1);
        g.stroke();
      } else {
        g.beginPath();
        g.arc(hx + 3.2, hy - 1, 1.9, 0, 6.2832);
        g.fill();
        g.beginPath();
        g.arc(hx + 3.8, hy - 1.7, 0.7, 0, 6.2832);
        g.fillStyle = FUR_LIGHT;
        g.fill();
        g.fillStyle = INK;
      }
      g.beginPath();
      g.arc(hx + 8.4, hy + 2.4, 1.5, 0, 6.2832);
      g.fill();
      g.lineWidth = 0.9;
      g.beginPath();
      g.moveTo(hx + 8, hy + 3.4); g.lineTo(hx + 13.5, hy + 2);
      g.moveTo(hx + 8, hy + 3.9); g.lineTo(hx + 13.5, hy + 5.2);
      g.stroke();

      g.restore();

      // the stars belong to the world, not to the rabbit, so they keep
      // going round the same way up whatever it is doing
      if (dazed) {
        var fade = Math.min(1, (DAZE - k.daze) * 3);
        g.save();
        g.globalAlpha = Math.max(0, Math.min(1, fade));
        for (var i = 0; i < 3; i++) {
          var a = k.daze * 6.4 + i * 2.094;
          star(k.x + 18 + Math.cos(a) * 19, k.y - 26 + Math.sin(a) * 7, 5.6, a * 0.7);
        }
        g.restore();
      }
    }

    /* Drawn the way a volume slider is: a track, a fill to where the
       knob sits, and the knob itself. */
    function drawDial() {
      var left = dial.left, right = dial.right, y = dial.y, w = dial.w;
      var x = left + dial.t * (right - left);
      var r = rate();
      var accent = "rgb(" + inkAccent.join(",") + ")";

      g.save();
      g.lineCap = "round";

      // the track
      g.strokeStyle = tA(0.1);
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(left, y);
      g.lineTo(right, y);
      g.stroke();
      g.strokeStyle = tA(0.2);
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(left, y);
      g.lineTo(right, y);
      g.stroke();

      // how much of it is being asked for
      g.strokeStyle = accent;
      g.lineWidth = w - 5;
      g.beginPath();
      g.moveTo(left, y);
      g.lineTo(Math.max(left, x - 0.1), y);
      g.stroke();

      // the marks it settles between
      g.strokeStyle = tA(0.28);
      g.lineWidth = 1.2;
      g.beginPath();
      for (var m = 0; m < 3; m++) {
        var mx = left + (m / 2) * (right - left);
        g.moveTo(mx, y - w * 0.72);
        g.lineTo(mx, y - w * 0.72 - 5);
      }
      g.stroke();

      // the knob
      g.beginPath();
      g.arc(x, y, 11, 0, 6.2832);
      g.fillStyle = accent;
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 1.8;
      g.stroke();

      // a chevron on it, pointing the way more speed is
      g.strokeStyle = mix(0.05);
      g.lineWidth = 2;
      g.lineJoin = "round";
      g.beginPath();
      g.moveTo(x - 1.6, y - 3.6);
      g.lineTo(x + 2.4, y);
      g.lineTo(x - 1.6, y + 3.6);
      g.stroke();

      // what it is, and what it is set to. The reading rides along with
      // the knob so the two are never read apart.
      g.font = "600 9px ui-monospace, SFMono-Regular, Consolas, monospace";
      g.textBaseline = "middle";
      if ("letterSpacing" in g) g.letterSpacing = "1.6px";
      g.textAlign = "left";
      g.fillStyle = tA(0.5);
      g.fillText("SPEED", left, y - 22);
      if ("letterSpacing" in g) g.letterSpacing = "0px";

      g.font = "700 11px ui-monospace, SFMono-Regular, Consolas, monospace";
      g.textAlign = "center";
      g.fillStyle = accent;
      g.fillText(r.toFixed(1) + "x", x, y - 17);

      g.font = "500 9px ui-monospace, SFMono-Regular, Consolas, monospace";
      g.textAlign = "center";
      g.fillStyle = tA(0.32);
      g.fillText("drag", right, y + 20);
      g.restore();
    }

    function paint() {
      g.clearRect(0, 0, W, H);

      /* No ground line at all. The feet of the ladder and the rim of the
         hole are enough to say where the ground is. */

      drawDial();
      drawHole();
      drawLadder();
      drawSlide();

      var k, o, t;
      for (k = 0; k < puffs.length; k++) {
        o = puffs[k];
        t = o.life / o.max;
        var a = (1 - t) * (1 - t) * (o.mud ? 0.3 : 0.2);
        var rg = g.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        if (o.mud) {
          rg.addColorStop(0, "rgba(107,74,48," + a + ")");
          rg.addColorStop(0.6, "rgba(107,74,48," + (a * 0.4) + ")");
          rg.addColorStop(1, "rgba(107,74,48,0)");
        } else {
          rg.addColorStop(0, dA(a));
          rg.addColorStop(0.6, dA(a * 0.4));
          rg.addColorStop(1, dA(0));
        }
        g.fillStyle = rg;
        g.beginPath();
        g.arc(o.x, o.y, o.r, 0, 6.2832);
        g.fill();
      }

      drawRabbit();

      for (k = 0; k < splats.length; k++) {
        o = splats[k];
        t = o.life / o.max;
        g.save();
        g.globalAlpha = 1 - t * t;
        g.translate(o.x, o.y);
        g.rotate(o.rot);
        g.beginPath();
        g.ellipse(0, 0, o.r, o.r * 0.72, 0, 0, 6.2832);
        g.fillStyle = k % 4 === 0 ? "rgb(" + inkAccent.join(",") + ")" : RIM;
        g.fill();
        g.restore();
      }

      // one mark for every one that went down
      for (k = 0; k < sent && k < 14; k++) {
        g.beginPath();
        g.arc(W - 10 - k * 13, 12, 3.4, 0, 6.2832);
        g.fillStyle = "rgba(" + inkAccent.join(",") + ",0.55)";
        g.fill();
      }
    }

    function busy() {
      return kid.mode === RIDE || kid.mode === IN || kid.mode === BUMP ||
             puffs.length || splats.length || wob > 0;
    }

    function frame(now) {
      if (!live) { looping = false; return; }
      if (!lastT) lastT = now;
      var dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      acc += dt;
      var n = 0;
      while (acc >= STEP && n < 12) { step(STEP); acc -= STEP; n++; }
      if (n === 12) acc = 0;
      paint();
      if (!busy()) { live = false; looping = false; return; }
      requestAnimationFrame(frame);
    }

    function wake() {
      live = true;
      if (!looping) { looping = true; lastT = 0; acc = 0; requestAnimationFrame(frame); }
    }

    function clearSoon() {
      window.clearTimeout(autoT);
      autoT = window.setTimeout(function () {
        if (kid.mode === RIDE || kid.mode === DRAW) return;
        line = [];
        paint();
      }, AUTO);
    }

    function go() {
      hideQuip();
      window.clearTimeout(autoT);
      if (line.length < 2) line = preset();
      park();
      kid.mode = RIDE;
      kid.vx = 90 * rate();
      kid.vy = 0;
      wake();
    }

    /* ---- drawing the slide ---- */
    function local(e) {
      var r = cv.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    function onDial(p) {
      return p.x > dial.left - 18 && p.x < dial.right + 18 && Math.abs(p.y - dial.y) < 26;
    }

    function setDial(p) {
      var t = (p.x - dial.left) / (dial.right - dial.left);
      dial.t = t < 0 ? 0 : t > 1 ? 1 : t;
      paint();
    }

    cv.addEventListener("pointerdown", function (e) {
      var at = local(e);
      if (onDial(at) && kid.mode !== RIDE) {
        dial.held = true;
        setDial(at);
        if (cv.setPointerCapture) { try { cv.setPointerCapture(e.pointerId); } catch (err) {} }
        e.preventDefault();
        return;
      }
      if (e.pointerType === "touch") {
        // Drawing with a finger would take the scroll with it, so a tap
        // sends the rabbit down a slide of its own.
        line = preset();
        go();
        return;
      }
      if (kid.mode === RIDE || kid.mode === IN || kid.mode === BUMP) return;
      hideQuip();
      window.clearTimeout(autoT);
      kid.mode = DRAW;
      line = [local(e)];
      if (cv.setPointerCapture) { try { cv.setPointerCapture(e.pointerId); } catch (err) {} }
      e.preventDefault();
      paint();
    });

    cv.addEventListener("pointermove", function (e) {
      if (dial.held) { setDial(local(e)); return; }
      if (kid.mode !== DRAW) return;
      var p = local(e);
      var last = line[line.length - 1];
      var dx = p.x - last.x, dy = p.y - last.y;
      if (dx * dx + dy * dy < 36) return;    // one point every six pixels
      line.push(p);
      if (line.length > 900) line.shift();
      paint();
    });

    function done() {
      if (dial.held) { dial.held = false; return; }
      if (kid.mode !== DRAW) return;
      if (line.length < 2) { line = []; park(); paint(); return; }
      go();
    }

    cv.addEventListener("pointerup", done);
    cv.addEventListener("pointercancel", done);
    window.addEventListener("pointerup", done);

    if (goBtn) {
      goBtn.addEventListener("click", function () {
        if (kid.mode === RIDE || kid.mode === IN || kid.mode === BUMP) return;
        if (line.length < 2) line = preset();
        go();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        line = [];
        splats.length = 0;
        puffs.length = 0;
        wob = 0;
        park();
        paint();
        say("all yours. hold the mouse down and draw a slide to the hole", 4200);
      });
    }

    var sizeT = 0;
    window.addEventListener("resize", function () {
      window.clearTimeout(sizeT);
      sizeT = window.setTimeout(function () {
        size();
        line = [];
        park();
        paint();
      }, 200);
    });

    size();
    park();
    paint();

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) paint();
        else live = false;
      }, { threshold: 0.1 }).observe(slide);
    }
  })();


  /* ---- Black Hole: page dot-grid converges into singularity --- */
  (function () {
    var bhWrap = document.getElementById("blackhole");
    var bhCv   = document.getElementById("blackhole-cv");
    if (!bhWrap || !bhCv) return;

    var ctx = bhCv.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W, H, sX, sY, HR;      // canvas dims, singularity, horizon radius
    var gridTop = 0;           // where the band sits, for grid phase
    var visibility = 0;         // 0 → 1 driven by scroll
    var isVisible  = false;
    var frameId    = null;
    var time       = 0;

    /* The site body uses a 26×26 dot grid */
    var GRID = 26;
    var HALF = GRID / 2;
    /* A ring of radius R holds R * SPACE of the lattice: exactly as
       many dots as sit one page-grid step apart around it */
    var SPACE = 1 / 2600;
    /* Of everything riding one ring, this is the share the page draws
       itself: one dot in twelve */
    var PAGE_SHARE = 1 / 12;
    var DOT_R = 1.2;           // same as CSS: 1.2px radius

    /* ---- Dot color from CSS variable ---- */
    function dotColor() {
      var s = getComputedStyle(document.documentElement);
      return s.getPropertyValue("--dot").trim() || "rgba(236,231,223,0.085)";
    }

    /* ---- Sizing ---- */
    var cols, rows, dots;
    /* Bit reversal spreads consecutive indices evenly over [0,1), so
       keeping every particle below a cutoff thins a ring evenly
       instead of leaving gaps on one side */
    function spread(n) {
      var out = 0;
      for (var b = 0; b < 10; b++) { out = (out << 1) | (n & 1); n >>= 1; }
      return out / 1024;
    }
    function resize() {
      var rect = bhWrap.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      bhCv.width  = W * dpr;
      bhCv.height = H * dpr;
      bhCv.style.width  = W + "px";
      bhCv.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      HR = Math.max(28, Math.min(H * 0.15, 65));  // bigger sphere for corner drama
      sX = 0;                     // singularity at exact left-corner edge
      sY = H;                     // sits on the footer line: half a sphere


      /* Build the dot field. The page grid is 26px; this lays down a
         13px lattice, where every other dot is one of the page's own.
         The in-between dots stay invisible up top and only surface as
         the field starts to fall in, which keeps the seam clean. */
      cols = Math.ceil(W / HALF) + 5;
      rows = Math.ceil(H / HALF) + 5;
      /* Two lattice rows and three motes per point ride each ring, so
         this is the share of them that lands one lattice step apart:
         the same dot pitch the page itself uses */
      SPACE = (2 * Math.PI) / (GRID * 6 * cols);
      dots = [];
      /* The body tiles its grid every 26px with the dot in the middle
         of each tile, which after the -13px offset puts the page's own
         dots on exact multiples of 26 from the page origin. Line this
         lattice up with that, or the seam shows. */
      var pageX = rect.left + (window.pageXOffset || 0);
      var pageY = rect.top + (window.pageYOffset || 0);
      gridTop = pageY;
      var offX = ((-pageX % GRID) + GRID) % GRID - GRID;
      var offY = ((-pageY % GRID) + GRID) % GRID - GRID;
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var gx = offX + c * HALF;
          var gy = offY + r * HALF;
          var isPage = (c % 2 === 0 && r % 2 === 0);
          /* Each lattice point also carries two motes that stay dark
             until the field gathers. They ride between the rings and
             are what makes the funnel dense without touching the seam
             at the top, where only the page's own dots show. */
          for (var k = 0; k < 3; k++) {
            dots.push({
              gx: gx,
              gy: gy,
              /* Rows pair up: a dot and the one below it ride the same
                 ring, so the funnel keeps clear ribs while the dots
                 between them add density rather than more rings */
              ry: offY + Math.floor(r / 2) * 2 * HALF,
              x: 0, y: 0,
              baseR: DOT_R,
              sub: k,
              /* Draw order: the page's own dots first, then the rest
                 of the lattice, then the motes. Each band is as wide
                 as that group's share of a ring, so a cutoff of, say,
                 0.4 really does keep four dots in ten. */
              u: (isPage && k === 0)
                   ? spread(c * 3 + k) * PAGE_SHARE
                   : (k === 0
                       ? PAGE_SHARE + spread(c * 3 + k) * 0.25
                       : PAGE_SHARE + 0.25 + spread(c * 3 + k) * (2 / 3)),
              /* Signed distance from the axis: it decides where the
                 dot lands around the ring */
              ox: gx - sX,
              near: 0, comp: 1, w: 0
            });
          }
        }
      }
    }
    resize();
    window.addEventListener("resize", function () { resize(); if (reduced) drawStatic(); });
    /* Fonts and images settle after this script runs, and if the band
       has moved by then the lattice would be out of phase with the
       page's own grid. Re-measure once everything has landed. */
    function realign() {
      var r = bhWrap.getBoundingClientRect();
      var top = r.top + (window.pageYOffset || 0);
      if (Math.abs(top - gridTop) > 0.5 ||
          Math.abs(r.height - H) > 0.5 ||
          Math.abs(r.width - W) > 0.5) {
        resize();
        if (reduced) drawStatic();
      }
    }
    window.addEventListener("load", realign);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(realign);

    /* ---- Vortex math --------------------------------------------
       Every dot keeps its column. A column is a strand that hangs
       straight down at the top of the band, exactly where the page
       draws it, then winds around the axis and closes on the hole as
       it falls. Because a strand starts at a quarter turn, its first
       row lands back on its own grid position: no seam, no jump.

       Outer strands are carried further round than inner ones, which
       bends each row into a spiral arm, and rows deeper down are
       turned further still, which stacks the arms into a funnel.
       ------------------------------------------------------------ */

    /* Put a point on its orbit, bending the far side up over the top */
    var pj = { x: 0, y: 0, c: 0 };
    function project(phi, R, yc, tilt) {
      var s = Math.sin(phi);
      var c = Math.cos(phi);                      // +1 near side, -1 far side
      var x = sX + s * R;
      var y = yc + c * R * tilt;

      /* Close in, the sphere bends what passes near it outward, the
         way the grid smears around the edge of the real thing */
      var near = (R - HR) / (HR * 2.2);
      if (near < 1) {
        if (near < 0) near = 0;
        var push = (1 - near) * (1 - near) * HR * 0.22;
        R += push;
        x = sX + s * R;
        y = yc + c * R * tilt;
      }

      if (c < 0) {
        var k = 1 - R / (HR * 1.9);
        if (k > 0) {
          /* Light from the far side is bent up and over the sphere.
             The arc keeps the orbit's own width, so it meets the disk
             exactly where the near side takes over and nothing kinks. */
          var bend = k * k * (-c);
          var th = Math.atan2(-c, s);             // 0 … π, over the top
          var lift = R < HR * 1.55 ? R : HR * 1.55;
          x += (sX + Math.cos(th) * R - x) * bend;
          y += (sY - Math.sin(th) * lift - y) * bend;
        }
      }
      pj.x = x; pj.y = y; pj.c = c;
      return pj;
    }

    function warpDots() {
      var amp  = Math.pow(visibility, 0.75);
      var Rmax = W * 0.5;
      var spin = time * 0.00022;                  // slow

      for (var i = 0; i < dots.length; i++) {
        var d = dots[i];

        /* How far down the band the dot's ring sits */
        var t = (d.ry + HALF) / (H + HALF);
        if (t < 0) t = 0;
        if (t > 1) t = 1;
        var fall = Math.pow(t, 1.15);             // pull comes on gently
        var ramp = t * t * (3 - 2 * t) * amp;     // 0 at the very top

        /* The ring this row is closing into. Every dot in the row
           lands on it: the row's own width sets where each one sits
           around it, so the order along the row is the order around
           the ring and the circle closes with no seam. */
        var comp = Math.pow(1 - fall, 1.05);
        var w = (fall - 0.12) / 0.5; if (w < 0) w = 0; if (w > 1) w = 1;
        w = w * w * (3 - 2 * w) * amp;

        var R = Rmax * comp;
        /* Matter thins out as it reaches the throat and is gone */
        var eaten = (R - HR * 1.02) / (HR * 1.1);
        if (eaten < 0) eaten = 0;
        if (eaten > 1) eaten = 1;
        if (R < HR * 0.95) R = HR * 0.95;

        /* Rows keep their own height almost all the way down, so the
           funnel stays evenly ribbed instead of pooling at the bottom */
        var yc = d.ry + (sY - d.ry) * Math.pow(fall, 3.4) * amp;

        /* Where this dot sits around the ring: the width of the page
           is one full turn, and the motes fall between their
           neighbours. Depth winds the rings past each other and the
           whole thing turns slowly. */
        var theta = Math.PI / 2
                  + Math.PI * ((d.ox + d.sub * (HALF / 3)) / Rmax)
                  + spin * (0.5 + 0.5 * fall)
                  + fall * 1.1;

        var tilt = 0.045 + 0.075 * fall;

        /* One turn has to drop exactly onto the next ring down, or the
           spiral tears at the seam. Measure the gap to that ring and
           use it as the pitch. */
        var nry = d.ry + GRID;
        var nt = (nry + HALF) / (H + HALF);
        if (nt > 1) nt = 1;
        var nfall = Math.pow(nt, 1.15);
        var pitch = (nry + (sY - nry) * Math.pow(nfall, 3.4) * amp) - yc;

        var frac = theta / (Math.PI * 2);
        frac = frac - Math.floor(frac);

        var p = project(theta, R, yc + (frac - 0.5) * pitch, tilt);

        /* Up top the dot is exactly where the page draws it; the pull
           slides it onto the ring from there */
        d.x = d.gx + (p.x - d.gx) * w;
        d.y = d.gy + (p.y - d.gy) * w;
        d.near = p.c * w;
        d.beam = -Math.sin(theta);                // +1 on the approaching side
        d.comp = 1 - w + comp * w;                // 1 = untouched grid
        d.eaten = eaten;
        d.w = w;

        /* How much of the lattice this ring has room for. Out at the
           rim the dots sit one page-grid step apart, exactly like the
           background above; the further in a ring has fallen the more
           tightly the matter is packed. */
        var pack = 0.25 + 0.75 * (R / Rmax);
        var room = R * SPACE / pack;
        if (room > 1) room = 1;
        d.keep = PAGE_SHARE + w * (room - PAGE_SHARE);
      }
    }

    /* ---- Draw ---- */
    function draw() {
      ctx.clearRect(0, 0, W, H);

      var cs     = getComputedStyle(document.documentElement);
      var accent = cs.getPropertyValue("--accent").trim() || "#ff5233";

      /* The page draws its grid as one colour at a low alpha. Split it
         so a dot can start at exactly that value and then brighten as
         it falls, with no jump at the top of the band. */
      var parts = /rgba?\(([^)]+)\)/.exec(dotColor());
      var bits  = parts ? parts[1].split(",") : ["20", "18", "15", "0.13"];
      var solid = "rgb(" + bits[0] + "," + bits[1] + "," + bits[2] + ")";
      var baseA = bits.length > 3 ? parseFloat(bits[3]) : 1;
      var drift  = isVisible && !reduced ? Math.sin(time * 0.0004) * 0.4 : 0;
      var cx = sX + drift;
      var breathe = 0.93 + 0.07 * Math.sin(time * 0.0011);

      function dot(d) {
        if (d.y < -8 || d.y > H + 8) return;
        /* Dots with negligible warp are still on the body's own grid;
           let the CSS dot pattern cover them and avoid double-rendering. */
        if (d.w < 0.06) return;

        /* Nothing shows inside the horizon: it is either behind the
           sphere or already gone */

        var hx = d.x - sX;
        var hy = d.y - sY;
        if (hx * hx + hy * hy < HR * HR) return;

        /* A ring holds only as many dots as fit at an even spacing.
           Up top that is exactly the page's own grid; as the ring
           gathers, more of the lattice is allowed in, and as it closes
           the extras drop back out. */
        var thin = (d.keep - d.u) / 0.07;
        if (thin > 1) thin = 1;
        if (thin <= 0) return;

        /* Out at the rim a dot is exactly a page dot, same size and
           same alpha; depth is what makes it grow and burn */
        var nn = 0.5 + 0.5 * d.near;              // 0 far side, 1 near
        var heat = 1 - d.comp;
        var alpha = thin * baseA * (1 + heat * 3 + heat * heat * 11)
                  * (1 - 0.4 * heat * (1 - nn)) * d.eaten
                  * (1 + 0.45 * heat * d.beam);   // Doppler beaming
        if (alpha > 0.72) alpha = 0.72;
        var r = d.baseR * (1 + 0.38 * heat) * (0.85 + 0.3 * nn);
        var tone = solid;
        if (heat > 0.72) { tone = accent; r *= 1.15; alpha *= 1.15; }

        /* Matter close to the throat carries its own bloom */
        if (heat > 0.78) {
          ctx.fillStyle = accent;
          ctx.globalAlpha = alpha * 0.12 * d.eaten;
          ctx.beginPath();
          ctx.arc(d.x + drift, d.y, r * 2.6, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = tone;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(d.x + drift, d.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      var i;
      for (i = 0; i < dots.length; i++) if (dots[i].near <= 0) dot(dots[i]);
      ctx.globalAlpha = 1;

      if (visibility > 0.03) {
        var v = visibility;

        /* Haze the hole sits in */
        /* Haze spreads from the corner — radius keyed to canvas width so
           the atmospheric glow fills the bottom-left on any screen size. */
        var hazeR = Math.max(HR * 10, W * 0.35);
        var haze = ctx.createRadialGradient(cx, sY, HR, cx, sY, hazeR);
        haze.addColorStop(0, accent);
        haze.addColorStop(1, "transparent");
        ctx.fillStyle = haze;
        ctx.globalAlpha = 0.10 * v * breathe;
        ctx.beginPath();
        ctx.arc(cx, sY, hazeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        /* The disk, lensed up and over the sphere. Three passes from
           wide and faint to narrow and bright: the edges come out soft
           instead of drawn on. */
        ctx.strokeStyle = accent;
        var pass;
        for (pass = 0; pass < 3; pass++) {
          ctx.globalAlpha = (0.05 + pass * 0.07) * v * (pass === 2 ? breathe : 1);
          ctx.lineWidth = HR * (0.3 - pass * 0.1);
          ctx.beginPath();
          ctx.arc(cx, sY, HR * (1.44 - pass * 0.04),
                  Math.PI * (1.02 + pass * 0.01), Math.PI * (1.98 - pass * 0.01));
          ctx.stroke();
        }
        ctx.globalAlpha = 1;

        /* Event horizon. Dead black at the middle, and the dark carries
           on past the edge before it gives out, so the sphere sits in
           the frame rather than being cut out of it. */
        var core = ctx.createRadialGradient(cx, sY, HR * 0.1, cx, sY, HR * 1.5);
        core.addColorStop(0, "rgba(2,2,2,1)");
        core.addColorStop(0.6, "rgba(2,2,2,1)");
        core.addColorStop(0.74, "rgba(2,2,2,0.92)");
        core.addColorStop(0.86, "rgba(2,2,2,0.45)");
        core.addColorStop(1, "rgba(2,2,2,0)");
        ctx.fillStyle = core;
        ctx.globalAlpha = v;
        ctx.beginPath();
        ctx.arc(cx, sY, HR * 1.5, Math.PI, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;

        /* Photon ring: a thin line inside a soft bloom, not a hoop */
        for (pass = 0; pass < 3; pass++) {
          ctx.beginPath();
          ctx.arc(cx, sY, HR * (1.005 + pass * 0.03), Math.PI, Math.PI * 2);
          ctx.strokeStyle = accent;
          ctx.lineWidth = 0.9 + pass * 2.6;
          ctx.globalAlpha = (0.5 - pass * 0.19) * v * breathe;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;

        /* The disk seen edge on, flaring where it passes the sphere
           and thinning out across the page */
        /* Only the right arm is visible from the corner; extend it well
           across the canvas so the accretion streak is dramatic. */
        var reach = Math.max(HR * 8, W * 0.62);
        var side;
        for (side = -1; side <= 1; side += 2) {
          var x0 = cx + side * HR * 0.9;
          var x1 = cx + side * reach;
          var g = ctx.createLinearGradient(x0, 0, x1, 0);
          g.addColorStop(0, accent);
          g.addColorStop(0.06, accent);
          g.addColorStop(1, "transparent");

          ctx.fillStyle = g;
          ctx.globalAlpha = 0.12 * v;
          ctx.fillRect(Math.min(x0, x1), sY - HR * 0.07, reach, HR * 0.14);

          ctx.globalAlpha = 0.6 * v * breathe;
          ctx.fillRect(Math.min(x0, x1), sY - 1.1, reach, 2.2);
        }
        ctx.globalAlpha = 1;
      }

      for (i = 0; i < dots.length; i++) if (dots[i].near > 0) dot(dots[i]);
      ctx.globalAlpha = 1;
    }

    /* ---- Render loop ---- */
    function render(timestamp) {
      if (!isVisible) { frameId = null; return; }
      time = timestamp;
      warpDots();
      draw();
      frameId = raf(render);
    }

    /* ---- Static fallback for reduced-motion ---- */
    function drawStatic() {
      visibility = 0.5;
      warpDots();
      draw();
    }

    /* ---- Scroll-driven activation ---- */
    if (reduced) {
      drawStatic();
    } else if ("IntersectionObserver" in window) {
      var thresholds = [];
      for (var t = 0; t <= 1; t += 0.02) thresholds.push(Math.min(t, 1));

      new IntersectionObserver(function (entries) {
        var entry = entries[0];
        visibility = Math.max(0, Math.min(1, entry.intersectionRatio));
        var nowVisible = entry.isIntersecting;
        if (nowVisible && !isVisible) {
          isVisible = true;
          frameId = raf(render);
        } else if (!nowVisible) {
          isVisible = false;
        }
      }, { threshold: thresholds }).observe(bhWrap);
    } else {
      isVisible = true;
      visibility = 0.7;
      frameId = raf(render);
    }

    /* Re-render on theme change */
    if ("MutationObserver" in window) {
      new MutationObserver(function () {
        if (reduced) drawStatic();
      }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    }
  })();

  /* ---- End cap: a small system sign-off ---------------------- */
  var footer = document.getElementById("blackhole");
  if (footer) {
    var revealFooter = function () { footer.classList.add("is-live"); };
    if (reduced || !("IntersectionObserver" in window)) {
      revealFooter();
    } else {
      var footerIo = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        revealFooter();
        footerIo.disconnect();
      }, { threshold: 0.35 });
      footerIo.observe(footer);
    }
  }
})();
