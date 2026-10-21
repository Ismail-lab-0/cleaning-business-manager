/* Expenses: log what the business spends, see monthly income, expenses and profit,
 * export to CSV for an accountant. */
(function (g) {
  var App = g.App = g.App || { views: {}, nav: [] };
  var C = App.core, D = App.data, h = C.h;

  App.views.expenses = {
    navLabel: 'Expenses',
    render: function (root) {
      root.dataset.activeView = 'expenses';
      root.innerHTML = '';
      var exps = D.list('expenses');
      root.appendChild(h('h1', { text: 'Expenses' }));
      root.appendChild(h('p', { class: 'sub', text: 'Log what you spend. Together with the payments you record on invoices, this gives your profit each month.' }));

      var nowKey = C.iso(C.today()).slice(0, 7), thisMonth = D.monthExpenses(nowKey), cats6 = D.expenseByCategory(6);
      var sum6 = cats6.reduce(function (s, r) { return s + r.value; }, 0);
      root.appendChild(h('div', { class: 'stat-grid hero' },
        C.stat('Spent this month', C.fmt(thisMonth), 'expenses logged', 'big'),
        C.stat('Last 6 months', C.fmt(sum6), 'all categories', 'big'),
        C.stat('Biggest cost', cats6.length ? cats6[0].label : '—', cats6.length ? C.fmt(cats6[0].value) + ' in 6 months' : 'Nothing logged yet', 'big')));

      var date = h('input', { type: 'date', id: 'expDate', value: C.iso(C.today()) });
      var cat = h('select', { id: 'expCategory' }, D.EXPENSE_CATEGORIES.map(function (c) { return h('option', { value: c, text: c }); }));
      var desc = h('input', { type: 'text', id: 'expDesc', attrs: { maxlength: '120' } });
      var amount = h('input', { type: 'text', id: 'expAmount', attrs: { inputmode: 'decimal' } });
      var fDate = C.field('expDate', 'Date', date), fAmount = C.field('expAmount', 'Amount', amount);
      var form = h('div', { class: 'card' }, h('h2', { text: 'Add an expense' }), h('div', { class: 'grid-2' }, fDate, C.field('expCategory', 'Category', cat)),
        C.field('expDesc', 'What was it for', desc, 'Optional'), fAmount, h('button', { type: 'button', id: 'addExpenseBtn', text: 'Add expense' }));
      form.querySelector('#addExpenseBtn').addEventListener('click', function () {
        C.clearErrors(form);
        var a = C.parseMoney(amount.value);
        if (!C.parseISO(date.value)) return C.setError(fDate, 'Pick a date.');
        if (a == null || a <= 0) return C.setError(fAmount, 'Enter the amount as a number above zero.');
        var all = D.list('expenses');
        all.push({ id: C.uid(), date: date.value, category: cat.value, description: desc.value.trim(), amount: a });
        D.save('expenses', all);
        App.views.expenses.render(root);
      });

      var byCat = h('div', { class: 'card' }, h('h2', { text: 'By category, last 6 months' }));
      if (!cats6.length) byCat.appendChild(C.emptyState('No expenses yet', 'Add one on the left to see where the money goes.'));
      else byCat.appendChild(App.charts.hbars(cats6, C.fmt));

      var months = h('div', { class: 'card' }, h('h2', { text: 'Month by month' }));
      var mbody = h('tbody');
      D.lastMonths(6).slice().reverse().forEach(function (k) {
        var s = D.monthSummary(k);
        mbody.appendChild(h('tr', null, h('td', { text: C.monthLabel(k) }), h('td', { text: C.fmt(s.income) }), h('td', { text: C.fmt(s.expenses) }), h('td', { class: s.profit < 0 ? 'neg' : '', text: C.fmt(s.profit) })));
      });
      months.appendChild(C.tableWrap(h('table', { class: 'table cardrows' }, h('thead', null, h('tr', null, ['Month', 'Income', 'Expenses', 'Profit'].map(function (x) { return h('th', { text: x }); }))), mbody)));

      var list = h('div', { class: 'card' }, h('h2', { text: 'All expenses' }));
      if (!exps.length) list.appendChild(C.emptyState('No expenses yet', 'Add one on the left.'));
      else {
        var tbody = h('tbody');
        exps.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }).forEach(function (e) {
          tbody.appendChild(h('tr', null, h('td', { class: 'nowrap', text: C.fmtDate(C.parseISO(e.date)) }), h('td', { text: e.category }), h('td', { text: e.description || '—' }), h('td', { text: C.fmt(e.amount) }),
            h('td', null, h('button', { type: 'button', class: 'ghost small', text: 'Delete', attrs: { 'aria-label': 'Delete expense ' + (e.description || e.category) }, on: { click: function () {
              D.save('expenses', D.list('expenses').filter(function (x) { return x.id !== e.id; }));
              App.views.expenses.render(root);
            } } }))));
        });
        list.appendChild(h('button', { type: 'button', id: 'exportExpensesBtn', class: 'ghost', text: 'Export CSV', on: { click: function () {
          var rows = [['Date', 'Category', 'Description', 'Amount']];
          D.list('expenses').forEach(function (e) { rows.push([e.date, e.category, e.description, (e.amount / 100).toFixed(2)]); });
          C.download('expenses.csv', C.toCSV(rows));
        } } }));
        list.appendChild(C.tableWrap(h('table', { class: 'table cardrows' }, h('thead', null, h('tr', null, ['Date', 'Category', 'Description', 'Amount', ''].map(function (x) { return h('th', { text: x }); }))), tbody)));
      }
      root.appendChild(h('div', { class: 'split late' }, h('div', { class: 'side' }, form), h('div', { class: 'main' }, byCat, months, list)));
    },
  };
  App.nav.push('expenses');
})(window);
