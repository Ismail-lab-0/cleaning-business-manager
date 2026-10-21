/* Invoices: create from a job or a quote (or by hand), record payments, see what is
 * overdue, print a clean copy, export to CSV. Totals come from the recorded payments. */
(function (g) {
  var App = g.App = g.App || { views: {}, nav: [] };
  var C = App.core, D = App.data, h = C.h;
  var statusFilter = 'all';
  var LABEL = { paid: 'Paid', overdue: 'Overdue', 'part-paid': 'Part paid', unpaid: 'Unpaid' };

  function printInvoice(inv) {
    var b = D.business(), c = D.client(inv.clientId) || { name: '(removed client)', address: '' };
    var rows = [['Invoice', inv.number], ['Date', C.fmtDate(C.parseISO(inv.date))], ['Due', inv.due ? C.fmtDate(C.parseISO(inv.due)) : '—'], ['Bill to', c.name + (c.address ? ', ' + c.address : '')]];
    var meta = h('table', { class: 'table' }, h('tbody', null, rows.map(function (r) { return h('tr', null, h('th', { text: r[0] }), h('td', { text: r[1] })); })));
    var lines = h('table', { class: 'table' }, h('thead', null, h('tr', null, h('th', { text: 'Description' }), h('th', { text: 'Amount' }))),
      h('tbody', null, h('tr', null, h('td', { text: inv.description }), h('td', { text: C.fmt(inv.amount) })),
        h('tr', null, h('td', { text: 'Paid so far' }), h('td', { text: C.fmt(D.invoicePaid(inv)) })),
        h('tr', { class: 'total-row' }, h('td', { text: 'Balance due' }), h('td', { text: C.fmt(D.invoiceDue(inv)) }))));
    C.printSheet(b.name || 'Invoice', h('div', null, meta, lines));
  }

  App.views.invoices = {
    navLabel: 'Invoices',
    render: function (root) {
      root.dataset.activeView = 'invoices';
      root.innerHTML = '';
      var clients = D.list('clients'), invoices = D.list('invoices'), t = D.owedTotals();
      root.appendChild(h('h1', { text: 'Invoices' }));
      root.appendChild(h('p', { class: 'sub', text: 'Bill a client, record each payment, and see who still owes you.' }));
      if (t.overdueCount) root.appendChild(C.banner('warning', t.overdueCount + (t.overdueCount === 1 ? ' invoice is' : ' invoices are') + ' overdue: ' + C.fmt(t.overdue) + '.'));
      root.appendChild(h('div', { class: 'stat-grid' }, C.stat('Total owed', C.fmt(t.due), 'across all unpaid invoices', t.overdue ? 'bad' : ''), C.stat('Overdue', C.fmt(t.overdue), t.overdueCount + ' invoice(s)', t.overdue ? 'bad' : ''),
        C.stat('Invoiced', String(invoices.length), 'invoices in total')));

      var client = h('select', { id: 'invClient' });
      client.appendChild(h('option', { value: '', text: clients.length ? 'Choose a client' : 'Add a client first' }));
      clients.slice().sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; }).forEach(function (c) { client.appendChild(h('option', { value: c.id, text: c.name })); });
      var desc = h('input', { type: 'text', id: 'invDesc', value: 'Cleaning', attrs: { maxlength: '120' } });
      var amount = h('input', { type: 'text', id: 'invAmount', attrs: { inputmode: 'decimal' } });
      var date = h('input', { type: 'date', id: 'invDate', value: C.iso(C.today()) });
      client.addEventListener('change', function () { var c = D.client(client.value); if (c && c.price && !amount.value) amount.value = C.inputMoney(c.price); });
      var fClient = C.field('invClient', 'Client', client), fAmount = C.field('invAmount', 'Amount', amount), fDate = C.field('invDate', 'Invoice date', date, 'Due ' + D.terms() + ' days later (change in Settings).');
      var form = h('div', { class: 'card' }, h('h2', { text: 'New invoice' }), fClient, C.field('invDesc', 'Description', desc), h('div', { class: 'grid-2' }, fAmount, fDate),
        h('button', { type: 'button', id: 'addInvoiceBtn', text: 'Create invoice' }));
      form.querySelector('#addInvoiceBtn').addEventListener('click', function () {
        C.clearErrors(form);
        var a = C.parseMoney(amount.value);
        if (!client.value) return C.setError(fClient, 'Choose a client.');
        if (a == null || a <= 0) return C.setError(fAmount, 'Enter the amount as a number above zero.');
        if (!C.parseISO(date.value)) return C.setError(fDate, 'Pick a date.');
        D.createInvoice({ clientId: client.value, amount: a, description: desc.value.trim() || 'Cleaning', date: date.value });
        App.views.invoices.render(root);
      });

      var filter = h('select', { id: 'invFilter', attrs: { 'aria-label': 'Filter invoices' } },
        [['all', 'All invoices'], ['unpaid', 'Needs payment'], ['overdue', 'Overdue'], ['paid', 'Paid']].map(function (o) { return h('option', { value: o[0], text: o[1], selected: statusFilter === o[0] }); }));
      filter.addEventListener('change', function () { statusFilter = filter.value; App.views.invoices.render(root); });
      var shown = invoices.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : a.number < b.number ? 1 : -1; }).filter(function (inv) {
        var s = D.invoiceStatus(inv);
        return statusFilter === 'all' || (statusFilter === 'unpaid' ? s !== 'paid' : s === statusFilter);
      });
      var card = h('div', { class: 'card' }, h('h2', { text: 'Invoices' }),
        h('div', { class: 'row wrap' }, filter, invoices.length ? h('button', { type: 'button', id: 'exportInvoicesBtn', class: 'ghost', text: 'Export CSV', on: { click: function () {
          var rows = [['Invoice', 'Client', 'Date', 'Due', 'Description', 'Amount', 'Paid', 'Balance', 'Status']];
          D.list('invoices').forEach(function (i) { rows.push([i.number, D.clientName(i.clientId), i.date, i.due, i.description, (i.amount / 100).toFixed(2), (D.invoicePaid(i) / 100).toFixed(2), (D.invoiceDue(i) / 100).toFixed(2), LABEL[D.invoiceStatus(i)]]); });
          C.download('invoices.csv', C.toCSV(rows));
        } } }) : null));
      if (!shown.length) card.appendChild(C.emptyState(invoices.length ? 'No invoices match' : 'No invoices yet', invoices.length ? 'Try a different filter.' : 'Create one here, or press Invoice on a job.'));
      else {
        var tbody = h('tbody');
        shown.forEach(function (inv) {
          var s = D.invoiceStatus(inv), due = D.invoiceDue(inv);
          var acts = h('span', { class: 'row wrap' });
          if (due) {
            var pay = h('input', { type: 'text', class: 'cell-input', value: C.inputMoney(due), attrs: { inputmode: 'decimal', 'aria-label': 'Payment amount for ' + inv.number } });
            acts.appendChild(pay);
            acts.appendChild(h('button', { type: 'button', class: 'small', text: 'Record payment', attrs: { 'aria-label': 'Record payment for ' + inv.number }, on: { click: function () {
              var v = C.parseMoney(pay.value);
              if (v == null || v <= 0) { pay.classList.add('invalid'); return; }
              var list = D.list('invoices');
              list.forEach(function (x) { if (x.id === inv.id) { x.payments = (x.payments || []).concat([{ date: C.iso(C.today()), amount: Math.min(v, D.invoiceDue(x)) }]); } });
              D.save('invoices', list);
              App.views.invoices.render(root);
            } } }));
          }
          acts.appendChild(h('button', { type: 'button', class: 'ghost small', text: 'Print', attrs: { 'aria-label': 'Print ' + inv.number }, on: { click: function () { printInvoice(inv); } } }));
          acts.appendChild(h('button', { type: 'button', class: 'ghost small', text: 'Delete', attrs: { 'aria-label': 'Delete ' + inv.number }, on: { click: function () {
            C.confirmDialog('Delete ' + inv.number + '?', 'This removes the invoice and its recorded payments from your income totals.', 'Delete').then(function (ok) {
              if (!ok) return;
              D.save('invoices', D.list('invoices').filter(function (x) { return x.id !== inv.id; }));
              App.views.invoices.render(root);
            });
          } } }));
          tbody.appendChild(h('tr', { class: s === 'overdue' ? 'row-over' : '' }, h('td', { text: inv.number }), h('td', { text: D.clientName(inv.clientId) }),
            h('td', { class: 'nowrap', text: inv.due ? C.fmtDate(C.parseISO(inv.due)) : '—' }), h('td', { text: C.fmt(inv.amount) }),
            h('td', { text: C.fmt(D.invoicePaid(inv)) }), h('td', null, h('span', { class: 'badge' + (s === 'overdue' ? ' bad' : s === 'paid' ? ' ok' : ''), text: LABEL[s] })), h('td', null, acts)));
        });
        card.appendChild(C.tableWrap(h('table', { class: 'table cardrows' },
          h('thead', null, h('tr', null, ['Invoice', 'Client', 'Due', 'Amount', 'Paid', 'Status', ''].map(function (x) { return h('th', { text: x }); }))), tbody)));
      }
      root.appendChild(h('div', { class: 'split late listfirst' }, h('div', { class: 'side' }, form), h('div', { class: 'main' }, card)));
    },
  };
  App.nav.push('invoices');
})(window);
