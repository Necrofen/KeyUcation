/*
 * KeyUcation SPA Router + Upload & Fullscreen
 */

// ---- Mini-Router für schöne URLs ----
const routes = {
    "/": "explanationSection",          // Fallback (nicht direkt genutzt dank Netlify-Redirect)
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
    document.querySelectorAll(".sidecontent").forEach(s => s.classList.remove("active"));
    document.querySelectorAll("#sideMenu .side-link").forEach(a => a.classList.remove("active"));

    const section = document.getElementById(sectionId);
    if (section) section.classList.add("active");

    const activeLink = [...document.querySelectorAll("#sideMenu .side-link")]
        .find(a => a.dataset.target === sectionId);
    if (activeLink) activeLink.classList.add("active");

    setDocumentTitle(sectionId);
}

function navigateTo(path, push = true) {
    const sectionId = routes[path] || routes["/"];
    showSection(sectionId);
    if (push) history.pushState({ path }, "", path);
}

/* ---------------------------
   NEU: Unity-Instanz sauber neu starten
   --------------------------- */

/**
 * Ersetzt ein Unity-<iframe> durch ein frisches (Heap wird freigegeben).
 * - Merkt sich die Original-URL in data-src (damit wir immer dieselbe Basis laden).
 * - Fügt einen Cache-Buster (?t=timestamp) hinzu.
 */
function resetUnityIframeById(id) {
    const oldIframe = document.getElementById(id);
    if (!oldIframe) return;

    // Original-URL einmalig merken
    if (!oldIframe.dataset.src) {
        const original = oldIframe.getAttribute('src') || "";
        if (original) {
            oldIframe.dataset.src = original;
        } else {
            // Falls noch gar kein src gesetzt war (Lazy), hier abbrechen
            return;
        }
    }

    // Basis ermitteln und Cache-Buster anhängen
    const base = oldIframe.dataset.src.split("#")[0];
    const sep = base.includes("?") ? "&" : "?";
    const freshUrl = `${base}${sep}t=${Date.now()}`;

    // Frisches iframe erzeugen (Attribute bleiben erhalten)
    const newIframe = oldIframe.cloneNode(false);
    newIframe.src = freshUrl;

    // Altes iframe ersetzen => Unity-Instanz wird entladen, WASM-Heap freigegeben
    oldIframe.parentNode.replaceChild(newIframe, oldIframe);
}

/** Entscheidet, ob/was resettet werden soll, basierend auf der Ziel-Section. */
function maybeResetIframeForTarget(sectionId) {
    if (sectionId === "playSection") resetUnityIframeById("playFrame");
    if (sectionId === "createContentSection") resetUnityIframeById("createFrame");
}

// Klicks auf Sidebar-Links abfangen (interne Navigation)
document.addEventListener("click", (e) => {
    const a = e.target.closest("a.side-link");
    if (!a) return;

    const url = new URL(a.href, location.origin);
    if (url.origin === location.origin) {
        e.preventDefault();

        // NEU: Beim Aufruf der Iframe-Sections immer hart resetten
        const targetId = a.dataset.target;
        maybeResetIframeForTarget(targetId);

        navigateTo(url.pathname, true);
    }
});

// Initial: richtige Section anhand der URL anzeigen
window.addEventListener("DOMContentLoaded", () => {
    navigateTo(location.pathname, false);

    // ---- Upload-Feature (dein bestehender Code, leicht gestrafft) ----
    const samples = [];
    const sampleListElem = document.getElementById('sampleList');
    const sampleTitleInput = document.getElementById('sampleTitle');
    const sampleDescriptionInput = document.getElementById('sampleDescription');
    const sampleFileInput = document.getElementById('sampleFile');
    const addSampleBtn = document.getElementById('addSampleBtn');

    function updateSampleList() {
        sampleListElem.innerHTML = '';
        samples.forEach((item, idx) => {
            const container = document.createElement('div');
            container.className = 'list-item';

            const infoSpan = document.createElement('span');
            infoSpan.innerHTML = `<strong>${item.title}</strong> – ${item.description}`;

            const downloadLink = document.createElement('a');
            const blob = new Blob([item.content], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            downloadLink.href = url;
            downloadLink.download = item.fileName || (item.title.replace(/\s+/g, '_') + '.json');
            downloadLink.textContent = 'Download';
            downloadLink.style.marginRight = '0.5rem';

            const delBtn = document.createElement('button');
            delBtn.textContent = 'Entfernen';
            delBtn.addEventListener('click', () => {
                samples.splice(idx, 1);
                updateSampleList();
            });

            const actionContainer = document.createElement('div');
            actionContainer.style.display = 'flex';
            actionContainer.style.gap = '0.3rem';
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
            reader.onerror = err => reject(err);
            reader.readAsText(file);
        });
    }

    if (addSampleBtn) {
        addSampleBtn.addEventListener('click', async () => {
            const title = sampleTitleInput.value.trim();
            const description = sampleDescriptionInput.value.trim();
            const file = sampleFileInput.files[0];

            if (!title) return alert('Bitte geben Sie einen Titel ein.');
            if (!description) return alert('Bitte geben Sie eine Beschreibung ein.');
            if (!file) return alert('Bitte wählen Sie eine JSON-Datei aus.');

            try {
                const content = await readFileAsText(file);
                samples.push({ title, description, content, fileName: file.name });
                sampleTitleInput.value = '';
                sampleDescriptionInput.value = '';
                sampleFileInput.value = '';
                updateSampleList();
            } catch (err) {
                console.error(err);
                alert('Fehler beim Lesen der Datei.');
            }
        });
    }

    // ---- Vollbild-Buttons für WebGL-Frames ----
    function setupFullscreen(buttonId, elementId) {
        const btn = document.getElementById(buttonId);
        const el = document.getElementById(elementId);
        if (!btn || !el) return;

        btn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }
        });

        btn.addEventListener('click', async () => {
            try {
                if (document.fullscreenElement) {
                    await document.exitFullscreen();
                    return;
                }
                await el.requestFullscreen();
            } catch (err) {
                console.error('Fullscreen-Fehler:', err);
                alert('Vollbildmodus ist in diesem Browser/Umfeld nicht verfügbar.');
            }
        });

        document.addEventListener('fullscreenchange', () => {
            const active = !!document.fullscreenElement;
            btn.textContent = active ? 'Vollbild beenden' : 'Vollbild';
            btn.setAttribute('aria-pressed', String(active));
        });
    }

    setupFullscreen('playFullscreenBtn', 'playFrame');
    setupFullscreen('createFullscreenBtn', 'createFrame');
});

// Browser Zurück/Vorwärts
window.addEventListener("popstate", (e) => {
    const path = e.state?.path || location.pathname;
    // NEU: Auch bei History-Navigation die Unity-Frames frisch starten
    const sectionId = routes[path] || routes["/"];
    maybeResetIframeForTarget(sectionId);

    navigateTo(path, false);
});
