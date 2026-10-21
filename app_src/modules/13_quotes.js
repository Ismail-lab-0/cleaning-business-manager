/* Quotes: a price from home size, bedrooms, bathrooms, clean type and how often, using
 * the hourly rate from Settings. The working is shown so the price can be explained to a
 * client. A quote can become a job or an invoice for a chosen client. */
(function (g) {
  var App = g.App = g.App || { views: {}, nav: [] };
  var C = App.core, D = App.data, h = C.h;
  var last = { size: 0, type: 0, freq: 0, beds: '2', baths: '1' };

  function opt(sel, list, selected) {
    list.forEach(function (x, i) { sel.appendChild(h('option', { value: String(i), text: x[0], selected: i === selected })); });
  }

  App.views.quotes = {
    navLabel: 'Quotes',
    render: function (root) {
      root.dataset.activeView = 'quotes';
      root.innerHTML = '';
      var rate = D.business().rate, clients = D.list('clients');
      root.appendChild(h('h1', { text: 'Quotes' }));
      root.appendChild(h('p', { class: 'sub', text: 'Know what to charge in seconds. The price comes from your own hourly rate, and the working is shown.' }));
      if (!rate) root.appendChild(C.banner('warning', 'Set your hourly rate on the Dashboard or in Settings to get a price.'));

      var size = h('select', { id: 'quoteSize' }), type = h('select', { id: 'quoteType' }), freq = h('select', { id: 'quoteFreq' });
      opt(size, D.SIZES, last.size); opt(type, D.TYPES, last.type); opt(freq, D.FREQS, last.freq);
      var beds = h('input', { type: 'number', id: 'quoteBeds', value: last.beds, attrs: { min: '0', max: '12' } });
      var baths = h('input', { type: 'number', id: 'quoteBaths', value: last.baths, attrs: { min: '0', max: '12', step: '0.5' } });
      var out = h('div', { class: 'quote-out', attrs: { 'aria-live': 'polite' } });
      var client = h('select', { id: 'quoteClient' });
      client.appendChild(h('option', { value: '', text: clients.length ? 'Choose a client' : 'Add a client first' }));
      clients.slice().sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; }).forEach(function (c) { client.appendChild(h('option', { value: c.id, text: c.name })); });
      var date = h('input', { type: 'date', id: 'quoteDate', value: C.iso(C.today()) });
      var fClient = C.field('quoteClient', 'Client', client), fDate = C.field('quoteDate', 'First visit', date);

      function current() {
        last = { size: +size.value, type: +type.value, freq: +freq.value, beds: beds.value, baths: baths.value };
        return D.quote({ size: last.size, type: last.type, freq: last.freq, beds: parseFloat(beds.value) || 0, baths: parseFloat(baths.value) || 0 }, rate);
      }
      function paint() {
        var q = current();
        out.innerHTML = '';
        out.appendChild(h('div', { class: 'quote-price' }, h('span', { class: 'caption', text: 'Quote' }), h('strong', { id: 'quotePrice', text: rate ? C.fmt(q.price) : '—' }),
          h('span', { class: 'caption', text: q.repeat === 'none' ? 'one-off visit' : 'per visit, ' + D.FREQS[last.freq][0].toLowerCase() })));
        var rows = [
          ['Home', q.sizeLabel + ', ' + q.beds + ' bed, ' + q.baths + ' bath'],
          ['Clean type', q.typeLabel],
          ['Estimated time', q.hours + (q.hours === 1 ? ' hour' : ' hours')],
          ['Your rate', rate ? C.fmt(q.rate) + ' an hour' : 'not set'],
          ['Before repeat discount', rate ? C.fmt(q.gross) : '—'],
          ['Repeat discount', q.discountPct ? '−' + q.discountPct + '% (' + C.fmt(q.discount) + ')' : 'none'],
        ];
        out.appendChild(C.tableWrap(h('table', { class: 'table' }, h('tbody', null, rows.map(function (r) { return h('tr', null, h('th', { text: r[0] }), h('td', { text: r[1] })); })))));
        out.appendChild(h('p', { class: 'caption', text: 'Estimated time is a starting point: each bedroom adds 15 minutes, each bathroom 30, deep cleans take 1.6 times longer. Adjust the price on the job if the home needs more.' }));
      }
      [size, type, freq, beds, baths].forEach(function (el) { el.addEventListener('input', paint); el.addEventListener('change', paint); });

      var form = h('div', { class: 'card' }, h('h2', { text: 'Price a home' }),
        C.field('quoteSize', 'Home size', size), h('div', { class: 'grid-2' }, C.field('quoteBeds', 'Bedrooms', beds), C.field('quoteBaths', 'Bathrooms', baths)),
        C.field('quoteType', 'Type of clean', type), C.field('quoteFreq', 'How often', freq));
      var use = h('div', { class: 'card' }, h('h2', { text: 'Use this quote' }), fClient, fDate,
        h('div', { class: 'row wrap' },
          h('button', { type: 'button', id: 'quoteToJobBtn', text: 'Create job' }),
          h('button', { type: 'button', id: 'quoteToInvoiceBtn', class: 'ghost', text: 'Create invoice' })));
      function checks() {
        C.clearErrors(use);
        if (!rate) { C.setError(fClient, 'Set your hourly rate first.'); return null; }
        if (!client.value) { C.setError(fClient, 'Choose a client.'); return null; }
        if (!C.parseISO(date.value)) { C.setError(fDate, 'Pick a date.'); return null; }
        return current();
      }
      use.querySelector('#quoteToJobBtn').addEventListener('click', function () {
        var q = checks(); if (!q) return;
        var rep = q.repeat, dates = D.seriesDates(date.value, rep), series = dates.length > 1 ? C.uid() : null, all = D.list('jobs');
        dates.forEach(function (d) { all.push({ id: C.uid(), clientId: client.value, date: d, time: '', price: q.price, cleaner: '', status: 'scheduled', repeat: rep, seriesId: series, invoiceId: null }); });
        D.save('jobs', all);
        location.hash = '#jobs';
      });
      use.querySelector('#quoteToInvoiceBtn').addEventListener('click', function () {
        var q = checks(); if (!q) return;
        D.createInvoice({ clientId: client.value, amount: q.price, description: q.typeLabel + ' (' + q.hours + ' h)' });
        location.hash = '#invoices';
      });
      paint();
      root.appendChild(h('div', { class: 'split' }, h('div', { class: 'side' }, form, use), h('div', { class: 'main' }, h('div', { class: 'card' }, out))));
    },
  };
  App.nav.push('quotes');
})(window);
