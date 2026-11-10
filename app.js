'use strict';
// Community context site. Plain JavaScript, no libraries. Reads data/cities.json and data/groups.json.

const PERIODS = ['2000', '2006_10', '2020_24'];
const PERIOD_LABEL = { '2000': '2000 Census', '2006_10': '2006-2010 survey', '2020_24': '2020-2024 survey' };
const VARIABLES = ['population', 'foreign_born_percent', 'poverty_percent', 'unemployment_percent'];
const TOP = 50;
// National values the course provides. The student types the others.
const national = {
  population: { '2000': '281421906', '2006_10': '303965272', '2020_24': '334922499' }, // 50 states and DC, same tables as the city data
  foreign_born_percent: { '2000': '11.1', '2006_10': '12.7', '2020_24': '14.1' },
  poverty_percent: { '2000': '', '2006_10': '', '2020_24': '' },
  unemployment_percent: { '2000': '', '2006_10': '', '2020_24': '' },
};

let cities, groups;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const int = (n) => Math.round(n).toLocaleString('en-US');
const dec = (n, d = 1) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const cell = (v) => (v === null || v === undefined ? '' : Number.isInteger(v) ? int(v) : dec(v, 2));

let current = null; // what is on screen: { group, rankBy, vars, rows }

function fill(select, items, selected) {
  select.innerHTML = items.map(([value, label]) => `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(label)}</option>`).join('');
}

async function start() {
  try {
    [cities, groups] = await Promise.all(['data/cities.json', 'data/groups.json'].map((f) =>
      fetch(f).then((r) => { if (!r.ok) throw new Error(`${f}: ${r.status}`); return r.json(); })));
  } catch (e) {
    $('group').innerHTML = '<option>Could not load the data</option>';
    $('problem').textContent = 'The data files did not load (' + e.message + '). Open this page from a web server, not by double-clicking the file. See README.md.';
    return;
  }
  const order = groups.names.map((n, i) => [n, i]).sort((a, b) => a[0].localeCompare(b[0]));
  fill($('group'), [['', 'Choose a group...'], ...order.map(([n, i]) => [String(i), n])], '');
  fill($('rank'), PERIODS.map((p) => [p, PERIOD_LABEL[p]]), '2020_24');
  // Variables 1 and 2 are given; the student chooses variable 3.
  fill($('v1'), [['population', 'population']], 'population');
  fill($('v2'), [['foreign_born_percent', 'foreign_born_percent']], 'foreign_born_percent');
  $('v1').disabled = $('v2').disabled = true;
  fill($('v3'), ['poverty_percent', 'unemployment_percent'].map((v) => [v, v]), 'poverty_percent');
  ['group', 'rank', 'v1', 'v2', 'v3'].forEach((id) => $(id).addEventListener('change', render));
  $('csv').addEventListener('click', downloadCsv);
  document.querySelectorAll('nav.tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  $('savenotes').addEventListener('click', saveNotes);
  render();
}

// The 50 cities with the largest group, by the chosen period. Ties: lower city code first.
function topCities(g, rankBy) {
  const size = groups.size[rankBy][g];
  const idx = cities.code.map((_, i) => i);
  idx.sort((a, b) => size[b] - size[a] || (cities.code[a] < cities.code[b] ? -1 : 1));
  return idx.slice(0, TOP);
}

function render() {
  const gv = $('group').value;
  const vars = [$('v1').value, $('v2').value, $('v3').value];
  $('problem').textContent = new Set(vars).size < 3 ? 'Choose three different variables.' : '';
  const chosen = gv !== '';
  document.querySelectorAll('.need').forEach((e) => (e.hidden = chosen));
  document.querySelectorAll('.have').forEach((e) => (e.hidden = !chosen));
  if (!chosen) { current = null; drawData(); return; }
  const g = Number(gv);
  const rankBy = $('rank').value;
  const rows = topCities(g, rankBy);
  current = { g, rankBy, vars, rows };
  $('title-top').textContent = `${groups.names[g]}: the ${TOP} cities where the group is largest (ranked by ${PERIOD_LABEL[rankBy]})`;
  $('title-weighted').textContent = `Weighted averages for ${groups.names[g]} (top ${TOP} cities, ranked by ${PERIOD_LABEL[rankBy]})`;
  drawTop();
  drawNational();
  drawCalcs();
  drawCoverage();
  drawData();
}

// ---- tabs ----
function showTab(name) {
  document.querySelectorAll('nav.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  document.querySelectorAll('section.tab').forEach((s) => (s.hidden = s.id !== 'tab-' + name));
}

// ---- Data tab: every city, sortable ----
let dataSort = { col: 0, dir: 1 };
function dataColumns() {
  const cols = [
    { name: 'city_code', get: (i) => cities.code[i], text: true },
    { name: 'city', get: (i) => cities.city[i], text: true },
    { name: 'state', get: (i) => cities.state[i], text: true },
  ];
  PERIODS.forEach((p) => cols.push({ name: `group_size_${p}`, get: (i) => (current ? groups.size[p][current.g][i] : null) }));
  VARIABLES.forEach((v) => PERIODS.forEach((p) => cols.push({ name: `${v}_${p}`, get: (i) => cities.values[p][v][i] })));
  return cols;
}
function drawData() {
  if (!cities) return;
  const cols = dataColumns();
  const idx = cities.code.map((_, i) => i);
  const c = cols[dataSort.col];
  idx.sort((a, b) => {
    const x = c.get(a), y = c.get(b);
    if (x === null || x === undefined) return 1;
    if (y === null || y === undefined) return -1;
    const r = c.text ? String(x).localeCompare(String(y)) : x - y;
    return r * dataSort.dir || (cities.code[a] < cities.code[b] ? -1 : 1);
  });
  const arrow = (k) => (k === dataSort.col ? (dataSort.dir > 0 ? ' ▲' : ' ▼') : '');
  let h = '<thead><tr>' + cols.map((x, k) => `<th class="${x.text ? 'l' : ''}" data-col="${k}">${esc(x.name)}${arrow(k)}</th>`).join('') + '</tr></thead><tbody>';
  for (const i of idx) h += '<tr>' + cols.map((x) => `<td class="${x.text ? 'l' : ''}">${x.text ? esc(x.get(i)) : cell(x.get(i))}</td>`).join('') + '</tr>';
  $('data').innerHTML = h + '</tbody>';
  $('data').querySelectorAll('th').forEach((th) => th.addEventListener('click', () => {
    const k = Number(th.dataset.col);
    dataSort = { col: k, dir: k === dataSort.col ? -dataSort.dir : (cols[k].text ? 1 : -1) };
    drawData();
  }));
}

function drawTop() {
  const { g, vars, rows } = current;
  let h = '<thead><tr><th class="l" rowspan="2">rank</th><th class="l" rowspan="2">city</th><th class="l" rowspan="2">state</th><th class="l" rowspan="2">city_code</th>';
  h += '<th colspan="3">group size (people born in the group\'s country)</th>';
  vars.forEach((v) => (h += `<th colspan="3">${esc(v)}</th>`));
  h += '</tr><tr>' + [...Array(1 + vars.length)].map(() => PERIODS.map((p) => `<th>${PERIOD_LABEL[p]}</th>`).join('')).join('') + '</tr></thead><tbody>';
  rows.forEach((i, k) => {
    h += `<tr><td class="l">${k + 1}</td><td class="l">${esc(cities.city[i])}</td><td class="l">${esc(cities.state[i])}</td><td class="l">${esc(cities.code[i])}</td>`;
    PERIODS.forEach((p) => (h += `<td>${int(groups.size[p][g][i])}</td>`));
    vars.forEach((v) => PERIODS.forEach((p) => (h += `<td>${cell(cities.values[p][v][i])}</td>`)));
    h += '</tr>';
  });
  $('top').innerHTML = h + '</tbody>';
}

function drawNational() {
  const t = $('national');
  let h = '<thead><tr><th class="l">variable</th>' + PERIODS.map((p) => `<th>${PERIOD_LABEL[p]}</th>`).join('') + '</tr></thead><tbody>';
  VARIABLES.forEach((v) => {
    h += `<tr><td class="l">${v}</td>` + PERIODS.map((p) => `<td><input type="number" step="any" aria-label="${v} ${PERIOD_LABEL[p]}" data-v="${v}" data-p="${p}" value="${esc(national[v][p])}"></td>`).join('') + '</tr>';
  });
  t.innerHTML = h + '</tbody>';
  t.querySelectorAll('input').forEach((el) => el.addEventListener('input', () => {
    national[el.dataset.v][el.dataset.p] = el.value;
    drawCalcs();
  }));
}

// Weighted average pieces for one variable and period.
function calc(v, p) {
  const { g, rows } = current;
  const weight = groups.size[p][g];
  const value = cities.values[p][v];
  let sumW = 0, sumWV = 0, sumV = 0, n = 0;
  for (const i of rows) {
    if (value[i] === null || value[i] === undefined) continue; // no value: left out
    sumW += weight[i]; sumWV += weight[i] * value[i]; sumV += value[i]; n++;
  }
  return { sumW, sumWV, n, weighted: sumW > 0 ? sumWV / sumW : null, plain: n > 0 ? sumV / n : null };
}

function drawCalcs() {
  if (!current) return;
  let h = '';
  current.vars.forEach((v) => {
    const res = PERIODS.map((p) => calc(v, p));
    const nat = PERIODS.map((p) => (!national[v] || national[v][p] === '' ? null : Number(national[v][p])));
    const row = (label, f, cls = '') => `<tr class="${cls}"><td class="l">${label}</td>` + PERIODS.map((p, k) => `<td>${f(res[k], k)}</td>`).join('') + '</tr>';
    h += `<h3>${esc(v)}</h3><div class="tablewrap" style="max-width:760px"><table class="calc"><thead><tr><th class="l"></th>` +
      PERIODS.map((p) => `<th>${PERIOD_LABEL[p]}</th>`).join('') + '</tr></thead><tbody>' +
      row('Cities with a value', (r) => r.n) +
      row('Sum of the group sizes (the weights)', (r) => int(r.sumW)) +
      row('Sum of (group size x value)', (r) => int(r.sumWV)) +
      row('Weighted average = second row / first row', (r) => (r.weighted === null ? 'no group residents' : dec(r.weighted)), 'key') +
      row('Plain average of the cities', (r) => (r.plain === null ? '' : dec(r.plain))) +
      row('National value', (r, k) => (nat[k] === null ? '<span class="muted">type it in Step 1</span>' : v === 'population' ? int(nat[k]) : String(nat[k]))) +
      row('Weighted average minus plain average', (r) => (r.weighted === null || r.plain === null ? '' : dec(r.weighted - r.plain))) +
      '</tbody></table></div>';
  });
  $('calcs').innerHTML = h;
}

function drawCoverage() {
  const { g, rows } = current;
  let h = '<thead><tr><th class="l">period</th><th>group residents in these 50 cities</th><th>group residents in the United States</th><th>share</th></tr></thead><tbody>';
  PERIODS.forEach((p) => {
    const inTop = rows.reduce((s, i) => s + groups.size[p][g][i], 0);
    const us = groups.us[p][g];
    h += `<tr><td class="l">${PERIOD_LABEL[p]}</td><td>${int(inTop)}</td><td>${int(us)}</td><td>${us > 0 ? dec((100 * inTop) / us) + '%' : ''}</td></tr>`;
  });
  $('coverage').innerHTML = h + '</tbody>';
}

function downloadCsv() {
  if (!current) return;
  const { g, vars, rows } = current;
  const q = (s) => (/[",\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
  const head = ['group', 'rank', 'city_code', 'city', 'state'];
  PERIODS.forEach((p) => head.push(`group_size_${p}`));
  vars.forEach((v) => PERIODS.forEach((p) => head.push(`${v}_${p}`)));
  const lines = [head.join(',')];
  rows.forEach((i, k) => {
    const r = [groups.names[g], k + 1, cities.code[i], cities.city[i], cities.state[i]];
    PERIODS.forEach((p) => r.push(groups.size[p][g][i]));
    vars.forEach((v) => PERIODS.forEach((p) => r.push(cities.values[p][v][i] ?? '')));
    lines.push(r.map(q).join(','));
  });
  const text = lines.join('\r\n') + '\r\n';
  const blob = new Blob(['﻿', text], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `top-${TOP}-cities-${groups.names[g].replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')}-ranked-${current.rankBy}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Test tab: save the answers as a text file (nothing is sent anywhere).
function saveNotes() {
    const answers = [...document.querySelectorAll('#feedback [data-q]')].map((e) => `${e.dataset.q}:\r\n${e.value.trim() || '(no answer)'}\r\n`);
  const text = ['Community context site: test notes', '', ...answers].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  a.download = 'community-context-test-notes.txt';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

start();
