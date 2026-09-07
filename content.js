(function () {
  if (document.getElementById("mac-box")) return;

  let recording = false;
  let playing = false;
  let intervalActive = false;
  let actions = [];
  let startTime = 0;
  let lastMoveTime = 0;
  let playTimeouts = [];
  let intervalId = null;
  let intervalMs = 100;
  let fixedPosition = false;
  let fixedX = 0;
  let fixedY = 0;
  let showHotkeys = false;

  window.mouseX = 0;
  window.mouseY = 0;

  function canUseChromeAPI() {
    try {
      return !!(chrome && chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  const cursor = document.createElement("div");
  cursor.style.cssText = `
    position: fixed; width: 14px; height: 14px;
    background: #4fc3f7; border: 2px solid white;
    border-radius: 50%; pointer-events: none; z-index: 2147483647;
    display: none; transform: translate(-50%, -50%);
    box-shadow: 0 0 10px rgba(79, 195, 247, 0.8);
  `;
  document.body.appendChild(cursor);

  function showLeftBeacon(x, y) {
    const beacon = document.createElement("div");
    beacon.style.cssText = `
      position: fixed; left:${x}px; top:${y}px; width:18px; height:18px;
      background: radial-gradient(circle, white 15%, #00e5ff 60%, transparent 70%);
      border-radius:50%; pointer-events:none; z-index:2147483647;
      transform:translate(-50%,-50%) scale(0.6); opacity:1;
      transition: transform 0.18s ease-out, opacity 0.18s ease-out;
      box-shadow: 0 0 12px 4px rgba(0,229,255,0.6);
    `;
    document.body.appendChild(beacon);
    requestAnimationFrame(() => beacon.style.transform = "translate(-50%,-50%) scale(1.1)");
    setTimeout(() => {
      beacon.style.opacity = "0";
      beacon.style.transform = "translate(-50%,-50%) scale(1.4)";
      setTimeout(() => beacon.remove(), 180);
    }, 120);
  }

  function doClick(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return;
    const opts = {
      bubbles: true, cancelable: true, view: window,
      clientX: x, clientY: y, button: 0, buttons: 1
    };
    el.dispatchEvent(new MouseEvent("pointerdown", opts));
    el.dispatchEvent(new MouseEvent("mousedown", opts));
    el.dispatchEvent(new MouseEvent("mouseup", opts));
    el.dispatchEvent(new MouseEvent("click", opts));
  }

  function stopEverything() {
    playing = false;
    intervalActive = false;
    recording = false;

    playTimeouts.forEach(clearTimeout);
    playTimeouts = [];

    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }

    cursor.style.display = "none";

    setStatus("Done", "#8bc34a");

    setTimeout(() => {
      if (!playing && !recording && !intervalActive) {
        setStatus("Idle");
        updateUI();
      }
    }, 1200);

    updateUI();
  }

  function saveActions() {
    if (!canUseChromeAPI()) return;
    try {
      chrome.storage.local.set({ mini_actions: actions });
    } catch (e) {}
  }

  function loadActions() {
    if (!canUseChromeAPI()) return;
    try {
      chrome.storage.local.get(["mini_actions"], (res) => {
        if (Array.isArray(res.mini_actions)) {
          actions = res.mini_actions;
        }
      });
    } catch (e) {}
  }

  function setStatus(text, color = "#aaa") {
    try {
      const status = document.getElementById("mac-status");
      if (status) {
        status.textContent = text;
        status.style.color = color;
      }
    } catch (e) {}
  }

  function updateUI() {
    try {
      const recordBtn = document.getElementById("mac-record");
      const playBtn = document.getElementById("mac-play");
      const intervalBtn = document.getElementById("mac-interval");

      if (intervalActive) {
        setStatus(`Interval running (${intervalMs}ms)`, "#4caf50");
        if (intervalBtn) intervalBtn.textContent = "Stop Interval";
      } else if (recording) {
        setStatus("Recording...", "#ff6b6b");
        if (recordBtn) recordBtn.innerHTML = "<span style='color:#ff4444;font-weight:bold;'>((</span>Stop<span style='color:#ff4444;font-weight:bold;'>))</span>";
      } else if (playing) {
        if (playBtn) playBtn.innerHTML = "■ Stop";
      } else {
        if (recordBtn) recordBtn.innerHTML = "<span style='color:#ff4444;font-weight:bold;'>((</span>Rec<span style='color:#ff4444;font-weight:bold;'>))</span>";
        if (playBtn) playBtn.innerHTML = "<span style='color:#4caf50'>|> </span>Play";
        if (intervalBtn) intervalBtn.textContent = "Start Interval";
      }
    } catch (e) {}
  }

  function clampPosition(box) {
    if (!box) return;
    try {
      const rect = box.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width - 10;
      const maxY = window.innerHeight - rect.height - 10;
      let left = parseInt(box.style.left) || 20;
      let top = parseInt(box.style.top) || 80;
      left = Math.max(10, Math.min(left, maxX));
      top = Math.max(10, Math.min(top, maxY));
      box.style.left = left + "px";
      box.style.top = top + "px";
      box.style.right = "auto";

      if (canUseChromeAPI()) {
        chrome.storage.local.set({ mini_panel_left: left, mini_panel_top: top });
      }
    } catch (e) {}
  }

  function createPanel() {
    if (document.getElementById("mac-box")) return;

    const box = document.createElement("div");
    box.id = "mac-box";
    box.style.cssText = `
      position: fixed; width: 260px;
      background: #1a1a1a; color: #e0e0e0; border-radius: 10px;
      z-index: 2147483646; font-family: system-ui, sans-serif; font-size: 13px;
      box-shadow: 0 8px 28px rgba(0,0,0,0.5); user-select: none; overflow: hidden;
    `;

    if (canUseChromeAPI()) {
      try {
        chrome.storage.local.get(["mini_panel_left", "mini_panel_top", "mini_actions"], (res) => {
          if (res.mini_panel_left !== undefined) {
            box.style.left = res.mini_panel_left + "px";
            box.style.top = res.mini_panel_top + "px";
          } else {
            box.style.top = "80px";
            box.style.right = "20px";
          }

          if (Array.isArray(res.mini_actions)) {
            actions = res.mini_actions;
          }
        });
      } catch (e) {
        box.style.top = "80px";
        box.style.right = "20px";
      }
    } else {
      box.style.top = "80px";
      box.style.right = "20px";
    }

    box.innerHTML = `
      <div id="mac-header" style="padding: 10px 12px; background: #252525; cursor: move; display: flex; justify-content: space-between; align-items: center;">
        <strong>MiniClickr</strong>
        <button id="mac-close" style="background:#444;color:white;border:none;border-radius:4px;width:22px;height:22px;cursor:pointer;">×</button>
      </div>

      <div id="mac-body" style="padding: 12px;">
        <div style="margin-bottom: 10px; font-size: 12.5px;">
          Status: <span id="mac-status" style="color:#aaa">Idle</span>
        </div>

        <!-- RECORD + PLAY + SPEED -->
        <div id="mac-playback-section">
          <button id="mac-record" style="width: 100%; padding: 9px; margin-bottom: 8px; cursor: pointer; border-radius: 5px; border: none; background: #333; color: white; font-weight: 500;">
            <span style="color:#ff4444;font-weight:bold;">((</span>Rec<span style="color:#ff4444;font-weight:bold;">))</span>
          </button>

          <div style="display: flex; gap: 6px; margin-bottom: 8px; align-items: center;">
            <button id="mac-play" style="flex: 1; padding: 9px; cursor: pointer; border-radius: 5px; border: none; background: #333; color: white; font-weight: 500;">
              <span style="color:#4caf50">|> </span>Play
            </button>
            <div style="display: flex; align-items: center; gap: 3px;">
              <label style="font-size: 12px; color:#aaa;">×</label>
              <input id="mac-reps" type="number" value="1" min="1" style="width: 42px; padding: 6px 3px; background: #333; border: 1px solid #555; color: white; border-radius: 4px; text-align: center;">
            </div>
          </div>

          <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 12px;">
            <label style="font-size: 12px; color:#aaa;">Speed</label>
            <select id="mac-speed" style="flex: 1; padding: 5px; background: #333; color: white; border: 1px solid #555; border-radius: 4px;">
              <option value="0.5">0.5x</option>
              <option value="1" selected>1x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2x</option>
            </select>
          </div>
        </div>

        <!-- INTERVAL -->
        <div id="mac-interval-section">
          <div style="margin-bottom: 12px;">
            <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 6px;">
              <label style="flex: 1;">Interval (ms)</label>
              <input id="mac-interval-ms" type="number" value="100" min="20" style="width: 65px; padding: 4px; background: #333; border: 1px solid #555; color: white; border-radius: 4px;">
            </div>
            <label style="display: flex; align-items: center; gap: 6px; font-size: 12.5px; margin-bottom: 7px; cursor: pointer;">
              <input type="checkbox" id="mac-fixed"> Fixed position
            </label>
            <button id="mac-interval" style="width: 100%; padding: 7px; cursor: pointer; border-radius: 5px; border: none; background: #333; color: white;">Start Interval</button>
          </div>
        </div>

        <div id="mac-extra-controls">
          <!-- Support links (prominent) -->
          <div style="text-align: center; margin-bottom: 10px; padding: 8px; background: #222; border-radius: 6px;">
            <div style="font-size: 12px; color: #aaa; margin-bottom: 6px;">Support us</div>
            <div style="display: flex; gap: 8px; justify-content: center;">
              <a href="https://paypal.me/katykg" target="_blank" style="font-size: 12px; color: #64b5f6; text-decoration: none;">PayPal</a>
              <span style="color:#555;">•</span>
              <a href="https://github.com/sponsors/katykg?frequency=one-time&sponsor=katykg" target="_blank" style="font-size: 12px; color: #64b5f6; text-decoration: none;">GitHub</a>
            </div>
          </div>

          <button id="mac-hotkeys-btn" style="width: 100%; padding: 5px; margin-bottom: 6px; cursor: pointer; border-radius: 5px; border: none; background: #2a2a2a; color: #aaa; font-size: 12px;">Show Hotkeys</button>
          <div id="mac-hotkeys" style="display: none; margin-top: 4px; margin-bottom: 8px; font-size: 12px; color: #bbb; line-height: 1.5;">
            <div><kbd>Ctrl+Shift+C</kbd> Interval</div>
            <div><kbd>Ctrl+Shift+R</kbd> Record</div>
            <div><kbd>Ctrl+Shift+P</kbd> Play</div>
          </div>

          <div style="text-align: center; margin-top: 10px;">
            <a href="https://github.com/katykg?tab=repositories" target="_blank" style="font-size: 11px; color: #64b5f6; text-decoration: none;">GitHub @katykg</a>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(box);

    // Dragging
    const header = document.getElementById("mac-header");
    let isDragging = false, offsetX, offsetY;
    header.addEventListener("mousedown", (e) => {
      if (e.target.tagName === "BUTTON") return;
      isDragging = true;
      const rect = box.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
    });
    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      box.style.left = (e.clientX - offsetX) + "px";
      box.style.top = (e.clientY - offsetY) + "px";
      box.style.right = "auto";
      clampPosition(box);
    });
    document.addEventListener("mouseup", () => {
      isDragging = false;
      clampPosition(box);
    });

    document.getElementById("mac-close").onclick = () => {
      stopEverything();
      box.remove();
    };

    document.getElementById("mac-fixed").onchange = (e) => {
      fixedPosition = e.target.checked;
    };

    document.getElementById("mac-interval").onclick = toggleInterval;
    document.getElementById("mac-record").onclick = toggleRecord;
    document.getElementById("mac-play").onclick = togglePlay;

    document.getElementById("mac-hotkeys-btn").onclick = () => {
      showHotkeys = !showHotkeys;
      const hotkeysDiv = document.getElementById("mac-hotkeys");
      if (hotkeysDiv) hotkeysDiv.style.display = showHotkeys ? "block" : "none";
      const btn = document.getElementById("mac-hotkeys-btn");
      if (btn) btn.textContent = showHotkeys ? "Hide Hotkeys" : "Show Hotkeys";
      setTimeout(() => clampPosition(box), 10);
    };

    setTimeout(() => clampPosition(box), 50);
  }

  function toggleInterval() {
    if (recording || playing) return;

    if (!intervalActive) {
      intervalMs = parseInt(document.getElementById("mac-interval-ms")?.value) || 100;
      intervalActive = true;

      if (fixedPosition) {
        fixedX = window.mouseX;
        fixedY = window.mouseY;
      }

      intervalId = setInterval(() => {
        const x = fixedPosition ? fixedX : window.mouseX;
        const y = fixedPosition ? fixedY : window.mouseY;
        doClick(x, y);
        showLeftBeacon(x, y);
      }, intervalMs);

    } else {
      stopEverything();
    }

    updateUI();
  }

  function toggleRecord() {
    if (playing || intervalActive) return;

    if (!recording) {
      recording = true;
      actions = [];
      startTime = Date.now();
      lastMoveTime = 0;
      updateUI();
    } else {
      recording = false;
      saveActions();
      setStatus(`Recorded (${actions.length})`, "#8bc34a");
      updateUI();

      setTimeout(() => {
        if (!playing && !recording && !intervalActive) {
          setStatus("Idle");
          updateUI();
        }
      }, 1500);
    }
  }

  function togglePlay() {
    if (recording || intervalActive) return;
    if (playing) {
      stopEverything();
      return;
    }
    if (!actions || actions.length === 0) {
      setStatus("Nothing to play", "#ff8a8a");
      return;
    }
    playRecording();
  }

  function playRecording() {
    const reps = Math.max(1, parseInt(document.getElementById("mac-reps")?.value) || 1);
    const speed = parseFloat(document.getElementById("mac-speed")?.value) || 1;
    let completed = 0;
    playing = true;
    cursor.style.display = "block";
    updateUI();

    function runOne() {
      if (!playing) return;
      setStatus(`Playing ${completed + 1}/${reps} @ ${speed}x`, "#4caf50");

      actions.forEach(act => {
        const adjustedTime = act.time / speed;
        const t = setTimeout(() => {
          if (!playing) return;
          if (act.type === "move" || act.type === "click") {
            cursor.style.left = act.x + "px";
            cursor.style.top = act.y + "px";
          }
          if (act.type === "click") {
            showLeftBeacon(act.x, act.y);
            doClick(act.x, act.y);
          }
          if (act.type === "scroll") {
            window.scrollBy(0, act.deltaY);
          }
        }, adjustedTime);
        playTimeouts.push(t);
      });

      const lastTime = actions.length ? actions[actions.length - 1].time / speed : 0;
      playTimeouts.push(setTimeout(() => {
        completed++;
        if (completed < reps && playing) {
          runOne();
        } else {
          stopEverything();
        }
      }, lastTime + 400));
    }

    runOne();
  }

  document.addEventListener("mousemove", e => {
    window.mouseX = e.clientX;
    window.mouseY = e.clientY;
    if (!recording) return;
    const now = Date.now();
    if (now - lastMoveTime > 16) {
      actions.push({ type: "move", x: e.clientX, y: e.clientY, time: now - startTime });
      lastMoveTime = now;
    }
  });

  document.addEventListener("click", e => {
    if (!recording || document.getElementById("mac-box")?.contains(e.target)) return;
    actions.push({ type: "click", x: e.clientX, y: e.clientY, time: Date.now() - startTime });
  }, true);

  document.addEventListener("wheel", e => {
    if (!recording) return;
    actions.push({ type: "scroll", deltaY: e.deltaY, time: Date.now() - startTime });
  }, { passive: true });

  if (canUseChromeAPI()) {
    try {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === "showControls") createPanel();
        if (msg.action === "hotkey") {
          if (msg.command === "toggle-interval") toggleInterval();
          if (msg.command === "toggle-record") toggleRecord();
          if (msg.command === "toggle-play") togglePlay();
        }
      });
    } catch (e) {}
  }

  document.addEventListener("keydown", e => {
    if (e.ctrlKey && e.shiftKey) {
      if (e.code === "KeyC") { e.preventDefault(); toggleInterval(); }
      if (e.code === "KeyR") { e.preventDefault(); toggleRecord(); }
      if (e.code === "KeyP") { e.preventDefault(); togglePlay(); }
    }
  });

  // Load saved recording on start
  loadActions();
})();