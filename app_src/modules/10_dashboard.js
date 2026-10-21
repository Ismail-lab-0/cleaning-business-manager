/* Dashboard: first-launch guided setup, then today's jobs, who owes you, and the month's
 * income / expenses / profit. */
(function (g) {
  var App = g.App = g.App || { views: {}, nav: [] };
  var C = App.core, D = App.data, h = C.h;

  function renderSetup(root) {
    var name = h('input', { type: 'text', id: 'setupName', attrs: { maxlength: '80', autocomplete: 'organization', placeholder: 'e.g. Sparkle Home Cleaning' } });
    var rate = h('input', { type: 'text', id: 'setupRate', attrs: { inputmode: 'decimal', placeholder: 'e.g. 35' } });
    var cur = h('select', { id: 'setupCurrency', attrs: { 'aria-label': 'Currency' } });
    D.CURRENCIES.forEach(function (c) { cur.appendChild(h('option', { value: c, text: c, selected: c === App.store.get('currency', 'USD') })); });
    var fName = C.field('setupName', 'Business name', name, 'Shown on your invoices.');
    var fRate = C.field('setupRate', 'Your hourly rate', rate, 'What you charge for an hour of cleaning. The price calculator on the Quotes view starts from this; you can change it any time in Settings.');
    var fCur = C.field('setupCurrency', 'Currency', cur);
    var form = h('div', { class: 'card' },
      h('h2', { text: 'Set up in two minutes' }),
      h('p', { class: 'sub', text: 'Three answers and you are ready to add your first client. Everything stays on this device.' }),
      fName, fRate, fCur,
      h('div', { class: 'row' },
        h('button', { type: 'button', id: 'setupBtn', text: 'Start my business' }),
        h('button', { type: 'button', id: 'skipSetupBtn', class: 'ghost', text: 'Skip for now' })));
    root.appendChild(form);

    form.querySelector('#setupBtn').addEventListener('click', function () {
      C.clearErrors(form);
      var nm = name.value.trim(), r = C.parseMoney(rate.value);
      if (!nm) return C.setError(fName, 'Enter your business name.');
      if (r == null || r <= 0) return C.setError(fRate, 'Enter your hourly rate as a number above zero.');
      App.store.set('currency', cur.value);
      D.saveBusiness({ setupDone: true, name: nm, rate: r });
      App.views.dashboard.render(root);
    });
    form.querySelector('#skipSetupBtn').addEventListener('click', function () {
      D.saveBusiness({ setupDone: true, name: '', rate: 0 });
      App.views.dashboard.render(root);
    });
  }

  function jobRow(j) {
    return h('li', null,
      h('span', { class: 'job-line' }, h('strong', { text: D.clientName(j.clientId) }), h('span', { class: 'caption', text: [j.time, j.cleaner].filter(Boolean).join(' · ') })),
      h('span', { class: 'badge' + (j.status === 'done' ? ' ok' : ''), text: j.status === 'done' ? 'Done' : C.fmt(j.price || 0) }));
  }

  function renderDash(root) {
    var b = D.business(), owed = D.owedTotals(), nowKey = C.iso(C.today()).slice(0, 7), month = D.monthSummary(nowKey);
    var todayJobs = D.jobsOn(C.iso(C.today()));
    root.appendChild(h('p', { class: 'sub', text: b.name ? b.name + ' at a glance.' : 'Your business at a glance.' }));

    if (owed.overdueCount) root.appendChild(C.banner('warning', owed.overdueCount + (owed.overdueCount === 1 ? ' invoice is' : ' invoices are') + ' overdue: ' + C.fmt(owed.overdue) + ' to collect.'));
    if (!D.list('clients').length) {
      root.appendChild(h('div', { class: 'banner info', attrs: { role: 'status' } },
        'Next step: add your first client. ',
        h('button', { type: 'button', id: 'goClientsBtn', class: 'ghost small', text: 'Add a client', on: { click: function () { location.hash = '#clients'; } } })));
    }

    root.appendChild(h('div', { class: 'stat-grid' },
      C.stat('Jobs today', String(todayJobs.length), todayJobs.length ? 'on your schedule' : 'nothing booked today'),
      C.stat('Owed to you', C.fmt(owed.due), owed.due ? 'unpaid invoices, all clients' : 'nothing outstanding', owed.overdue ? 'bad' : ''),
      C.stat('Income this month', C.fmt(month.income), 'payments received'),
      C.stat('Expenses this month', C.fmt(month.expenses)),
      C.stat('Profit this month', C.fmt(month.profit), 'income minus expenses', month.profit < 0 ? 'bad' : '')));

    var today = h('div', { class: 'card' }, h('h2', { text: 'Today' }));
    if (!todayJobs.length) today.appendChild(C.emptyState('No jobs today', 'Add jobs in the Jobs view and they appear here on the day.'));
    else today.appendChild(h('ul', null, todayJobs.map(jobRow)));

    var owes = D.owedByClient(), card = h('div', { class: 'card' }, h('h2', { text: 'Who owes you' }));
    if (!owes.length) card.appendChild(C.emptyState('Nobody owes you money', 'Unpaid invoices are listed here by client.'));
    else {
      var tbody = h('tbody');
      owes.slice(0, 8).forEach(function (r) {
        tbody.appendChild(h('tr', null, h('td', { text: D.clientName(r.clientId) }), h('td', { text: String(r.count) }),
          h('td', { class: r.overdue ? 'neg' : '', text: C.fmt(r.due) + (r.overdue ? ' (' + C.fmt(r.overdue) + ' overdue)' : '') })));
      });
      card.appendChild(C.tableWrap(h('table', { class: 'table cardrows' },
        h('thead', null, h('tr', null, ['Client', 'Invoices', 'Owes'].map(function (x) { return h('th', { text: x }); }))), tbody)));
    }
    root.appendChild(h('div', { class: 'grid-2 top' }, today, card));

    var rows = D.lastMonths(6).map(function (k) { var s = D.monthSummary(k); return { label: C.monthLabel(k), income: s.income, expenses: s.expenses }; });
    var chart = h('div', { class: 'card' }, h('h2', { text: 'Income and expenses, last 6 months' }),
      h('div', { class: 'legend' }, h('span', { class: 'key inc', text: 'Income' }), h('span', { class: 'key exp', text: 'Expenses' })));
    chart.appendChild(App.charts.incomeExpenses(rows, C.fmt));
    root.appendChild(chart);
  }

  App.views.dashboard = {
    navLabel: 'Dashboard',
    render: function (root) {
      root.dataset.activeView = 'dashboard';
      root.innerHTML = '';
      root.appendChild(h('h1', { text: 'Dashboard' }));
      if (D.business().setupDone) renderDash(root); else renderSetup(root);
    },
  };
  App.nav.push('dashboard');
})(window);
