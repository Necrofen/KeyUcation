/*
 * KeyUcation SPA Router + Upload & Fullscreen (Container-Fullscreen, robust)
 */

// ---- Mini-Router für schöne URLs ----
const routes = {
  "/": "explanationSection",
  "/welcome": "explanationSection",
  "/upload": "uploadSection",
  "/create": "createContentSection",
  "/play": "playSection",
};

function setDocumentTitle(sectionId) {
  const titles = {
    explanationSection: "Willkommen – KeyUcation",
    uploadSection: "Upload – KeyUcation",
    createContentSection: "Erstellen – KeyUcation",
    playSection: "Spielen – KeyUcation",
  };
  document.title = titles[sectionId] || "KeyUcation";
}

function showSection(sectionId) {
  document.querySelectorAll(".sidecontent").forEach((s) => s.classList.remove("active"));
  document.querySelectorAll("#sideMenu .side-link").forEach((a) => a.classList.remove("active"));

  const section = document.getElementById(sectionId);
  if (section) section.classList.add("active");

  const activeLink = [...document.querySelectorAll("#sideMenu .side-link")]
    .find((a) => a.dataset.target === sectionId);
  if (activeLink) activeLink.classList.add("active");

  setDocumentTitle(sectionId);
}

function navigateTo(path, push = true) {
  const sectionId = routes[path] || routes["/"];
  showSection(sectionId);
  if (push) history.pushState({ path }, "", path);
}

// Interne Navigation
document.addEventListener("click", (e) => {
  const a = e.target.closest("a.side-link");
  if (!a) return;
  const url = new URL(a.href, location.origin);
  if (url.origin === location.origin) {
    e.preventDefault();
    navigateTo(url.pathname, true);
  }
});

// ---------- Fullscreen: Host steuert den .iframe-container ----------
function enterFullscreen(el) {
  const rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
  return rfs ? rfs.call(el) : Promise.resolve();
}
function exitFullscreen() {
  const ex = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
  return ex ? ex.call(document) : Promise.resolve();
}
function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
}
function getFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null;
}

// Gibt das <iframe> zurück, das innerhalb des aktiven Fullscreen-Elements steckt
function getActiveIframeInFullscreen() {
  const fsEl = getFullscreenElement();
  if (!fsEl) return null;
  if (fsEl.tagName === "IFRAME") return fsEl;
  return fsEl.querySelector?.("iframe") || null;
}

// iFrame nach Fullscreen-Wechsel sofort zum Resize „anstupsen“
function pokeActiveIframeToResize() {
  const iframe = getActiveIframeInFullscreen();
  if (!iframe) return;
  try { iframe.contentWindow?.dispatchEvent(new Event("resize")); } catch (_) {}
  try {
    const cw  = iframe.contentWindow;
    const dpr = cw.devicePixelRatio || 1;
    cw?.unityInstance?.Module?.setCanvasSize?.(
      Math.floor(cw.innerWidth * dpr),
      Math.floor(cw.innerHeight * dpr),
      true
    );
  } catch (_) {}
}

function updateFullscreenUI() {
  const active = isFullscreen();
  const text = active ? "Vollbild beenden" : "Vollbild";
  ["playFullscreenBtn", "createFullscreenBtn"].forEach((id) => {
    const b = document.getElementById(id);
    if (!b) return;
    b.textContent = text;
    b.setAttribute("aria-pressed", String(active));
  });
  pokeActiveIframeToResize();
}

// Reagiere auf Fullscreen-Events (alle Prefixe)
["fullscreenchange", "webkitfullscreenchange", "msfullscreenchange"].forEach((ev) =>
  document.addEventListener(ev, updateFullscreenUI, true)
);

// ESC zum Beenden (funktioniert auch im Fullscreen, wenn Event am Host ankommt)
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && isFullscreen()) {
    exitFullscreen().catch(() => {});
  }
});

// Buttons steuern IMMER den jeweiligen .iframe-container
function wireFullscreenButton(btnId) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const frameId = btn.getAttribute("aria-controls");
  const iframe = document.getElementById(frameId);
  if (!iframe) return;
  const container = iframe.closest(".iframe-container") || iframe.parentElement;

  // Tastaturbedienung
  btn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      btn.click();
    }
  });

  btn.addEventListener("click", async () => {
    try {
      if (isFullscreen()) {
        await exitFullscreen();
      } else {
        await enterFullscreen(container);
        // gleich nach Enter das iFrame innen anstupsen
        try { iframe.contentWindow?.dispatchEvent(new Event("resize")); } catch (_) {}
      }
    } catch (err) {
      console.warn("Fullscreen-Fehler (Host-Button):", err);
      alert("Vollbildmodus ist in diesem Browser/Umfeld nicht verfügbar.");
    }
  });
}

wireFullscreenButton("playFullscreenBtn");
wireFullscreenButton("createFullscreenBtn");

// postMessage-API für Buttons innerhalb der iFrames (z. B. V9)
function getIframeByWindow(win) {
  const iframes = document.querySelectorAll("iframe");
  for (const f of iframes) {
    if (f.contentWindow === win) return f;
  }
  return null;
}

window.addEventListener("message", async (event) => {
  const data = event.data;
  if (!data || data.type !== "KU_FS") return;
  const sourceIframe = getIframeByWindow(event.source);
  if (!sourceIframe) return;

  const container = sourceIframe.closest(".iframe-container") || sourceIframe.parentElement;

  try {
    if (data.action === "toggle") {
      if (isFullscreen()) {
        await exitFullscreen();
      } else {
        await enterFullscreen(container);
      }
    } else if (data.action === "enter") {
      await enterFullscreen(container);
    } else if (data.action === "exit") {
      await exitFullscreen();
    }
  } catch (e) {
    console.warn("Fullscreen-Fehler (postMessage):", e);
  }
});

// ---------- Upload-Feature ----------
window.addEventListener("DOMContentLoaded", () => {
  navigateTo(location.pathname, false);

  const samples = [];
  const sampleListElem = document.getElementById("sampleList");
  const sampleTitleInput = document.getElementById("sampleTitle");
  const sampleDescriptionInput = document.getElementById("sampleDescription");
  const sampleFileInput = document.getElementById("sampleFile");
  const addSampleBtn = document.getElementById("addSampleBtn");

  function updateSampleList() {
    sampleListElem.innerHTML = "";
    samples.forEach((item, idx) => {
      const container = document.createElement("div");
      container.className = "list-item";

      const infoSpan = document.createElement("span");
      infoSpan.innerHTML = `<strong>${item.title}</strong> – ${item.description}`;

      const downloadLink = document.createElement("a");
      const blob = new Blob([item.content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      downloadLink.download = item.fileName || (item.title.replace(/\s+/g, "_") + ".json");
      downloadLink.textContent = "Download";
      downloadLink.style.marginRight = "0.5rem";

      const delBtn = document.createElement("button");
      delBtn.textContent = "Entfernen";
      delBtn.addEventListener("click", () => {
        samples.splice(idx, 1);
        updateSampleList();
      });

      const actionContainer = document.createElement("div");
      actionContainer.style.display = "flex";
      actionContainer.style.gap = "0.3rem";
      actionContainer.appendChild(downloadLink);
      actionContainer.appendChild(delBtn);

      container.appendChild(infoSpan);
      container.appendChild(actionContainer);
      sampleListElem.appendChild(container);
    });
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
      reader.readAsText(file);
    });
  }

  if (addSampleBtn) {
    addSampleBtn.addEventListener("click", async () => {
      const title = sampleTitleInput.value.trim();
      const description = sampleDescriptionInput.value.trim();
      const file = sampleFileInput.files[0];

      if (!title) return alert("Bitte geben Sie einen Titel ein.");
      if (!description) return alert("Bitte geben Sie eine Beschreibung ein.");
      if (!file) return alert("Bitte wählen Sie eine JSON-Datei aus.");

      try {
        const content = await readFileAsText(file);
        samples.push({ title, description, content, fileName: file.name });
        sampleTitleInput.value = "";
        sampleDescriptionInput.value = "";
        sampleFileInput.value = "";
        updateSampleList();
      } catch (err) {
        console.error(err);
        alert("Fehler beim Lesen der Datei.");
      }
    });
  }
});

// Browser Zurück/Vorwärts
window.addEventListener("popstate", (e) => {
  const path = e.state?.path || location.pathname;
  navigateTo(path, false);
});
