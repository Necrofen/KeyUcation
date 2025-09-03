/*
 * Skript für KeyUcation Homepage
 * Diese Version stellt eine stark vereinfachte Webseite bereit.
 * Sie bietet zwei Bereiche: eine Erklärung über KeyUcation und die Möglichkeit,
 * JSON-Dateien hochzuladen und zum Download bereitzustellen. Ein Login- oder
 * Rollenmanagement ist nicht enthalten.
 */

document.addEventListener('DOMContentLoaded', () => {
  /* Seitenmenü-Navigation
   * Beim Klick auf eine Seiten-Link-Schaltfläche wird der entsprechende
   * Bereich angezeigt und andere Bereiche werden ausgeblendet.
   */
  const sideLinks = document.querySelectorAll('#sideMenu .side-link');
  const sideSections = document.querySelectorAll('.sidecontent');
  sideLinks.forEach(link => {
    link.addEventListener('click', () => {
      // Aktive Klasse anpassen
      sideLinks.forEach(l => l.classList.remove('active'));
      sideSections.forEach(sec => sec.classList.remove('active'));
      link.classList.add('active');
      const target = link.dataset.target;
      const targetSection = document.getElementById(target);
      if (targetSection) {
        targetSection.classList.add('active');
      }
    });
  });

  /* Beispiel-Upload-Bereich
   * Benutzer können JSON-Dateien hochladen, ihnen einen Titel und eine
   * Beschreibung geben und sie in einer Liste anzeigen lassen. Jede Datei
   * kann anschließend heruntergeladen oder entfernt werden.
   */
  const samples = [];
  const sampleListElem = document.getElementById('sampleList');
  const sampleTitleInput = document.getElementById('sampleTitle');
  const sampleDescriptionInput = document.getElementById('sampleDescription');
  const sampleFileInput = document.getElementById('sampleFile');
  const addSampleBtn = document.getElementById('addSampleBtn');

  /**
   * Aktualisiert die Liste der hochgeladenen Dateien im Upload-Bereich.
   */
  function updateSampleList() {
    sampleListElem.innerHTML = '';
    samples.forEach((item, idx) => {
      const container = document.createElement('div');
      container.className = 'list-item';
      const infoSpan = document.createElement('span');
      infoSpan.innerHTML = `<strong>${item.title}</strong> – ${item.description}`;
      // Download-Link
      const downloadLink = document.createElement('a');
      const blob = new Blob([item.content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      downloadLink.download = item.fileName || (item.title.replace(/\s+/g, '_') + '.json');
      downloadLink.textContent = 'Download';
      downloadLink.style.marginRight = '0.5rem';
      // Entfernen-Button
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Entfernen';
      delBtn.addEventListener('click', () => {
        samples.splice(idx, 1);
        updateSampleList();
      });
      // Action-Container
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

  /**
   * Liest den Inhalt einer Datei als Text.
   * @param {File} file Die Datei, deren Text gelesen werden soll
   * @returns {Promise<string>} Der gelesene Text
   */
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = err => reject(err);
      reader.readAsText(file);
    });
  }

  // Button-Handler für das Hinzufügen einer Datei
  if (addSampleBtn) {
    addSampleBtn.addEventListener('click', async () => {
      const title = sampleTitleInput.value.trim();
      const description = sampleDescriptionInput.value.trim();
      const file = sampleFileInput.files[0];
      if (!title) {
        alert('Bitte geben Sie einen Titel ein.');
        return;
      }
      if (!description) {
        alert('Bitte geben Sie eine Beschreibung ein.');
        return;
      }
      if (!file) {
        alert('Bitte wählen Sie eine JSON-Datei aus.');
        return;
      }
      try {
        const content = await readFileAsText(file);
        samples.push({ title, description, content, fileName: file.name });
        sampleTitleInput.value = '';
        sampleDescriptionInput.value = '';
        sampleFileInput.value = '';
        updateSampleList();
      } catch (err) {
        alert('Fehler beim Lesen der Datei.');
        console.error(err);
      }
    });
  }

  /* -------- Vollbild-Funktionalität für WebGL-Frames -------- */

  /**
   * Bindet einen Vollbild-Button an ein Element (z.B. <iframe>).
   * @param {string} buttonId  ID des Buttons
   * @param {string} elementId ID des Elements, das in den Vollbildmodus soll
   */
  function setupFullscreen(buttonId, elementId) {
    const btn = document.getElementById(buttonId);
    const el  = document.getElementById(elementId);
    if (!btn || !el) return;

    // Optional: kurze Tastatur-Accessibility
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        btn.click();
      }
    });

    btn.addEventListener('click', async () => {
      try {
        // Toggle: wenn bereits Vollbild aktiv, dann beenden
        if (document.fullscreenElement) {
          await document.exitFullscreen();
          return;
        }
        // Für iframes reicht requestFullscreen() am Iframe selbst
        await el.requestFullscreen();
      } catch (err) {
        console.error('Fullscreen-Fehler:', err);
        alert('Vollbildmodus ist in diesem Browser/Umfeld nicht verfügbar.');
      }
    });

    // Button-Text dynamisch anpassen
    document.addEventListener('fullscreenchange', () => {
      const active = !!document.fullscreenElement;
      btn.textContent = active ? 'Vollbild beenden' : 'Vollbild';
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  // Zwei Einbettungen anbinden:
  setupFullscreen('playFullscreenBtn',   'playFrame');
  setupFullscreen('createFullscreenBtn', 'createFrame');
});
