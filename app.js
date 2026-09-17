(function () {
  "use strict";

  /* ============ tiny helpers ============ */
  var $ = function (id) { return document.getElementById(id); };
  var toastTimer = null;
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }
  function buzz(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {}
  }
  function initials(name) {
    var p = String(name || "?").trim().split(/\s+/);
    return ((p[0] || "?")[0] + (p[1] ? p[1][0] : "")).toUpperCase();
  }
  function clean(num) { return String(num || "").replace(/[^\d+]/g, ""); }
  function timeNow() {
    return new Date().toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  /* ============ storage ============ */
  var KEY = "kavach.v1";
  var state = { me: { name: "", phone: "", note: "" }, contacts: [], log: [], theme: "" };

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          state.me = Object.assign(state.me, parsed.me || {});
          state.contacts = Array.isArray(parsed.contacts) ? parsed.contacts : [];
          state.log = Array.isArray(parsed.log) ? parsed.log : [];
          state.theme = typeof parsed.theme === "string" ? parsed.theme : "";
        }
      }
    } catch (e) { /* storage blocked or corrupt — run with defaults */ }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }
  function addLog(text) {
    state.log.unshift({ text: text, at: timeNow() });
    state.log = state.log.slice(0, 25);
    save();
    renderLog();
  }

  /* ============ theme ============ */
  function applyTheme() {
    if (state.theme === "light" || state.theme === "dark") {
      document.documentElement.setAttribute("data-theme", state.theme);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }
  $("themeBtn").addEventListener("click", function () {
    state.theme = state.theme === "dark" ? "light" : state.theme === "light" ? "" : "dark";
    applyTheme(); save();
    toast(state.theme === "" ? "Matching your phone" : state.theme === "dark" ? "Dark" : "Light");
  });

  /* ============ location ============ */
  function getLocation(timeoutMs) {
    return new Promise(function (resolve, reject) {
      if (!("geolocation" in navigator)) {
        reject(new Error("This browser can't read your location."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            acc: Math.round(pos.coords.accuracy || 0)
          });
        },
        function (err) {
          var m = "Couldn't get your location.";
          if (err && err.code === 1) m = "Location permission is off. Turn it on in your browser settings.";
          else if (err && err.code === 3) m = "Location took too long. Move near a window or turn on GPS.";
          reject(new Error(m));
        },
        { enableHighAccuracy: true, timeout: timeoutMs || 12000, maximumAge: 15000 }
      );
    });
  }
  function mapLink(loc) {
    return "https://maps.google.com/?q=" + loc.lat.toFixed(6) + "," + loc.lng.toFixed(6);
  }

  function buildMessage(loc, kind) {
    var me = state.me;
    var lines = [];
    if (kind === "test") lines.push("TEST MESSAGE — this is a practice run, no emergency.");
    else lines.push("EMERGENCY. I need help right now.");
    lines.push(me.name ? "It's " + me.name + "." : "");
    if (loc) {
      lines.push("My location: " + mapLink(loc));
      lines.push("Accurate to about " + loc.acc + " m, as of " + timeNow() + ".");
    } else {
      lines.push("My location could not be read — last known position unavailable.");
    }
    if (me.phone) lines.push("Call me on " + me.phone + ".");
    if (me.note) lines.push("Note: " + me.note);
    if (kind !== "test") lines.push("If you can't reach me, call police on 112.");
    return lines.filter(Boolean).join("\n");
  }

  /* ============ sending ============ */
  var isIOS = /iP(hone|ad|od)/.test(navigator.userAgent);

  function openSendSheet(message, kind) {
    var box = $("sendBtns");
    box.innerHTML = "";
    $("sendTitle").textContent = kind === "test" ? "Practice alert ready" : "Your alert is ready";
    $("sendMsg").textContent = message;

    var nums = state.contacts.map(function (c) { return clean(c.phone); }).filter(Boolean);

    if (nums.length) {
      var smsBtn = document.createElement("a");
      smsBtn.className = "btn primary";
      smsBtn.style.textAlign = "center";
      smsBtn.style.textDecoration = "none";
      smsBtn.textContent = "Open text to " + nums.length + " contact" + (nums.length > 1 ? "s" : "");
      smsBtn.href = "sms:" + nums.join(",") + (isIOS ? "&" : "?") + "body=" + encodeURIComponent(message);
      box.appendChild(smsBtn);

      state.contacts.forEach(function (c) {
        var num = clean(c.phone).replace(/^\+/, "");
        if (!num) return;
        var wa = document.createElement("a");
        wa.className = "btn";
        wa.style.textAlign = "center";
        wa.style.textDecoration = "none";
        wa.textContent = "WhatsApp " + c.name;
        wa.target = "_blank";
        wa.rel = "noopener";
        wa.href = "https://wa.me/" + num + "?text=" + encodeURIComponent(message);
        box.appendChild(wa);
      });

      var call = document.createElement("a");
      call.className = "btn";
      call.style.textAlign = "center";
      call.style.textDecoration = "none";
      call.textContent = "Call " + state.contacts[0].name;
      call.href = "tel:" + clean(state.contacts[0].phone);
      box.appendChild(call);
    } else {
      var warn = document.createElement("div");
      warn.className = "empty";
      warn.style.color = "#E7DCEE";
      warn.textContent = "You have no contacts saved, so there is nobody to text. Add one below, then try again.";
      box.appendChild(warn);
    }

    var copy = document.createElement("button");
    copy.className = "btn ghost";
    copy.type = "button";
    copy.style.color = "#fff";
    copy.style.borderColor = "#4A3A5C";
    copy.textContent = "Copy the message";
    copy.addEventListener("click", function () {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(message).then(function () { toast("Copied"); })
          .catch(function () { toast("Copy blocked — select the text above."); });
      } else { toast("Copy blocked — select the text above."); }
    });
    box.appendChild(copy);

    if (navigator.share) {
      var sh = document.createElement("button");
      sh.className = "btn";
      sh.type = "button";
      sh.textContent = "Share another way";
      sh.addEventListener("click", function () {
        navigator.share({ text: message }).catch(function () {});
      });
      box.appendChild(sh);
    }

    $("sendOverlay").classList.add("show");
  }
  $("closeSend").addEventListener("click", function () { $("sendOverlay").classList.remove("show"); });

  function fireAlert(kind) {
    $("sosHint").textContent = "Finding your location…";
    getLocation().then(function (loc) {
      var msg = buildMessage(loc, kind);
      openSendSheet(msg, kind);
      $("sosHint").textContent = "Location found. Choose how to send it.";
      addLog(kind === "test" ? "Practice alert prepared" : "Emergency alert prepared with location");
      if (kind !== "test") startSiren();
    }).catch(function (err) {
      var msg = buildMessage(null, kind);
      openSendSheet(msg, kind);
      $("sosHint").textContent = err.message;
      addLog("Alert prepared without location — " + err.message);
    });
  }

  /* ============ hold-to-arm SOS ============ */
  var HOLD_MS = 2000, holdStart = 0, holdRaf = 0, countTimer = null;

  function setRing(pct) { $("ring").style.setProperty("--p", String(pct)); }

  function holdTick() {
    var pct = Math.min(100, ((Date.now() - holdStart) / HOLD_MS) * 100);
    setRing(pct);
    if (pct >= 100) { endHold(true); return; }
    holdRaf = requestAnimationFrame(holdTick);
  }
  function beginHold(e) {
    if (e && e.preventDefault) e.preventDefault();
    holdStart = Date.now();
    $("sosBtn").classList.add("armed");
    $("sosHint").textContent = "Keep holding…";
    buzz(20);
    cancelAnimationFrame(holdRaf);
    holdRaf = requestAnimationFrame(holdTick);
  }
  function endHold(completed) {
    cancelAnimationFrame(holdRaf);
    holdRaf = 0;
    $("sosBtn").classList.remove("armed");
    setRing(0);
    if (completed) {
      buzz([80, 60, 80]);
      startCountdown("real");
    } else if (holdStart) {
      $("sosHint").textContent = "Released too early. Hold the full 2 seconds.";
    }
    holdStart = 0;
  }
  var sos = $("sosBtn");
  sos.addEventListener("pointerdown", beginHold);
  sos.addEventListener("pointerup", function () { endHold(false); });
  sos.addEventListener("pointerleave", function () { endHold(false); });
  sos.addEventListener("pointercancel", function () { endHold(false); });
  sos.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  sos.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === " ") && !holdStart) { e.preventDefault(); startCountdown("real"); }
  });

  $("testBtn").addEventListener("click", function () { fireAlert("test"); });

  function startCountdown(kind) {
    var n = 5;
    $("countNum").textContent = String(n);
    $("countOverlay").classList.add("show");
    clearInterval(countTimer);
    countTimer = setInterval(function () {
      n -= 1;
      $("countNum").textContent = String(Math.max(0, n));
      buzz(40);
      if (n <= 0) {
        clearInterval(countTimer);
        $("countOverlay").classList.remove("show");
        fireAlert(kind);
      }
    }, 1000);
  }
  $("cancelCount").addEventListener("click", function () {
    clearInterval(countTimer);
    $("countOverlay").classList.remove("show");
    $("sosHint").textContent = "Cancelled. Nothing was sent.";
    addLog("Alert cancelled before sending");
  });

  /* ============ siren + strobe ============ */
  var audioCtx = null, sirenNodes = null, strobeTimer = null;
  function ctx() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === "suspended") { audioCtx.resume().catch(function () {}); }
    return audioCtx;
  }
  function startSiren() {
    if (sirenNodes) return;
    var c = ctx();
    if (!c) { toast("Sound isn't available on this browser."); return; }
    var osc = c.createOscillator();
    var gain = c.createGain();
    var lfo = c.createOscillator();
    var lfoGain = c.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = 880;
    lfo.type = "sine";
    lfo.frequency.value = 2.2;
    lfoGain.gain.value = 420;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    gain.gain.value = 0.0001;
    gain.gain.exponentialRampToValueAtTime(0.35, c.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    lfo.start();
    sirenNodes = { osc: osc, lfo: lfo, gain: gain };
    $("sirenBtn").classList.add("on");
    var on = false;
    strobeTimer = setInterval(function () {
      on = !on;
      $("strobe").style.display = on ? "block" : "none";
    }, 260);
    buzz([300, 120, 300, 120, 300]);
    addLog("Siren switched on");
  }
  function stopSiren() {
    if (sirenNodes) {
      try {
        sirenNodes.gain.gain.cancelScheduledValues(audioCtx.currentTime);
        sirenNodes.gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
        sirenNodes.osc.stop();
        sirenNodes.lfo.stop();
      } catch (e) {}
      sirenNodes = null;
    }
    clearInterval(strobeTimer);
    strobeTimer = null;
    $("strobe").style.display = "none";
    $("sirenBtn").classList.remove("on");
  }
  $("sirenBtn").addEventListener("click", function () {
    if (sirenNodes) { stopSiren(); toast("Siren off"); } else { startSiren(); }
  });

  /* ============ fake call ============ */
  var ringNodes = null, ringLoop = null, fakeTimer = null;
  function ringOnce() {
    var c = ctx();
    if (!c) return;
    var o = c.createOscillator(), g = c.createGain();
    o.type = "sine";
    o.frequency.value = 480;
    g.gain.value = 0.0001;
    o.connect(g); g.connect(c.destination);
    var t = c.currentTime;
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.start(t); o.stop(t + 1.0);
    ringNodes = { o: o, g: g };
  }
  function startFakeCall() {
    var name = state.contacts.length ? state.contacts[0].name : "Papa";
    $("callerName").textContent = name;
    $("callerInitial").textContent = initials(name);
    $("callScreen").classList.add("show");
    ringOnce();
    clearInterval(ringLoop);
    ringLoop = setInterval(function () { ringOnce(); buzz([500, 400]); }, 1800);
    buzz([500, 400]);
    addLog("Fake call started");
  }
  function endFakeCall() {
    clearInterval(ringLoop);
    ringLoop = null;
    ringNodes = null;
    $("callScreen").classList.remove("show");
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
    buzz(0);
  }
  $("fakeBtn").addEventListener("click", function () {
    ctx();
    toast("Ringing in 5 seconds");
    clearTimeout(fakeTimer);
    fakeTimer = setTimeout(startFakeCall, 5000);
  });
  $("declineCall").addEventListener("click", endFakeCall);
  $("acceptCall").addEventListener("click", function () {
    clearInterval(ringLoop);
    ringLoop = null;
    try {
      if (window.speechSynthesis) {
        var u = new SpeechSynthesisUtterance(
          "Hey, I can see you. I'm parked right at the corner, about two minutes away. Stay on the line, I'm coming to you now."
        );
        u.rate = 0.95;
        window.speechSynthesis.speak(u);
      }
    } catch (e) {}
    setTimeout(endFakeCall, 14000);
  });

  /* ============ live location sharing ============ */
  var watchId = null, lastLoc = null, trackStarted = 0;
  $("trackBtn").addEventListener("click", function () {
    if (watchId !== null) { stopTracking(); return; }
    if (!("geolocation" in navigator)) { toast("Location isn't available here."); return; }
    trackStarted = Date.now();
    watchId = navigator.geolocation.watchPosition(function (pos) {
      lastLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: Math.round(pos.coords.accuracy || 0) };
      $("quickStatus").innerHTML = '<span class="pill live">Live</span> ' +
        "Updated " + timeNow() + " — accurate to " + lastLoc.acc + " m. " +
        '<a href="' + mapLink(lastLoc) + '" target="_blank" rel="noopener">Open map</a>';
    }, function () {
      $("quickStatus").textContent = "Location updates stopped — permission or signal problem.";
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    $("trackBtn").classList.add("on");
    $("quickStatus").textContent = "Finding you…";
    addLog("Live location sharing started");
    setTimeout(function () {
      if (lastLoc) {
        openSendSheet(
          (state.me.name ? state.me.name + " here. " : "") +
          "I'm travelling and sharing my location with you: " + mapLink(lastLoc) +
          "\nStarted at " + timeNow() + ". I'll message when I reach.", "track"
        );
      }
    }, 3000);
  });
  function stopTracking() {
    if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
    $("trackBtn").classList.remove("on");
    var mins = Math.max(1, Math.round((Date.now() - trackStarted) / 60000));
    $("quickStatus").innerHTML = '<span class="pill ok">Stopped</span> Shared for about ' + mins + " min.";
    addLog("Live location sharing stopped");
  }

  /* ============ audio recording ============ */
  var mediaRec = null, chunks = [], recStream = null, recTimer = null;
  $("recBtn").addEventListener("click", function () {
    if (mediaRec && mediaRec.state === "recording") { mediaRec.stop(); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
      toast("Recording isn't supported by this browser.");
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      recStream = stream;
      chunks = [];
      var opts = {};
      try {
        if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported("audio/webm")) {
          opts.mimeType = "audio/webm";
        }
      } catch (e) {}
      mediaRec = new MediaRecorder(stream, opts);
      mediaRec.ondataavailable = function (ev) { if (ev.data && ev.data.size) chunks.push(ev.data); };
      mediaRec.onstop = function () { finishRecording(); };
      mediaRec.start();
      $("recBtn").classList.add("on");
      var started = Date.now();
      clearInterval(recTimer);
      recTimer = setInterval(function () {
        var s = Math.floor((Date.now() - started) / 1000);
        $("quickStatus").innerHTML = '<span class="pill live">Recording</span> ' +
          Math.floor(s / 60) + "m " + (s % 60) + "s — tap the tile again to stop.";
      }, 1000);
      addLog("Audio recording started");
    }).catch(function () {
      toast("Microphone permission is off.");
    });
  });

  function finishRecording() {
    clearInterval(recTimer);
    recTimer = null;
    $("recBtn").classList.remove("on");
    if (recStream) {
      recStream.getTracks().forEach(function (t) { t.stop(); });
      recStream = null;
    }
    if (!chunks.length) { $("quickStatus").textContent = "Nothing was recorded."; return; }
    var blob = new Blob(chunks, { type: "audio/webm" });
    chunks = [];
    var url = URL.createObjectURL(blob);

    $("quickStatus").innerHTML = "";
    var audio = document.createElement("audio");
    audio.controls = true;
    audio.src = url;
    audio.style.width = "100%";
    $("quickStatus").appendChild(audio);

    var saveBtn = document.createElement("button");
    saveBtn.className = "btn sm";
    saveBtn.type = "button";
    saveBtn.style.marginTop = "8px";
    saveBtn.textContent = "Save the recording";
    saveBtn.addEventListener("click", function () {
      var stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      var name = "kavach-recording-" + stamp + ".webm";
      if (window.claude && typeof window.claude.use === "function") {
        window.claude.use("downloads").then(function (dl) {
          if (!dl) { fallbackSave(url, name); return; }
          dl.save({ filename: name, data: blob }).then(function () { toast("Saved"); })
            .catch(function () { toast("Save was declined."); });
        }).catch(function () { fallbackSave(url, name); });
      } else {
        fallbackSave(url, name);
      }
    });
    $("quickStatus").appendChild(saveBtn);
    addLog("Audio recording finished");
  }
  function fallbackSave(url, name) {
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast("If nothing downloaded, long-press the player to save.");
  }

  /* ============ reach-home timer ============ */
  var homeTimer = null, homeEnds = 0;
  $("timerStart").addEventListener("click", function () {
    var mins = parseInt($("timerMins").value, 10);
    if (!mins || mins < 1 || mins > 240) { toast("Pick between 1 and 240 minutes."); return; }
    homeEnds = Date.now() + mins * 60000;
    $("timerStart").hidden = true;
    $("timerSafe").hidden = false;
    clearInterval(homeTimer);
    homeTimer = setInterval(tickHome, 1000);
    tickHome();
    requestWakeLock();
    addLog("Reach-home timer set for " + mins + " min" + ($("timerNote").value ? " — " + $("timerNote").value : ""));
  });
  function tickHome() {
    var left = homeEnds - Date.now();
    if (left <= 0) {
      clearInterval(homeTimer);
      homeTimer = null;
      $("timerStart").hidden = false;
      $("timerSafe").hidden = true;
      $("timerStatus").textContent = "Timer ended without a check-in. Sending the alert.";
      addLog("Timer ended with no check-in — alert triggered");
      startCountdown("real");
      return;
    }
    var s = Math.ceil(left / 1000);
    var m = Math.floor(s / 60);
    $("timerStatus").innerHTML = '<span class="pill live">Running</span> ' +
      m + "m " + (s % 60) + "s left. Tap “I'm safe” when you reach.";
  }
  $("timerSafe").addEventListener("click", function () {
    clearInterval(homeTimer);
    homeTimer = null;
    $("timerStart").hidden = false;
    $("timerSafe").hidden = true;
    $("timerStatus").innerHTML = '<span class="pill ok">Checked in</span> Timer stopped. Glad you reached.';
    releaseWakeLock();
    addLog("Checked in safe");
  });

  var wakeLock = null;
  function requestWakeLock() {
    try {
      if (navigator.wakeLock && navigator.wakeLock.request) {
        navigator.wakeLock.request("screen").then(function (l) { wakeLock = l; }).catch(function () {});
      }
    } catch (e) {}
  }
  function releaseWakeLock() {
    try { if (wakeLock) { wakeLock.release(); wakeLock = null; } } catch (e) {}
  }

  /* ============ shake to alert ============ */
  var shakeOn = false, lastShake = 0, shakeCount = 0, lastMag = 0;
  function onMotion(ev) {
    var a = ev.accelerationIncludingGravity || ev.acceleration;
    if (!a) return;
    var mag = Math.sqrt((a.x || 0) * (a.x || 0) + (a.y || 0) * (a.y || 0) + (a.z || 0) * (a.z || 0));
    var delta = Math.abs(mag - lastMag);
    lastMag = mag;
    var now = Date.now();
    if (delta > 16 && now - lastShake > 220) {
      if (now - lastShake > 2000) shakeCount = 0;
      lastShake = now;
      shakeCount += 1;
      if (shakeCount >= 3) {
        shakeCount = 0;
        if (!$("countOverlay").classList.contains("show")) {
          buzz([120, 80, 120]);
          startCountdown("real");
        }
      }
    }
  }
  $("shakeBtn").addEventListener("click", function () {
    if (shakeOn) {
      window.removeEventListener("devicemotion", onMotion);
      shakeOn = false;
      $("shakeBtn").classList.remove("on");
      toast("Shake detection off");
      return;
    }
    if (typeof DeviceMotionEvent === "undefined") { toast("This device has no motion sensor."); return; }
    if (typeof DeviceMotionEvent.requestPermission === "function") {
      DeviceMotionEvent.requestPermission().then(function (res) {
        if (res === "granted") { enableShake(); } else { toast("Motion permission was refused."); }
      }).catch(function () { toast("Motion permission was refused."); });
    } else {
      enableShake();
    }
  });
  function enableShake() {
    window.addEventListener("devicemotion", onMotion);
    shakeOn = true;
    $("shakeBtn").classList.add("on");
    toast("Shake three times to start the countdown");
    addLog("Shake detection turned on");
  }

  /* ============ contacts ============ */
  function renderContacts() {
    var list = $("contactList");
    list.innerHTML = "";
    $("contactEmpty").hidden = state.contacts.length > 0;
    state.contacts.forEach(function (c, i) {
      var li = document.createElement("li");

      var av = document.createElement("div");
      av.className = "avatar";
      av.textContent = initials(c.name);

      var who = document.createElement("div");
      who.className = "who";
      var b = document.createElement("b"); b.textContent = c.name;
      var sp = document.createElement("span"); sp.textContent = c.phone;
      who.appendChild(b); who.appendChild(sp);

      var callA = document.createElement("a");
      callA.className = "iconbtn";
      callA.textContent = "Call";
      callA.style.textDecoration = "none";
      callA.href = "tel:" + clean(c.phone);

      var del = document.createElement("button");
      del.className = "iconbtn";
      del.type = "button";
      del.textContent = "Remove";
      del.addEventListener("click", function () {
        state.contacts.splice(i, 1);
        save();
        renderContacts();
        toast("Removed");
      });

      li.appendChild(av); li.appendChild(who); li.appendChild(callA); li.appendChild(del);
      list.appendChild(li);
    });
  }
  $("addContact").addEventListener("click", function () {
    var name = $("cName").value.trim();
    var phone = $("cPhone").value.trim();
    if (!name) { toast("Add a name so you know who it is."); $("cName").focus(); return; }
    if (clean(phone).replace(/\D/g, "").length < 7) { toast("That number looks too short."); $("cPhone").focus(); return; }
    if (state.contacts.length >= 8) { toast("Eight contacts is the limit."); return; }
    state.contacts.push({ name: name, phone: phone });
    save();
    renderContacts();
    $("cName").value = ""; $("cPhone").value = "";
    toast(name + " added");
  });

  /* ============ profile fields ============ */
  ["myName", "myPhone", "myNote"].forEach(function (id) {
    var key = id === "myName" ? "name" : id === "myPhone" ? "phone" : "note";
    $(id).addEventListener("input", function () {
      state.me[key] = $(id).value;
      save();
    });
  });

  /* ============ log ============ */
  function renderLog() {
    var list = $("logList");
    list.innerHTML = "";
    $("logEmpty").hidden = state.log.length > 0;
    state.log.forEach(function (entry) {
      var li = document.createElement("li");
      var who = document.createElement("div");
      who.className = "who";
      var b = document.createElement("b"); b.textContent = entry.text;
      b.style.whiteSpace = "normal";
      var sp = document.createElement("span"); sp.textContent = entry.at;
      who.appendChild(b); who.appendChild(sp);
      li.appendChild(who);
      list.appendChild(li);
    });
  }

  $("clearAll").addEventListener("click", function () {
    state = { me: { name: "", phone: "", note: "" }, contacts: [], log: [], theme: state.theme };
    try { localStorage.removeItem(KEY); } catch (e) {}
    $("myName").value = ""; $("myPhone").value = ""; $("myNote").value = "";
    renderContacts(); renderLog();
    toast("All data erased");
  });

  /* ============ boot ============ */
  load();
  applyTheme();
  $("myName").value = state.me.name || "";
  $("myPhone").value = state.me.phone || "";
  $("myNote").value = state.me.note || "";
  renderContacts();
  renderLog();
  setRing(0);

  window.addEventListener("beforeunload", function () {
    if (watchId !== null) { try { navigator.geolocation.clearWatch(watchId); } catch (e) {} }
    stopSiren();
    releaseWakeLock();
  });
})();
