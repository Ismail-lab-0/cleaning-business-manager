/* Inline-SVG chart for the Dashboard: income vs expenses for the last months. Reads real
 * app state only (App.data); no chart library, no sample numbers. Colours come from the
 * design tokens so both themes work. */
window.App = window.App || { views: {}, nav: [] };
App.charts = {
  /** rows: [{label, income, expenses}] in cents. Returns an <svg> element. */
  incomeExpenses: function (rows, fmt) {
    var NS = 'http://www.w3.org/2000/svg';
    var w = 560, h = 220, padL = 8, padB = 34, padT = 14, plotH = h - padB - padT;
    var max = 1;
    rows.forEach(function (r) { max = Math.max(max, r.income, r.expenses); });
    var groupW = (w - padL * 2) / rows.length, barW = Math.min(26, groupW / 2 - 6);
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.setAttribute('role', 'img');
    svg.setAttribute('class', 'chart');
    svg.setAttribute('aria-label', 'Income and expenses by month: ' + rows.map(function (r) {
      return r.label + ' income ' + fmt(r.income) + ', expenses ' + fmt(r.expenses);
    }).join('; '));
    function el(tag, attrs, text) {
      var e = document.createElementNS(NS, tag);
      Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
      if (text != null) e.textContent = text;
      svg.appendChild(e);
      return e;
    }
    el('line', { x1: padL, x2: w - padL, y1: h - padB, y2: h - padB, stroke: 'var(--color-border)', 'stroke-width': 1 });
    rows.forEach(function (r, i) {
      var cx = padL + groupW * i + groupW / 2;
      [['income', 'var(--color-accent)', -barW - 2], ['expenses', 'var(--color-muted)', 2]].forEach(function (s) {
        var v = r[s[0]], bh = v > 0 ? Math.max(3, Math.round(v / max * plotH)) : 0;
        if (bh) el('rect', { x: cx + s[2], y: h - padB - bh, width: barW, height: bh, rx: 3, fill: s[1] });
      });
      el('text', { x: cx, y: h - 14, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--color-ink)' }, r.label);
    });
    return svg;
  },

  /** segments: [{label, value, color}], center: {num, label}. Returns {svg, legend} elements. */
  donut: function (segments, center, fmt) {
    var NS = 'http://www.w3.org/2000/svg', total = 0;
    segments.forEach(function (s) { total += s.value; });
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 42 42'); svg.setAttribute('role', 'img'); svg.setAttribute('class', 'donut');
    svg.setAttribute('aria-label', 'Invoiced money by status: ' + segments.map(function (s) { return s.label + ' ' + fmt(s.value); }).join(', '));
    function el(tag, attrs, text) {
      var e = document.createElementNS(NS, tag);
      Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
      if (text != null) e.textContent = text;
      svg.appendChild(e);
      return e;
    }
    el('circle', { cx: 21, cy: 21, r: 15.9155, fill: 'none', stroke: 'var(--color-border)', 'stroke-width': 5 });
    var offset = 25;                       // start at 12 o'clock
    if (total > 0) segments.forEach(function (s) {
      if (s.value <= 0) return;
      var pct = s.value / total * 100;
      el('circle', { cx: 21, cy: 21, r: 15.9155, fill: 'none', stroke: s.color, 'stroke-width': 5, 'stroke-dasharray': pct + ' ' + (100 - pct), 'stroke-dashoffset': offset });
      offset -= pct;
    });
    el('text', { x: 21, y: 22.5, 'text-anchor': 'middle', class: 'center-num' }, center.num);
    el('text', { x: 21, y: 27.5, 'text-anchor': 'middle', class: 'center-lab' }, center.label);
    var ul = document.createElement('ul'); ul.className = 'donut-legend';
    segments.forEach(function (s) {
      var li = document.createElement('li'), l = document.createElement('span'), sw = document.createElement('span'), v = document.createElement('strong');
      sw.className = 'swatch'; sw.style.background = s.color;
      l.appendChild(sw); l.appendChild(document.createTextNode(s.label)); v.textContent = fmt(s.value);
      li.appendChild(l); li.appendChild(v); ul.appendChild(li);
    });
    return { svg: svg, legend: ul };
  },
  /** rows: [{label, value}] as horizontal bars, scaled to the largest. */
  hbars: function (rows, fmt) {
    var max = 1, ul = document.createElement('ul'); ul.className = 'hbars';
    rows.forEach(function (r) { max = Math.max(max, r.value); });
    rows.forEach(function (r) {
      var li = document.createElement('li'), head = document.createElement('div'), a = document.createElement('span'), b = document.createElement('strong');
      head.className = 'hb-head'; a.textContent = r.label; b.textContent = fmt(r.value); head.appendChild(a); head.appendChild(b);
      var track = document.createElement('div'), fill = document.createElement('span');
      track.className = 'hb-track'; track.setAttribute('role', 'img'); track.setAttribute('aria-label', r.label + ': ' + fmt(r.value));
      fill.className = 'hb-fill'; fill.style.width = Math.max(3, Math.round(r.value / max * 100)) + '%'; track.appendChild(fill);
      li.appendChild(head); li.appendChild(track); ul.appendChild(li);
    });
    return ul;
  },
  /** rows: [{label, value}] as vertical columns; returns an <svg>. */
  columns: function (rows, ariaLabel) {
    var NS = 'http://www.w3.org/2000/svg', w = 560, h = 200, padB = 30, padT = 24, plotH = h - padB - padT, max = 1;
    rows.forEach(function (r) { max = Math.max(max, r.value); });
    var gw = w / rows.length, bw = Math.min(46, gw - 16);
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h); svg.setAttribute('role', 'img'); svg.setAttribute('class', 'chart'); svg.setAttribute('aria-label', ariaLabel);
    function el(tag, attrs, text) {
      var e = document.createElementNS(NS, tag);
      Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
      if (text != null) e.textContent = text;
      svg.appendChild(e);
    }
    el('line', { x1: 0, x2: w, y1: h - padB, y2: h - padB, stroke: 'var(--color-border)', 'stroke-width': 1 });
    rows.forEach(function (r, i) {
      var cx = gw * i + gw / 2, bh = r.value > 0 ? Math.max(4, Math.round(r.value / max * plotH)) : 0;
      if (bh) el('rect', { x: cx - bw / 2, y: h - padB - bh, width: bw, height: bh, rx: 4, fill: 'var(--color-accent)' });
      el('text', { x: cx, y: h - padB - bh - 6, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, fill: 'var(--color-ink)' }, String(r.value));
      el('text', { x: cx, y: h - 10, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--color-muted)' }, r.label);
    });
    return svg;
  },
};
