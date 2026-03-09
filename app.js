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
      g[`y${y}p${p}`] = { codes: [], comment: '' };
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
  opleiding: null,    // { code, displayName }
  modules: [],       // [{ code, name, jaar, periodes, outcomes:[{ name, qualification, studiepunten }] }]
  achieved: new Set(),// "moduleCode|outcomeIndex"
  plan: {
    grid: initGrid(), // { 'y1p1': { codes:[], comment:'' }, ... }
    unplanned: [],    // module codes not yet placed
  },
  student: { name: '', number: '', coach: '', date: todayNL() },
  expanded: new Set(),// module codes expanded in step 2
  drag: { code: null, from: null },
  commentOpen: new Set(), // grid keys with open comment textarea
  lastSaved: null,   // string "14:32" na opslaan, null indien nog niet opgeslagen
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
function remaining(mod) {
  return mod.outcomes.filter((_, i) => !S.achieved.has(k(mod.code, i)));
}
function achievedCount(mod) {
  return mod.outcomes.filter((_, i) => S.achieved.has(k(mod.code, i))).length;
}
function incompleteModules() {
  return S.modules.filter(m => remaining(m).length > 0);
}
function cellEC(key) {
  return (S.plan.grid[key]?.codes ?? []).reduce((sum, code) => {
    const mod = S.modules.find(m => m.code === code);
    if (!mod) return sum;
    return sum + remaining(mod).reduce((s, o) => s + (o.studiepunten || 0), 0);
  }, 0);
}

// ============================================================
// MARKDOWN PARSER (legacy – behouden voor eventuele .md bestanden)
// ============================================================
function parseMarkdown(text) {
  const lines = text.split('\n');
  const modules = [];
  let curMod = null, curOut = null, body = [], inPeriodes = false;

  function saveOutcome() {
    if (!curOut || !curMod) return;
    const full = body.join('\n');
    const qm = full.match(/eindkwalificaties?\s+(.+?)\.?\s*$/m);
    curOut.qualification = qm ? qm[1].replace(/\s+en\s+/g, ', ').trim() : '';
    const smMatch = body.join('\n').match(/^-\s*(\d+)\s+studiepunten/m);
    curOut.studiepunten = smMatch ? parseInt(smMatch[1]) : 0;
    curMod.outcomes.push(curOut);
    curOut = null; body = [];
  }
  function saveModule() {
    saveOutcome();
    if (curMod && curMod.outcomes.length > 0) modules.push(curMod);
    curMod = null;
    inPeriodes = false;
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('# ') && !line.match(/^# Leeruitkomsten/i)) {
      saveModule();
      const m = line.match(/^# ((\d+)\.\S+)\s*(.*)/);
      if (m) curMod = { code: m[1], name: m[3].trim(), jaar: parseInt(m[2]), periodes: [], outcomes: [] };
    } else if (line === '### Periodes' && curMod && !curOut) {
      inPeriodes = true;
    } else if (inPeriodes && line.startsWith('- ') && curMod && !curOut) {
      const nums = line.slice(2).split('+').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      if (nums.length) curMod.periodes.push(nums);
    } else if (line.startsWith('## ') && curMod) {
      inPeriodes = false;
      saveOutcome();
      const name = line.slice(3).trim();
      if (name) curOut = { name, qualification: '', studiepunten: 0 };
    } else if (curOut) {
      if (line.startsWith('BOKS:')) saveOutcome();
      else body.push(line);
    } else if (inPeriodes && line && !line.startsWith('-')) {
      inPeriodes = false;
    }
  }
  saveModule();
  return modules;
}

// ============================================================
// JSON PARSER (primaire parser voor .json leeruitkomsten)
// ============================================================
function parseJSON(data) {
  return (data.modules || []).map(mod => {
    // Matches "1.1 Naam", "1.3-1.4 Naam", "2.3Keuzemodule Naam"
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
// SYNC PLAN after achieved changes
// ============================================================
function syncPlan() {
  const incompCodes = incompleteModules().map(m => m.code);
  // Remove completed modules from grid & unplanned
  Object.values(S.plan.grid).forEach(cell => {
    cell.codes = cell.codes.filter(c => incompCodes.includes(c));
  });
  S.plan.unplanned = S.plan.unplanned.filter(c => incompCodes.includes(c));
  // Add newly-incomplete modules to unplanned (if not already placed)
  const placed = new Set(Object.values(S.plan.grid).flatMap(cell => cell.codes));
  incompCodes.forEach(c => {
    if (!placed.has(c) && !S.plan.unplanned.includes(c)) {
      S.plan.unplanned.push(c);
    }
  });
}

// ============================================================
// LOCAL STORAGE – opslaan / laden
// ============================================================
function getSaveData() {
  return {
    v: 1,
    ts: Date.now(),
    code: S.opleiding?.code,
    displayName: S.opleiding?.displayName,
    achieved: [...S.achieved],
    plan: {
      grid: Object.fromEntries(
        Object.entries(S.plan.grid).map(([key, val]) => [key, { codes: [...val.codes], comment: val.comment }])
      ),
      unplanned: [...S.plan.unplanned]
    },
    student: { ...S.student },
    step: S.step >= 2 ? S.step : 2
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
    if (saved.v !== 1 || !saved.code) return false;
    const data = await fetch(`./leeruitkomsten/Leeruitkomsten-${encodeURIComponent(saved.code)}.json`).then(r => r.json());
    S.modules = parseJSON(data);
    S.opleiding = { code: saved.code, displayName: saved.displayName };
    S.achieved = new Set(saved.achieved || []);
    S.plan = {
      grid: saved.plan?.grid || initGrid(),
      unplanned: saved.plan?.unplanned || []
    };
    S.student = { ...S.student, ...(saved.student || {}) };
    S.step = saved.step >= 2 ? saved.step : 2;
    S.expanded = new Set();
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
  const steps = ['Opleiding kiezen', 'Leeruitkomsten', 'Studieplan'];
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
  if (S.step === 2) return renderStep2();
  return renderStep3();
}

// ─── Step 1 ─────────────────────────────────────────────────
function renderStep1() {
  // Controleer of er een opgeslagen studiepad is
  let resumeBanner = '';
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.v === 1 && saved.code) {
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

// ─── Step 2 helpers ─────────────────────────────────────────
function buildStandardGridData() {
  const grid = {};
  for (let y = 1; y <= 4; y++)
    for (let p = 1; p <= 4; p++)
      grid[gridKey(y, p)] = [];
  S.modules.forEach(mod => {
    if (!mod.jaar || !mod.periodes || mod.periodes.length === 0) return;
    mod.periodes.forEach(group => group.forEach(p => {
      const key = gridKey(mod.jaar, p);
      if (grid[key]) grid[key].push(mod);
    }));
  });
  return grid;
}

function chipClass(mod) {
  const ach = achievedCount(mod);
  if (mod.outcomes.length === 0) return 'chip-todo';
  if (ach === mod.outcomes.length) return 'chip-done';
  if (ach > 0) return 'chip-partial';
  return 'chip-todo';
}

function renderCurriculumGrid() {
  const stdGrid = buildStandardGridData();
  const hasAnyData = Object.values(stdGrid).some(mods => mods.length > 0);
  if (!hasAnyData) return '';

  const headerCells = [1, 2, 3, 4].map(p =>
    `<div class="cg-header">Periode ${p}</div>`
  ).join('');

  const rows = [1, 2, 3, 4].map(y => {
    const periodCells = [1, 2, 3, 4].map(p => {
      const mods = stdGrid[gridKey(y, p)] || [];
      const chips = mods.map(mod =>
        `<span class="chip ${chipClass(mod)}" title="${esc(mod.name)}">${esc(mod.code)}</span>`
      ).join('');
      return `<div class="cg-cell">${chips}</div>`;
    }).join('');
    return `
      <div class="cg-year-label">Jaar ${y}</div>
      ${periodCells}`;
  }).join('');

  return `
  <details class="curriculum-section" open>
    <summary class="curriculum-summary">Standaard curriculum overzicht</summary>
    <div class="curriculum-grid-outer">
      <div class="curriculum-grid">
        <div class="cg-corner"></div>
        ${headerCells}
        ${rows}
      </div>
      <div class="curriculum-legend">
        <span class="chip chip-done">Volledig behaald</span>
        <span class="chip chip-partial">Gedeeltelijk behaald</span>
        <span class="chip chip-todo">Nog te behalen</span>
      </div>
    </div>
  </details>`;
}

// ─── Step 2 ─────────────────────────────────────────────────
function renderStep2() {
  const total = S.modules.reduce((s, m) => s + m.outcomes.length, 0);
  const achCount = S.achieved.size;
  const pct = total ? Math.round(achCount / total * 100) : 0;

  const cards = S.modules.map(mod => {
    const ach = achievedCount(mod);
    const tot = mod.outcomes.length;
    const complete = ach === tot;
    const exp = S.expanded.has(mod.code);
    const mpct = tot ? Math.round(ach / tot * 100) : 0;

    const outcomesHtml = exp ? `
      <div class="module-outcomes">
        ${mod.outcomes.length === 0
        ? `<p class="no-outcomes">Geen leeruitkomsten beschikbaar voor deze module.</p>`
        : mod.outcomes.map((o, i) => {
          const done = S.achieved.has(k(mod.code, i));
          return `
              <label class="outcome-item ${done ? 'achieved' : ''}">
                <input type="checkbox" data-mod="${esc(mod.code)}" data-idx="${i}" ${done ? 'checked' : ''}>
                <div class="outcome-content">
                  <span class="outcome-name">${esc(o.name || '(naamloos)')}</span>
                  ${o.studiepunten ? `<span class="outcome-ec">${o.studiepunten} EC</span>` : ''}
                  ${o.qualification ? `<span class="outcome-qual">${esc(o.qualification)}</span>` : ''}
                </div>
              </label>`;
        }).join('')}
        <div class="module-actions">
          <button class="btn-link" data-sel-all="${esc(mod.code)}">Alles aanvinken</button>
          <button class="btn-link" data-desel-all="${esc(mod.code)}">Alles uitvinken</button>
        </div>
      </div>` : '';

    return `
    <div class="module-card ${complete ? 'complete' : ''}">
      <div class="module-header" data-toggle="${esc(mod.code)}">
        <div class="module-info">
          <span class="module-code">${esc(mod.code)}</span>
          <span class="module-name">${esc(mod.name)}</span>
        </div>
        <div class="module-meta">
          <span class="module-progress-text">${ach}/${tot} behaald</span>
          <div class="mini-progress" title="${mpct}%">
            <div class="mini-bar" style="width:${mpct}%"></div>
          </div>
          <span class="toggle-icon">${exp ? '▲' : '▼'}</span>
        </div>
      </div>
      ${outcomesHtml}
    </div>`;
  }).join('');

  return `
  <div class="step-content">
    <div class="step2-header">
      <div>
        <h2>Welke leeruitkomsten heb je al behaald?</h2>
        <p class="subtitle">Vink de behaalde leeruitkomsten aan. De rest komt in je studieplan.</p>
      </div>
      <div class="overall-progress">
        <div class="progress-label">Totaal behaald: ${achCount} / ${total} &nbsp;(${pct}%)</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>
    </div>
    ${renderCurriculumGrid()}
    <div class="step2-toolbar">
      <button class="btn-link" id="expand-all">Alles uitklappen</button>
      <button class="btn-link" id="collapse-all">Alles inklappen</button>
    </div>
    <div class="modules-list">${cards}</div>
    <div class="step-nav">
      <button class="btn btn-secondary" id="back-1">← Terug</button>
      <button class="btn btn-save" id="btn-save">💾 Opslaan${S.lastSaved ? ` (${S.lastSaved})` : ''}</button>
      <button class="btn btn-primary" id="go-3">Naar studieplan →</button>
    </div>
  </div>`;
}

// ─── Step 3 ─────────────────────────────────────────────────
function renderStep3() {
  syncPlan();

  const planCard = (code, fromId) => {
    const mod = S.modules.find(m => m.code === code);
    if (!mod) return '';
    const rem = remaining(mod);
    const ec = rem.reduce((s, o) => s + (o.studiepunten || 0), 0);
    return `
    <div class="plan-card"
         draggable="true"
         data-code="${esc(code)}"
         data-from="${esc(fromId)}">
      <div class="plan-card-hdr">
        <span class="module-code">${esc(mod.code)}</span>
        <span class="plan-card-name">${esc(mod.name)}</span>
        ${ec > 0 ? `<span class="plan-card-ec">${ec} EC</span>` : ''}
      </div>
      <ul class="remaining-list">
        ${rem.map(o => `<li>${esc(o.name)}</li>`).join('')}
      </ul>
    </div>`;
  };

  // Unplanned drop zone
  const unplannedZone = `
    <div class="drop-zone unplanned-zone" data-target="unplanned">
      ${S.plan.unplanned.map(c => planCard(c, 'unplanned')).join('')}
      ${S.plan.unplanned.length === 0
        ? '<p class="all-planned">Alle modules zijn ingepland 🎉</p>'
        : '<span class="drop-hint">Sleep hier naartoe</span>'}
    </div>`;

  // 4×4 grid header
  const headerRow = [1, 2, 3, 4].map(p =>
    `<div class="pg-header">Periode ${p}</div>`
  ).join('');

  // 4×4 grid rows
  const gridRows = [1, 2, 3, 4].map(y => {
    const cells = [1, 2, 3, 4].map(p => {
      const key = gridKey(y, p);
      const cell = S.plan.grid[key] || { codes: [], comment: '' };
      const ec = cellEC(key);
      const hasComment = cell.comment.trim().length > 0;
      const commentIsOpen = S.commentOpen.has(key);

      return `
      <div class="pg-cell">
        <div class="pg-cell-header">
          <span class="ec-badge">${ec} EC</span>
          <button class="comment-toggle${hasComment ? ' has-comment' : ''}"
                  data-comment-key="${esc(key)}"
                  title="${hasComment ? 'Opmerking bewerken' : 'Opmerking toevoegen'}">${hasComment ? '💬' : '+'}</button>
        </div>
        <div class="drop-zone" data-target="${esc(key)}">
          ${cell.codes.map(c => planCard(c, key)).join('')}
          <span class="drop-hint">Sleep hier naartoe</span>
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

  const incomplete = incompleteModules();
  const warningHtml = incomplete.length === 0
    ? `<div class="warning">Je hebt alle leeruitkomsten als behaald gemarkeerd. Er is niets om in te plannen.</div>`
    : '';

  return `
  <div class="step-content">
    <h2>Maak je studieplan</h2>
    <p class="subtitle">Sleep de modules naar het juiste jaar en periode. Druk op <strong>+</strong> om een opmerking toe te voegen. Druk daarna op <strong>Afdrukken</strong>.</p>
    ${warningHtml}
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

    <div class="planning-area">
      <div class="unplanned-section">
        <div class="section-title">
          Te plannen
          <span class="badge">${S.plan.unplanned.length}</span>
        </div>
        ${unplannedZone}
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
    </div>

    <div class="step-nav">
      <button class="btn btn-secondary" id="back-2">← Terug</button>
      <div class="step-nav-right">
        <button class="btn btn-save" id="btn-save">💾 Opslaan${S.lastSaved ? ` (${S.lastSaved})` : ''}</button>
        <button class="btn btn-print" id="btn-print">🖨 Afdrukken / Opslaan als PDF</button>
      </div>
    </div>
  </div>`;
}

// ─── Print view (only shown @media print) ───────────────────
function renderPrintView() {
  if (S.step !== 3) return '<div class="print-view"></div>';

  const { name, number, coach, date } = S.student;
  const opl = S.opleiding?.displayName ?? '';

  // Build rows from grid (year 1→4, period 1→4)
  const allRows = [];
  for (let y = 1; y <= 4; y++) {
    for (let p = 1; p <= 4; p++) {
      const key = gridKey(y, p);
      const cell = S.plan.grid[key];
      if (!cell || cell.codes.length === 0) continue;
      const ec = cellEC(key);
      const rows = cell.codes
        .map(code => S.modules.find(m => m.code === code))
        .filter(Boolean)
        .map(mod => ({ label: `Jaar ${y}, Periode ${p}`, mod, rem: remaining(mod), ec }));
      rows.forEach((r, i) => { r.groupSize = rows.length; r.firstInGroup = i === 0; });
      allRows.push(...rows);
    }
  }
  // Unplanned at the end
  if (S.plan.unplanned.length) {
    const rows = S.plan.unplanned
      .map(code => S.modules.find(m => m.code === code))
      .filter(Boolean)
      .map(mod => ({ label: 'Nog in te plannen', mod, rem: remaining(mod), ec: 0 }));
    rows.forEach((r, i) => { r.groupSize = rows.length; r.firstInGroup = i === 0; });
    allRows.push(...rows);
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
      <td><ul>${r.rem.map(o => `<li>${esc(o.name)}${o.studiepunten ? ` <em>(${o.studiepunten} EC)</em>` : ''}</li>`).join('')}</ul></td>
      ${ecCell}
    </tr>`;
  }).join('');

  // Comments section (only non-empty cells)
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
          <th>Te behalen leeruitkomsten</th>
          <th style="width:8%">EC</th>
        </tr>
      </thead>
      <tbody>
        ${rowHtml || '<tr class="pv-no-rows"><td colspan="4">Geen modules ingepland</td></tr>'}
      </tbody>
    </table>

    ${commentsHtml}

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
  // "9-3-2026" → "2026-03-09"
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
  // ── Step 1: load opleiding grid async
  const grid = document.getElementById('opleiding-grid');
  if (grid) loadOpleidingen();

  // ── Step 1: resume banner knoppen
  on('btn-resume', async () => {
    const ok = await loadSavedState();
    if (ok) render();
    else alert('Kon het opgeslagen studiepad niet laden.');
  });
  on('btn-fresh', () => {
    localStorage.removeItem(LS_KEY);
    render();
  });

  // ── Step 2 ──────────────────────────────────────────────
  document.querySelectorAll('[data-toggle]').forEach(el =>
    el.addEventListener('click', () => {
      const code = el.dataset.toggle;
      S.expanded.has(code) ? S.expanded.delete(code) : S.expanded.add(code);
      render();
    }));

  document.querySelectorAll('input[data-mod]').forEach(cb =>
    cb.addEventListener('change', e => {
      const key_ = k(e.target.dataset.mod, e.target.dataset.idx);
      e.target.checked ? S.achieved.add(key_) : S.achieved.delete(key_);
      render();
    }));

  document.querySelectorAll('[data-sel-all]').forEach(btn =>
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const mod = S.modules.find(m => m.code === btn.dataset.selAll);
      if (mod) mod.outcomes.forEach((_, i) => S.achieved.add(k(mod.code, i)));
      render();
    }));

  document.querySelectorAll('[data-desel-all]').forEach(btn =>
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const mod = S.modules.find(m => m.code === btn.dataset.deselAll);
      if (mod) mod.outcomes.forEach((_, i) => S.achieved.delete(k(mod.code, i)));
      render();
    }));

  on('expand-all', () => {
    S.modules.forEach(m => S.expanded.add(m.code));
    render();
  });
  on('collapse-all', () => { S.expanded.clear(); render(); });

  // ── Navigation ──────────────────────────────────────────
  on('back-1', () => { S.step = 1; render(); });
  on('go-3', () => { S.step = 3; render(); });
  on('back-2', () => { S.step = 2; render(); });

  // ── Opslaan (stap 2 & 3) ────────────────────────────────
  on('btn-save', saveState);

  // ── Step 3: comment toggle ───────────────────────────────
  document.querySelectorAll('.comment-toggle[data-comment-key]').forEach(btn =>
    btn.addEventListener('click', () => {
      const key = btn.dataset.commentKey;
      S.commentOpen.has(key) ? S.commentOpen.delete(key) : S.commentOpen.add(key);
      render();
    }));

  // Step 3: comment textarea – live save without re-render
  document.querySelectorAll('.period-comment[data-grid-key]').forEach(ta =>
    ta.addEventListener('input', () => {
      const key = ta.dataset.gridKey;
      if (S.plan.grid[key]) S.plan.grid[key].comment = ta.value;
    }));

  // ── Student form – live save without re-render ───────────
  bindInput('f-name', v => S.student.name = v);
  bindInput('f-number', v => S.student.number = v);
  bindInput('f-coach', v => S.student.coach = v);
  bindInput('f-date', v => { S.student.date = inputToNL(v); });

  // Print
  on('btn-print', () => {
    document.getElementById('print-view').outerHTML = renderPrintView();
    window.print();
  });

  // ── Drag & Drop ─────────────────────────────────────────
  document.querySelectorAll('.plan-card').forEach(card => {
    card.addEventListener('dragstart', e => {
      S.drag = { code: card.dataset.code, from: card.dataset.from };
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
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', e => {
      if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
    });
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const { code, from } = S.drag;
      const to = zone.dataset.target;
      if (!code || from === to) return;

      // Remove from source
      if (from === 'unplanned') {
        S.plan.unplanned = S.plan.unplanned.filter(c => c !== code);
      } else {
        const cell = S.plan.grid[from];
        if (cell) cell.codes = cell.codes.filter(c => c !== code);
      }

      // Add to target
      if (to === 'unplanned') {
        if (!S.plan.unplanned.includes(code)) S.plan.unplanned.push(code);
      } else {
        const cell = S.plan.grid[to];
        if (cell && !cell.codes.includes(code)) cell.codes.push(code);
      }

      S.drag = { code: null, from: null };
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

    S.opleiding = { code, displayName };
    S.modules = modules;
    S.achieved.clear();
    S.expanded.clear();
    S.commentOpen.clear();
    S.plan = {
      grid: initGrid(),
      unplanned: modules.map(m => m.code),
    };
    S.step = 2;

    if (modules.length === 0) {
      alert(`De opleiding "${displayName}" heeft nog geen leeruitkomsten in het JSON-bestand.`);
      return;
    }
    render();
  } catch (e) {
    alert('Fout bij laden van leeruitkomsten: ' + e.message);
  }
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => render());
