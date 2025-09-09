/*
 * KeyUcation SPA Router + Upload & Fullscreen (verbessert)
 */

// ---- Mini-Router für schöne URLs ----
const routes = {
    "/": "explanationSection", // Fallback (nicht direkt genutzt dank Netlify-Redirect)
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

// Klicks auf Sidebar-Links abfangen (interne Navigation)
document.addEventListener("click", (e) => {
    const a = e.target.closest("a.side-link");
    if (!a) return;

    const url = new URL(a.href, location.origin);
    if (url.origin === location.origin) {
        e.preventDefault();
        navigateTo(url.pathname, true);
    }
});

// ---- Fullscreen Helpers (Prefix-Fallbacks + Utilities) ----
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

// In das aktuell im Vollbild befindliche iFrame ein Resize-Ereignis „stupsen“,
// damit Unitys resizeCanvas() sofort feuert.
function pokeActiveIframeToResize() {
    const fsEl = getFullscreenElement();
    if (fsEl && fsEl.tagName === "IFRAME") {
        try { fsEl.contentWindow?.dispatchEvent(new Event("resize")); } catch (_) {}
        // Falls Unity global verfügbar ist:
        try { fsEl.contentWindow?.unityInstance?.Module?.setCanvasSize?.(fsEl.contentWindow.innerWidth, fsEl.contentWindow.innerHeight, true); } catch (_) {}
    }
}

// ---- Vollbild-Buttons für WebGL-Frames ----
function setupFullscreen(buttonId, elementId) {
    const btn = document.getElementById(buttonId);
    const el = document.getElementById(elementId);
    if (!btn || !el) return;

    // Tastaturbedienung (Enter/Space)
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
                return;
            }
            // iFrame selbst in den Vollbildmodus (bevorzugt)
            await enterFullscreen(el);

            // Sofortiges Resize ins iFrame schicken (für Browser, die das Resize verzögern)
            try { el.contentWindow?.dispatchEvent(new Event("resize")); } catch (_) {}

            // Optional Unity-intern: falls die API rausgereicht ist
            try { el.contentWindow?.unityInstance?.SetFullscreen?.(1); } catch (_) {}
        } catch (err) {
            console.error("Fullscreen-Fehler:", err);
            alert("Vollbildmodus ist in diesem Browser/Umfeld nicht verfügbar.");
        }
    });
}

// Je nach Fullscreen-Status Button-Text anpassen + Unity anstupsen
function updateFullscreenUI() {
    const active = isFullscreen();
    const text = active ? "Vollbild beenden" : "Vollbild";
    ["playFullscreenBtn", "createFullscreenBtn"].forEach(id => {
        const b = document.getElementById(id);
        if (!b) return;
        b.textContent = text;
        b.setAttribute("aria-pressed", String(active));
    });
    pokeActiveIframeToResize();
}

["fullscreenchange", "webkitfullscreenchange", "msfullscreenchange"].forEach(ev =>
    document.addEventListener(ev, updateFullscreenUI, true)
);

// ---- Initialisierung ----
window.addEventListener("DOMContentLoaded", () => {
    navigateTo(location.pathname, false);

    // ---- Upload-Feature ----
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

    // ---- Vollbild-Buttons an die IFrames anschließen ----
    setupFullscreen("playFullscreenBtn", "playFrame");
    setupFullscreen("createFullscreenBtn", "createFrame");
});

// Browser Zurück/Vorwärts
window.addEventListener("popstate", (e) => {
    const path = e.state?.path || location.pathname;
    navigateTo(path, false);
});
