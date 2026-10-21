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
};
