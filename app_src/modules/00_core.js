/* Shared helpers: safe DOM building (user-entered names are never parsed as HTML),
 * money in whole cents, dates, ids, CSV import/export and a print helper. Every view
 * module below composes these. */
(function (g) {
  var App = g.App = g.App || { views: {}, nav: [] };

  /** h('div', {class, text, attrs:{}, on:{click}, dataset:{}}, ...children) */
  function h(tag, props) {
    var el = document.createElement(tag);
    var p = props || {};
    Object.keys(p).forEach(function (k) {
      var v = p[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'on') Object.keys(v).forEach(function (ev) { el.addEventListener(ev, v[ev]); });
      else if (k === 'dataset') Object.keys(v).forEach(function (d) { el.dataset[d] = v[d]; });
      else if (k === 'attrs') Object.keys(v).forEach(function (a) { if (v[a] != null && v[a] !== false) el.setAttribute(a, v[a] === true ? '' : v[a]); });
      else el[k] = v;
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (c) { append(el, c); }); return; }
    el.appendChild(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
  }

  /* ---------- Money (whole cents) ---------- */
  function currency() { return App.store.get('currency', 'USD'); }
  function fmt(cents) {
    var c = Math.round(cents || 0);
    var whole = c % 100 === 0;
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency', currency: currency(),
        minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2,
      }).format(c / 100);
    } catch (e) {
      return (c / 100).toFixed(whole ? 0 : 2);
    }
  }
  /** "1,234.50" / "1.234,50" / "12" -> cents, or null when it is not a number. */
  function parseMoney(str) {
    var s = String(str == null ? '' : str).replace(/[^\d.,-]/g, '');
    if (!s || s === '-' || s === '.' || s === ',') return null;
    var hasDot = s.indexOf('.') >= 0, hasComma = s.indexOf(',') >= 0;
    if (hasDot && hasComma) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (hasComma) {
      s = /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
    }
    var n = parseFloat(s);
    return isFinite(n) ? Math.round(n * 100) : null;
  }
  function inputMoney(cents) {
    if (!cents) return '';
    var v = cents / 100;
    return v % 1 === 0 ? String(v) : v.toFixed(2);
  }

  /* ---------- Dates ---------- */
  function parseISO(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function today() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function daysUntil(iso) {
    var d = parseISO(iso);
    return d ? Math.round((d - today()) / 86400000) : null;
  }
  function fmtDate(d) {
    try { return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(d); }
    catch (e) { return d.toDateString(); }
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function iso(d) {
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  /** Same day-of-month, clamped to the last day when the target month is shorter. */
  function addMonths(d, n) {
    var first = new Date(d.getFullYear(), d.getMonth() + n, 1);
    var last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    return new Date(first.getFullYear(), first.getMonth(), Math.min(d.getDate(), last));
  }
  function monthKey(isoDate) { return String(isoDate || '').slice(0, 7); }
  function monthLabel(key) {
    var m = /^(\d{4})-(\d{2})$/.exec(key || '');
    if (!m) return key || '';
    try { return new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit' }).format(new Date(+m[1], +m[2] - 1, 1)); }
    catch (e) { return key; }
  }

  /* ---------- CSV (import and export) ---------- */
  /** Parses CSV text (quoted fields, "" escapes, CRLF/LF, a trailing blank line) into rows of strings. */
  function parseCSV(text) {
    var rows = [], row = [], cur = '', q = false, i = 0, s = String(text || '').replace(/^\uFEFF/, '');
    for (; i < s.length; i++) {
      var ch = s[i];
      if (q) {
        if (ch === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && s[i + 1] === '\n') i++;
        row.push(cur); cur = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else cur += ch;
    }
    row.push(cur);
    if (row.length > 1 || row[0] !== '') rows.push(row);
    return rows;
  }
  function csvCell(v) {
    var s = v == null ? '' : String(v);
    // Spreadsheet formula injection: a leading = + - @ would be run as a formula when opened.
    if (/^[=+\-@]/.test(s) && isNaN(Number(s))) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCSV(rows) { return rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n'; }
  function download(filename, text, type) {
    var blob = new Blob([text], { type: type || 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  /* ---------- Small shared UI pieces ---------- */
  function field(id, label, control, help) {
    return h('div', { class: 'field' },
      h('label', { attrs: { for: id }, text: label }), control,
      help ? h('span', { class: 'help', text: help }) : null,
      h('span', { class: 'field-error', attrs: { role: 'alert' } }));
  }
  function setError(fieldEl, message) {
    fieldEl.classList.add('has-error');
    fieldEl.querySelector('.field-error').textContent = message;
    var c = fieldEl.querySelector('input,select');
    if (c) { c.setAttribute('aria-invalid', 'true'); c.focus(); }
  }
  function clearErrors(root) {
    root.querySelectorAll('.field.has-error').forEach(function (f) {
      f.classList.remove('has-error');
      f.querySelector('.field-error').textContent = '';
      var c = f.querySelector('input,select');
      if (c) c.removeAttribute('aria-invalid');
    });
  }
  function banner(kind, text) { return h('div', { class: 'banner ' + kind, attrs: { role: kind === 'error' || kind === 'warning' ? 'alert' : 'status' }, text: text }); }
  function stat(label, value, sub, tone) {
    return h('div', { class: 'stat' + (tone ? ' ' + tone : '') },
      h('span', { class: 'stat-label', text: label }), h('strong', { class: 'stat-value', text: value }),
      sub ? h('span', { class: 'stat-sub', text: sub }) : null);
  }
  function emptyState(title, text) {
    return h('div', { class: 'empty-state' }, h('strong', { text: title }), text ? h('span', { text: text }) : null);
  }
  /** Wraps a table for horizontal scroll and copies each header into its cells' data-label,
   *  which the phone layout uses to show every row as a labelled card (see 02_wedding.css). */
  function tableWrap(table) {
    var heads = Array.prototype.map.call(table.querySelectorAll('thead th'), function (th) { return th.textContent; });
    table.querySelectorAll('tbody tr').forEach(function (tr) {
      Array.prototype.forEach.call(tr.children, function (td, i) { if (heads[i]) td.setAttribute('data-label', heads[i]); });
    });
    return h('div', { class: 'table-scroll' }, table);
  }

  /** Native <dialog> confirm. Resolves true on confirm. */
  function confirmDialog(title, message, confirmLabel) {
    return new Promise(function (resolve) {
      var done = false;
      var dlg = h('dialog', { class: 'modal' });
      function finish(v) { done = true; resolve(v); if (dlg.open) dlg.close(); }
      dlg.appendChild(h('div', { class: 'modal-header', text: title }));
      dlg.appendChild(h('div', { class: 'modal-body', text: message }));
      dlg.appendChild(h('div', { class: 'modal-footer' },
        h('button', { type: 'button', class: 'ghost', text: 'Cancel', on: { click: function () { finish(false); } } }),
        h('button', { type: 'button', class: 'danger', text: confirmLabel || 'Confirm', on: { click: function () { finish(true); } } })));
      dlg.addEventListener('close', function () { dlg.remove(); if (!done) resolve(false); });
      document.body.appendChild(dlg);
      dlg.showModal();
    });
  }

  /** Prints just `title` + a copy of `node` (nothing else on the page). */
  function printSheet(title, node) {
    var old = document.getElementById('print-area');
    if (old) old.remove();
    var area = h('div', { id: 'print-area' }, h('h1', { text: title }), node.cloneNode(true));
    document.body.appendChild(area);
    document.body.classList.add('printing');
    var cleaned = false;
    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      document.body.classList.remove('printing');
      area.remove();
    }
    window.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(cleanup, 60000);
    window.print();
  }

  App.core = {
    h: h, fmt: fmt, parseMoney: parseMoney, inputMoney: inputMoney,
    parseISO: parseISO, today: today, daysUntil: daysUntil, fmtDate: fmtDate,
    uid: uid, iso: iso, addDays: addDays, addMonths: addMonths, monthKey: monthKey, monthLabel: monthLabel,
    parseCSV: parseCSV, toCSV: toCSV, download: download,
    field: field, setError: setError, clearErrors: clearErrors, banner: banner, stat: stat,
    emptyState: emptyState, tableWrap: tableWrap, confirmDialog: confirmDialog, printSheet: printSheet,
  };
})(window);
