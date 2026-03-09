'use strict';
/* ============================================================
   Mijn Studiepad – Frontend SPA
   Geen externe dependencies | Stateless (geen database)
   ============================================================ */

// ============================================================
// GRID HELPER (gedefinieerd vóór S zodat initGrid() werkt)
// ============================================================
function initGrid() {
  const g = {};
  for (let y = 1; y <= 4; y++)
    for (let p = 1; p <= 4; p++)
      g[`y${y}p${p}`] = { items: [], comment: '' };
  // items: [{ code: string, idx: number }]
  return g;
}
function gridKey(y, p) { return `y${y}p${p}`; }

// ============================================================
// LOCAL STORAGE KEY
// ============================================================
const LS_KEY = 'mijn-studiepad-v1';

// ============================================================
// STATE
// ============================================================
const S = {
  step: 1,
  opleiding: null,      // { code, displayName }
  modules: [],          // [{ code, name, jaar, periodes: [[...]], outcomes:[{name, studiepunten, qualification}] }]
  achieved: new Set(),  // "moduleCode|outcomeIndex"
  plan: {
    grid: initGrid(),   // { 'y1p1': { items:[{code,idx}], comment:'' }, ... }
  },
  student: { name: '', number: '', coach: '', date: todayNL() },
  drag: { code: null, idx: null, from: null },
  commentOpen: new Set(),
  lastSaved: null,
};

// ============================================================
// UTILITIES
// ============================================================
function todayNL() {
  return new Date().toLocaleDateString('nl-NL');
}
function k(code, i) { return `${code}|${i}`; }
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Toegestane grid-cellen voor een module (zelfde jaar, toegestane periodes)
function allowedKeys(mod) {
  if (!mod?.periodes?.length || !mod.periodes[0]?.length) return [];
  return mod.periodes[0].map(p => gridKey(mod.jaar, p));
}

// EC voor een cel (behaalde LUs tellen niet mee)
function cellEC(key) {
  return (S.plan.grid[key]?.items ?? []).reduce((sum, item) => {
    if (S.achieved.has(k(item.code, item.idx))) return sum;
    const outcome = S.modules.find(m => m.code === item.code)?.outcomes[item.idx];
    return sum + (outcome?.studiepunten || 0);
  }, 0);
}

// Verdeel LUs gelijkmatig (round-robin) over beschikbare periodes
function distributeItems(modules) {
  const grid = initGrid();
  modules.forEach(mod => {
    const periods = mod.periodes?.[0] ?? [];
    if (!periods.length || mod.jaar < 1 || mod.jaar > 4) return;
    mod.outcomes.forEach((_, i) => {
      const p = periods[i % periods.length];
      const key = gridKey(mod.jaar, p);
      if (grid[key]) grid[key].items.push({ code: mod.code, idx: i });
    });
  });
  return grid;
}

// ============================================================
// JSON PARSER (primaire parser voor .json leeruitkomsten)
// ============================================================
function parseJSON(data) {
  return (data.modules || []).map(mod => {
    const m = mod.naam?.match(/^((\d+)\.\S*)\s*(.*)/);
    if (!m) return null;
    const code = m[1];
    const jaar = parseInt(m[2]);
    const name = m[3].trim() || m[1];
    // Converteer flat periodes [1,2] → [[1,2]] zodat de gridlogica werkt
    const periodes = mod.periodes?.length ? [mod.periodes] : [];
    const outcomes = (mod.leeruitkomsten || []).map(lu => {
      const qm = (lu.omschrijving || '').match(/eindkwalificaties?\s+(.+?)\.?\s*$/m);
      return {
        name: lu.titel || '',
        studiepunten: lu.studiepunten || 0,
        qualification: qm ? qm[1].replace(/\s+en\s+/g, ', ').trim() : ''
      };
    });
    return { code, name, jaar, periodes, outcomes };
  }).filter(Boolean);
}

// ============================================================
// LOCAL STORAGE – opslaan / laden  (formaat v2 = items-gebaseerd)
// ============================================================
function getSaveData() {
  return {
    v: 2,
    ts: Date.now(),
    code: S.opleiding?.code,
    displayName: S.opleiding?.displayName,
    achieved: [...S.achieved],
    plan: {
      grid: Object.fromEntries(
        Object.entries(S.plan.grid).map(([key, val]) => [
          key, { items: val.items.map(i => ({ ...i })), comment: val.comment }
        ])
      )
    },
    student: { ...S.student }
  };
}

function saveState() {
  if (!S.opleiding) return;
  localStorage.setItem(LS_KEY, JSON.stringify(getSaveData()));
  S.lastSaved = new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  render();
}

async function loadSavedState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    if (saved.v !== 2 || !saved.code) return false;
    const data = await fetch(`./leeruitkomsten/Leeruitkomsten-${encodeURIComponent(saved.code)}.json`).then(r => r.json());
    S.modules = parseJSON(data);
    S.opleiding = { code: saved.code, displayName: saved.displayName };
    S.achieved = new Set(saved.achieved || []);
    // Herstel grid (zorg dat ontbrekende cellen leeg zijn)
    const restoredGrid = initGrid();
    if (saved.plan?.grid) {
      Object.entries(saved.plan.grid).forEach(([key, val]) => {
        if (restoredGrid[key]) restoredGrid[key] = { items: val.items || [], comment: val.comment || '' };
      });
    }
    S.plan = { grid: restoredGrid };
    S.student = { ...S.student, ...(saved.student || {}) };
    S.step = 2;
    S.commentOpen = new Set();
    S.lastSaved = null;
    return true;
  } catch (_) {
    return false;
  }
}

// ============================================================
// RENDER ENGINE
// ============================================================
function render() {
  const app = document.getElementById('app');
  app.innerHTML = renderHeader() + `<main>${renderStep()}</main>` + renderPrintView();
  bindAll();
}

function renderHeader() {
  const steps = ['Opleiding kiezen', 'Studieplan'];
  return `
  <header>
    <div class="header-inner">
      <h1>Mijn Studiepad</h1>
      <nav class="steps" aria-label="Stappen">
        ${steps.map((n, i) => {
    const num = i + 1;
    const cls = num === S.step ? 'active' : num < S.step ? 'done' : '';
    const label = num < S.step ? '✓' : num;
    return (i > 0 ? '<div class="step-conn" aria-hidden="true"></div>' : '') +
      `<div class="step ${cls}" aria-current="${num === S.step ? 'step' : 'false'}">
              <span class="step-num">${label}</span>
              <span class="step-name">${n}</span>
            </div>`;
  }).join('')}
      </nav>
    </div>
  </header>`;
}

function renderStep() {
  if (S.step === 1) return renderStep1();
  return renderStep2();
}

// ─── Step 1 ─────────────────────────────────────────────────
function renderStep1() {
  let resumeBanner = '';
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.v === 2 && saved.code) {
        const savedDate = saved.ts ? new Date(saved.ts).toLocaleString('nl-NL', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        }) : 'onbekend';
        resumeBanner = `
        <div class="resume-banner">
          <span class="resume-icon">💾</span>
          <span class="resume-text">Opgeslagen studiepad gevonden voor <strong>${esc(saved.displayName || saved.code)}</strong> (${esc(savedDate)}). Wil je verdergaan?</span>
          <button class="btn btn-primary btn-sm" id="btn-resume">Ja, laden</button>
          <button class="btn btn-secondary btn-sm" id="btn-fresh">Nee, begin opnieuw</button>
        </div>`;
      }
    }
  } catch (_) { }

  return `
  <div class="step-content">
    <h2>Welke opleiding volg jij?</h2>
    <p class="subtitle">Kies je opleiding om te beginnen.</p>
    ${resumeBanner}
    <div class="opleiding-grid" id="opleiding-grid">
      <div class="loading">Opleidingen laden…</div>
    </div>
  </div>`;
}

// ─── Step 2 – gecombineerde stap ─────────────────────────────
function renderStep2() {
  const total = S.modules.reduce((s, m) => s + m.outcomes.length, 0);
  const achCount = S.achieved.size;
  const pct = total ? Math.round(achCount / total * 100) : 0;

  // 4×4 grid header
  const headerRow = [1, 2, 3, 4].map(p =>
    `<div class="pg-header">Periode ${p}</div>`
  ).join('');

  // 4×4 grid rows
  const gridRows = [1, 2, 3, 4].map(y => {
    const cells = [1, 2, 3, 4].map(p => {
      const key = gridKey(y, p);
      const cell = S.plan.grid[key] || { items: [], comment: '' };
      const ec = cellEC(key);
      const hasComment = cell.comment.trim().length > 0;
      const commentIsOpen = S.commentOpen.has(key);

      const luItemsHtml = cell.items.map(item => {
        const mod = S.modules.find(m => m.code === item.code);
        if (!mod) return '';
        const outcome = mod.outcomes[item.idx];
        if (!outcome) return '';
        const achieved = S.achieved.has(k(item.code, item.idx));
        return `
        <div class="lu-item${achieved ? ' achieved' : ''}"
             draggable="true"
             data-code="${esc(item.code)}"
             data-idx="${item.idx}"
             data-from="${esc(key)}">
          <input type="checkbox" class="lu-check"
                 data-mod="${esc(item.code)}" data-idx="${item.idx}"
                 ${achieved ? 'checked' : ''}>
          <div class="lu-info">
            <span class="lu-badge">${esc(item.code)}</span>
            <span class="lu-name" title="${esc(outcome.name)}">${esc(outcome.name)}</span>
          </div>
          ${outcome.studiepunten ? `<span class="lu-ec">${outcome.studiepunten}</span>` : ''}
        </div>`;
      }).join('');

      return `
      <div class="pg-cell">
        <div class="pg-cell-header">
          <span class="ec-badge">${ec} EC</span>
          <button class="comment-toggle${hasComment ? ' has-comment' : ''}"
                  data-comment-key="${esc(key)}"
                  title="${hasComment ? 'Opmerking bewerken' : 'Opmerking toevoegen'}">${hasComment ? '💬' : '+'}</button>
        </div>
        <div class="drop-zone" data-target="${esc(key)}">
          ${luItemsHtml}
          ${cell.items.length === 0 ? '<span class="drop-hint">Leeg</span>' : ''}
        </div>
        ${commentIsOpen ? `
        <textarea class="period-comment"
                  data-grid-key="${esc(key)}"
                  placeholder="Opmerking voor Jaar ${y}, Periode ${p}…">${esc(cell.comment)}</textarea>
        ` : ''}
      </div>`;
    }).join('');

    return `
      <div class="pg-year-label">Jaar ${y}</div>
      ${cells}`;
  }).join('');

  return `
  <div class="step-content">
    <div class="step2-header">
      <div>
        <h2>Studieplan – ${esc(S.opleiding?.displayName ?? '')}</h2>
        <p class="subtitle">Vink behaalde leeruitkomsten aan. Sleep een leeruitkomst naar een andere periode (alleen waar de module aangeboden wordt).</p>
      </div>
      <div class="overall-progress">
        <div class="progress-label">Behaald: ${achCount} / ${total} &nbsp;(${pct}%)</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>
    </div>

    <div class="plan-grid-section">
      <div class="plan-grid-wrapper">
        <div class="plan-grid">
          <div class="pg-corner"></div>
          ${headerRow}
          ${gridRows}
        </div>
      </div>
    </div>

    <details class="student-details">
      <summary class="student-summary">▸ Studentgegevens (voor afdrukken)</summary>
      <div class="student-form">
        <div class="form-row">
          <label>Naam student
            <input type="text" id="f-name" value="${esc(S.student.name)}" placeholder="Volledige naam">
          </label>
          <label>Studentnummer
            <input type="text" id="f-number" value="${esc(S.student.number)}" placeholder="12345678">
          </label>
        </div>
        <div class="form-row">
          <label>Studiecoach
            <input type="text" id="f-coach" value="${esc(S.student.coach)}" placeholder="Naam coach">
          </label>
          <label>Datum
            <input type="date" id="f-date" value="${dateToInput(S.student.date)}">
          </label>
        </div>
      </div>
    </details>

    <div class="step-nav">
      <button class="btn btn-secondary" id="back-1">← Terug</button>
      <div class="step-nav-right">
        <button class="btn btn-save" id="btn-save">💾 Opslaan${S.lastSaved ? ` (${S.lastSaved})` : ''}</button>
        <button class="btn btn-print" id="btn-print">🖨 Afdrukken / PDF</button>
      </div>
    </div>
  </div>`;
}

// ─── Print view (only shown @media print) ───────────────────
function renderPrintView() {
  if (S.step !== 2) return '<div class="print-view"></div>';

  const { name, number, coach, date } = S.student;
  const opl = S.opleiding?.displayName ?? '';

  // Hoofdtabel: niet-behaalde LUs per periode
  const allRows = [];
  for (let y = 1; y <= 4; y++) {
    for (let p = 1; p <= 4; p++) {
      const key = gridKey(y, p);
      const cell = S.plan.grid[key];
      if (!cell) continue;
      const pendingItems = cell.items.filter(item => !S.achieved.has(k(item.code, item.idx)));
      if (pendingItems.length === 0) continue;

      // Bereken EC voor deze cel (alleen niet-behaald)
      const ec = pendingItems.reduce((sum, item) => {
        const outcome = S.modules.find(m => m.code === item.code)?.outcomes[item.idx];
        return sum + (outcome?.studiepunten || 0);
      }, 0);

      pendingItems.forEach((item, i) => {
        const mod = S.modules.find(m => m.code === item.code);
        const outcome = mod?.outcomes[item.idx];
        if (!mod || !outcome) return;
        allRows.push({
          label: `Jaar ${y}, Periode ${p}`,
          groupSize: pendingItems.length,
          firstInGroup: i === 0,
          mod,
          outcome,
          ec
        });
      });
    }
  }

  const rowHtml = allRows.map(r => {
    const periodCell = r.firstInGroup
      ? `<td class="pv-period-cell" rowspan="${r.groupSize}">${esc(r.label)}</td>`
      : '';
    const ecCell = r.firstInGroup
      ? `<td class="pv-ec-cell" rowspan="${r.groupSize}">${r.ec} EC</td>`
      : '';
    return `
    <tr>
      ${periodCell}
      <td><strong>${esc(r.mod.code)}</strong> ${esc(r.mod.name)}</td>
      <td>${esc(r.outcome.name)}${r.outcome.studiepunten ? ` <em>(${r.outcome.studiepunten} EC)</em>` : ''}</td>
      ${ecCell}
    </tr>`;
  }).join('');

  // Opmerkingen per periode
  const comments = [];
  for (let y = 1; y <= 4; y++) {
    for (let p = 1; p <= 4; p++) {
      const key = gridKey(y, p);
      const cell = S.plan.grid[key];
      if (cell && cell.comment.trim()) {
        comments.push({ label: `Jaar ${y}, Periode ${p}`, text: cell.comment.trim() });
      }
    }
  }
  const commentsHtml = comments.length > 0 ? `
    <div class="pv-section-title">Opmerkingen per periode</div>
    <ul class="pv-comments">
      ${comments.map(c => `<li><strong>${esc(c.label)}:</strong> ${esc(c.text)}</li>`).join('')}
    </ul>` : '';

  // Sectie behaalde leeruitkomsten (onderaan)
  let achievedHtml = '';
  if (S.achieved.size > 0) {
    const achievedRows = [];
    S.modules.forEach(mod => {
      mod.outcomes.forEach((outcome, i) => {
        if (S.achieved.has(k(mod.code, i))) {
          achievedRows.push({ mod, outcome, idx: i });
        }
      });
    });
    // Sorteer op module.code
    achievedRows.sort((a, b) => a.mod.code.localeCompare(b.mod.code, undefined, { numeric: true }));

    achievedHtml = `
    <div class="pv-section-title">Reeds behaalde leeruitkomsten</div>
    <table class="pv-achieved-table">
      <thead>
        <tr>
          <th>Module</th>
          <th>Leeruitkomst</th>
          <th style="width:8%">EC</th>
        </tr>
      </thead>
      <tbody>
        ${achievedRows.map(r => `
        <tr>
          <td><strong>${esc(r.mod.code)}</strong> ${esc(r.mod.name)}</td>
          <td>${esc(r.outcome.name)}</td>
          <td>${r.outcome.studiepunten || ''}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  }

  return `
  <div class="print-view" id="print-view">
    <div class="pv-title">STUDIEPLAN</div>
    <table class="pv-info-table">
      <tr>
        <td><strong>Naam:</strong> ${esc(name) || '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}</td>
        <td><strong>Studentnummer:</strong> ${esc(number) || '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}</td>
      </tr>
      <tr>
        <td><strong>Opleiding:</strong> ${esc(opl)}</td>
        <td><strong>Datum:</strong> ${esc(date) || '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}</td>
      </tr>
      <tr>
        <td><strong>Studiecoach:</strong> ${esc(coach) || '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}</td>
        <td></td>
      </tr>
    </table>

    <div class="pv-section-title">Overzicht te behalen leeruitkomsten per periode</div>
    <table class="pv-plan-table">
      <thead>
        <tr>
          <th style="width:20%">Jaar / Periode</th>
          <th style="width:28%">Module</th>
          <th>Te behalen leeruitkomst</th>
          <th style="width:8%">EC</th>
        </tr>
      </thead>
      <tbody>
        ${rowHtml || '<tr class="pv-no-rows"><td colspan="4">Geen leeruitkomsten ingepland</td></tr>'}
      </tbody>
    </table>

    ${commentsHtml}

    ${achievedHtml}

    <div class="pv-sigs">
      <div class="pv-sig-block">
        <div class="pv-sig-label">Handtekening student:</div>
        <div class="pv-sig-line"></div>
        <div class="pv-sig-date">Datum: ____________________</div>
      </div>
      <div class="pv-sig-block">
        <div class="pv-sig-label">Handtekening studiecoach:</div>
        <div class="pv-sig-line"></div>
        <div class="pv-sig-date">Datum: ____________________</div>
      </div>
    </div>
  </div>`;
}

// ============================================================
// DATE HELPERS
// ============================================================
function dateToInput(nl) {
  const m = nl && nl.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return '';
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
function inputToNL(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleDateString('nl-NL');
}

// ============================================================
// BIND EVENT LISTENERS (called after each render)
// ============================================================
function bindAll() {
  // ── Step 1 ──────────────────────────────────────────────
  const grid = document.getElementById('opleiding-grid');
  if (grid) loadOpleidingen();

  on('btn-resume', async () => {
    const ok = await loadSavedState();
    if (ok) render();
    else alert('Kon het opgeslagen studiepad niet laden.');
  });
  on('btn-fresh', () => {
    localStorage.removeItem(LS_KEY);
    render();
  });

  // ── Step 2: checkboxes ──────────────────────────────────
  document.querySelectorAll('input.lu-check[data-mod]').forEach(cb =>
    cb.addEventListener('change', e => {
      const key_ = k(e.target.dataset.mod, e.target.dataset.idx);
      e.target.checked ? S.achieved.add(key_) : S.achieved.delete(key_);
      render();
    }));

  // ── Step 2: comment toggle ───────────────────────────────
  document.querySelectorAll('.comment-toggle[data-comment-key]').forEach(btn =>
    btn.addEventListener('click', () => {
      const key = btn.dataset.commentKey;
      S.commentOpen.has(key) ? S.commentOpen.delete(key) : S.commentOpen.add(key);
      render();
    }));

  // Step 2: comment textarea – live save without re-render
  document.querySelectorAll('.period-comment[data-grid-key]').forEach(ta =>
    ta.addEventListener('input', () => {
      const key = ta.dataset.gridKey;
      if (S.plan.grid[key]) S.plan.grid[key].comment = ta.value;
    }));

  // ── Navigation ──────────────────────────────────────────
  on('back-1', () => { S.step = 1; render(); });

  // ── Opslaan ─────────────────────────────────────────────
  on('btn-save', saveState);

  // ── Student form – live save without re-render ───────────
  bindInput('f-name', v => S.student.name = v);
  bindInput('f-number', v => S.student.number = v);
  bindInput('f-coach', v => S.student.coach = v);
  bindInput('f-date', v => { S.student.date = inputToNL(v); });

  // ── Print ────────────────────────────────────────────────
  on('btn-print', () => {
    const pv = document.getElementById('print-view');
    if (pv) pv.outerHTML = renderPrintView();
    window.print();
  });

  // ── Drag & Drop (LU-niveau) ──────────────────────────────
  document.querySelectorAll('.lu-item').forEach(card => {
    card.addEventListener('dragstart', e => {
      // Geen drag als de gebruiker op de checkbox klikt
      if (e.target.type === 'checkbox') { e.preventDefault(); return; }
      S.drag = {
        code: card.dataset.code,
        idx: parseInt(card.dataset.idx, 10),
        from: card.dataset.from
      };
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => card.classList.add('dragging'), 0);
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.drop-zone').forEach(z => z.classList.remove('drag-over'));
    });
  });

  document.querySelectorAll('.drop-zone').forEach(zone => {
    zone.addEventListener('dragover', e => {
      const { code, from } = S.drag;
      if (!code) return;
      const to = zone.dataset.target;
      if (to === from) return; // zelfde cel, niet verplaatsen
      const mod = S.modules.find(m => m.code === code);
      if (mod && allowedKeys(mod).includes(to)) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        zone.classList.add('drag-over');
      }
      // Geen preventDefault → browser toont no-drop cursor voor niet-toegestane cellen
    });
    zone.addEventListener('dragleave', e => {
      if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
    });
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const { code, idx, from } = S.drag;
      const to = zone.dataset.target;
      if (!code || from === to) return;

      // Verwijder uit bronce
      const sourceCell = S.plan.grid[from];
      if (sourceCell) {
        sourceCell.items = sourceCell.items.filter(item => !(item.code === code && item.idx === idx));
      }
      // Voeg toe aan doel
      const targetCell = S.plan.grid[to];
      if (targetCell && !targetCell.items.some(item => item.code === code && item.idx === idx)) {
        targetCell.items.push({ code, idx });
      }

      S.drag = { code: null, idx: null, from: null };
      render();
    });
  });
}

// ============================================================
// SMALL HELPERS
// ============================================================
function on(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', fn);
}
function bindInput(id, setter) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', () => setter(el.value));
}

// ============================================================
// DATA LOADING
// ============================================================
async function loadOpleidingen() {
  const grid = document.getElementById('opleiding-grid');
  if (!grid) return;
  try {
    const data = await fetch('./leeruitkomsten/opleidingen.json').then(r => r.json());
    if (!Array.isArray(data) || data.length === 0) {
      grid.innerHTML = `<p class="error">Geen opleidingen gevonden. Controleer <code>leeruitkomsten/opleidingen.json</code>.</p>`;
      return;
    }
    grid.innerHTML = data.map(o => `
      <button class="opleiding-card" data-code="${esc(o.code)}" data-name="${esc(o.displayName)}">
        <span class="opleiding-icon">${opleidingIcon(o.code)}</span>
        <span class="opleiding-name">${esc(o.displayName)}</span>
        <span class="opleiding-code">${esc(o.code)}</span>
      </button>`).join('');

    grid.querySelectorAll('.opleiding-card').forEach(btn =>
      btn.addEventListener('click', () => selectOpleiding(btn.dataset.code, btn.dataset.name)));
  } catch (e) {
    grid.innerHTML = `<p class="error">Fout bij laden: ${esc(e.message)}</p>`;
  }
}

function opleidingIcon(code) {
  return { ICT: '💻', CMD: '🎨', ET: '⚡' }[code] ?? '📚';
}

async function selectOpleiding(code, displayName) {
  try {
    const data = await fetch(`./leeruitkomsten/Leeruitkomsten-${encodeURIComponent(code)}.json`).then(r => r.json());
    const modules = parseJSON(data);

    if (modules.length === 0) {
      alert(`De opleiding "${displayName}" heeft nog geen leeruitkomsten in het JSON-bestand.`);
      return;
    }

    S.opleiding = { code, displayName };
    S.modules = modules;
    S.achieved = new Set();
    S.commentOpen = new Set();
    S.plan = { grid: distributeItems(modules) };
    S.lastSaved = null;
    S.step = 2;
    render();
  } catch (e) {
    alert('Fout bij laden van leeruitkomsten: ' + e.message);
  }
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => render());
