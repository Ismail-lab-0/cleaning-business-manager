/* Jobs: one-off and repeating visits in date order, optionally assigned to a cleaner.
 * A repeating job creates its next visits for you (see App.data.seriesDates). */
(function (g) {
  var App = g.App = g.App || { views: {}, nav: [] };
  var C = App.core, D = App.data, h = C.h;
  var viewMode = 'upcoming', cleanerFilter = '';

  function cleaners() { return App.store.get('cleaners', []); }

  App.views.jobs = {
    navLabel: 'Jobs',
    render: function (root) {
      root.dataset.activeView = 'jobs';
      root.innerHTML = '';
      var clients = D.list('clients'), todayIso = C.iso(C.today());
      root.appendChild(h('h1', { text: 'Jobs' }));
      root.appendChild(h('p', { class: 'sub', text: 'Book one-off or repeating cleans. Repeating jobs create the next visits for you.' }));

      var client = h('select', { id: 'jobClient' });
      client.appendChild(h('option', { value: '', text: clients.length ? 'Choose a client' : 'Add a client first' }));
      clients.slice().sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; })
        .forEach(function (c) { client.appendChild(h('option', { value: c.id, text: c.name })); });
      var date = h('input', { type: 'date', id: 'jobDate', value: todayIso });
      var time = h('input', { type: 'time', id: 'jobTime' });
      var price = h('input', { type: 'text', id: 'jobPrice', attrs: { inputmode: 'decimal' } });
      var repeat = h('select', { id: 'jobRepeat' });
      D.FREQS.forEach(function (f) { repeat.appendChild(h('option', { value: f[2], text: f[2] === 'none' ? 'Does not repeat' : f[0] })); });
      var cleaner = h('select', { id: 'jobCleaner' });
      cleaner.appendChild(h('option', { value: '', text: 'Unassigned' }));
      cleaners().forEach(function (n) { cleaner.appendChild(h('option', { value: n, text: n })); });
      client.addEventListener('change', function () {
        var c = D.client(client.value);
        if (c) { if (c.price) price.value = C.inputMoney(c.price); repeat.value = c.freq || 'none'; }
      });
      var fClient = C.field('jobClient', 'Client', client), fDate = C.field('jobDate', 'Date', date), fPrice = C.field('jobPrice', 'Price', price, 'Starts from the client\'s usual price.');
      var form = h('div', { class: 'card' }, h('h2', { text: 'Add a job' }), fClient,
        h('div', { class: 'grid-2' }, fDate, C.field('jobTime', 'Time', time)),
        h('div', { class: 'grid-2' }, fPrice, C.field('jobRepeat', 'Repeats', repeat)),
        C.field('jobCleaner', 'Cleaner', cleaner, cleaners().length ? '' : 'Add your cleaners in Settings.'),
        h('button', { type: 'button', id: 'addJobBtn', text: 'Add job' }));
      form.querySelector('#addJobBtn').addEventListener('click', function () {
        C.clearErrors(form);
        if (!client.value) return C.setError(fClient, 'Choose a client.');
        if (!C.parseISO(date.value)) return C.setError(fDate, 'Pick a date.');
        var p = price.value.trim() === '' ? 0 : C.parseMoney(price.value);
        if (p == null || p < 0) return C.setError(fPrice, 'Enter the price as a number.');
        var dates = D.seriesDates(date.value, repeat.value), series = dates.length > 1 ? C.uid() : null, all = D.list('jobs');
        dates.forEach(function (d) {
          all.push({ id: C.uid(), clientId: client.value, date: d, time: time.value, price: p, cleaner: cleaner.value, status: 'scheduled', repeat: repeat.value, seriesId: series, invoiceId: null });
        });
        D.save('jobs', all);
        App.views.jobs.render(root);
      });

      var all = D.sortedJobs().filter(function (j) { return !cleanerFilter || j.cleaner === cleanerFilter; });
      var shown = all.filter(function (j) {
        if (viewMode === 'upcoming') return j.status === 'scheduled' && j.date >= todayIso;
        if (viewMode === 'past') return j.status !== 'scheduled' || j.date < todayIso;
        return true;
      });
      if (viewMode === 'past') shown.reverse();
      var late = D.list('jobs').filter(function (j) { return j.status === 'scheduled' && j.date < todayIso; }).length;

      var mode = h('select', { id: 'jobView', attrs: { 'aria-label': 'Which jobs to show' } },
        [['upcoming', 'Upcoming'], ['past', 'Past and finished'], ['all', 'All jobs']].map(function (o) { return h('option', { value: o[0], text: o[1], selected: viewMode === o[0] }); }));
      mode.addEventListener('change', function () { viewMode = mode.value; App.views.jobs.render(root); });
      var filter = h('select', { id: 'jobFilterCleaner', attrs: { 'aria-label': 'Filter by cleaner' } },
        [h('option', { value: '', text: 'All cleaners' })].concat(cleaners().map(function (n) { return h('option', { value: n, text: n, selected: cleanerFilter === n }); })));
      filter.addEventListener('change', function () { cleanerFilter = filter.value; App.views.jobs.render(root); });

      var card = h('div', { class: 'card' }, h('h2', { text: 'Schedule' }), h('div', { class: 'grid-2' }, mode, filter));
      if (late && viewMode === 'upcoming') card.appendChild(C.banner('info', late + (late === 1 ? ' past job is' : ' past jobs are') + ' still marked as scheduled. Open "Past and finished" to mark them done or cancelled.'));
      if (!shown.length) card.appendChild(C.emptyState('No jobs here', viewMode === 'upcoming' ? 'Add a job on the left and it appears in date order.' : 'Nothing to show for this filter.'));
      else {
        var tbody = h('tbody');
        shown.forEach(function (j) {
          var acts = h('span', { class: 'row wrap' });
          if (j.status === 'scheduled') {
            acts.appendChild(h('button', { type: 'button', class: 'ghost small', text: 'Done', attrs: { 'aria-label': 'Mark job for ' + D.clientName(j.clientId) + ' done' }, on: { click: function () {
              var list = D.list('jobs'); list.forEach(function (x) { if (x.id === j.id) x.status = 'done'; }); D.save('jobs', list); App.views.jobs.render(root);
            } } }));
            acts.appendChild(h('button', { type: 'button', class: 'ghost small', text: 'Cancel', attrs: { 'aria-label': 'Cancel job for ' + D.clientName(j.clientId) }, on: { click: function () {
              var list = D.list('jobs'); list.forEach(function (x) { if (x.id === j.id) x.status = 'cancelled'; }); D.save('jobs', list); App.views.jobs.render(root);
            } } }));
          }
          if (j.status !== 'cancelled') {
            if (j.invoiceId && D.list('invoices').some(function (i) { return i.id === j.invoiceId; })) acts.appendChild(h('span', { class: 'badge ok', text: 'Invoiced' }));
            else acts.appendChild(h('button', { type: 'button', class: 'ghost small', text: 'Invoice', attrs: { 'aria-label': 'Create an invoice for the job for ' + D.clientName(j.clientId) }, on: { click: function () {
              var inv = D.createInvoice({ clientId: j.clientId, amount: j.price || 0, jobId: j.id, description: 'Cleaning on ' + C.fmtDate(C.parseISO(j.date)) });
              var list = D.list('jobs'); list.forEach(function (x) { if (x.id === j.id) x.invoiceId = inv.id; }); D.save('jobs', list);
              location.hash = '#invoices';
            } } }));
          }
          acts.appendChild(h('button', { type: 'button', class: 'ghost small', text: 'Remove', attrs: { 'aria-label': 'Remove job for ' + D.clientName(j.clientId) }, on: { click: function () {
            var ahead = j.seriesId ? D.list('jobs').filter(function (x) { return x.seriesId === j.seriesId && x.date >= j.date && x.status === 'scheduled'; }).length : 0;
            C.confirmDialog('Remove this job?', ahead > 1 ? 'This is one of a repeating series. Only this visit is removed.' : 'This removes the job from your schedule.', 'Remove').then(function (ok) {
              if (!ok) return;
              D.save('jobs', D.list('jobs').filter(function (x) { return x.id !== j.id; }));
              App.views.jobs.render(root);
            });
          } } }));
          if (j.seriesId && j.status === 'scheduled') {
            acts.appendChild(h('button', { type: 'button', class: 'ghost small', text: 'End series', attrs: { 'aria-label': 'End the repeating series for ' + D.clientName(j.clientId) + ' from this visit' }, on: { click: function () {
              C.confirmDialog('End this series?', 'Removes this visit and every later scheduled visit in the repeating series. Visits already done are kept.', 'End series').then(function (ok) {
                if (!ok) return;
                D.save('jobs', D.list('jobs').filter(function (x) { return !(x.seriesId === j.seriesId && x.date >= j.date && x.status === 'scheduled'); }));
                App.views.jobs.render(root);
              });
            } } }));
          }
          tbody.appendChild(h('tr', { class: j.status === 'cancelled' ? 'row-muted' : '' },
            h('td', { class: 'nowrap', text: C.fmtDate(C.parseISO(j.date)) }), h('td', { text: j.time || '—' }), h('td', { text: D.clientName(j.clientId) }),
            h('td', { text: j.cleaner || '—' }), h('td', { text: j.price ? C.fmt(j.price) : '—' }),
            h('td', null, h('span', { class: 'badge' + (j.status === 'done' ? ' ok' : ''), text: j.status === 'scheduled' ? (j.repeat && j.repeat !== 'none' ? 'Repeating' : 'Scheduled') : j.status === 'done' ? 'Done' : 'Cancelled' })), h('td', null, acts)));
        });
        card.appendChild(C.tableWrap(h('table', { class: 'table cardrows' },
          h('thead', null, h('tr', null, ['Date', 'Time', 'Client', 'Cleaner', 'Price', 'Status', ''].map(function (x) { return h('th', { text: x }); }))), tbody)));
      }
      root.appendChild(h('div', { class: 'split late listfirst' }, h('div', { class: 'side' }, form), h('div', { class: 'main' }, card)));
    },
  };
  App.nav.push('jobs');
})(window);
