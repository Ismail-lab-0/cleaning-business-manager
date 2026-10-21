/* Settings: your business details and cleaners, display (currency + light/dark), and
 * data (backup, restore, reset). Tabs follow the shared role=tablist convention. */
(function (g) {
  var App = g.App = g.App || { views: {}, nav: [] };
  var C = App.core, D = App.data, h = C.h;
  var DATA_KEYS = ['clients', 'jobs', 'invoices', 'expenses', 'cleaners'];

  function tab(id, label, selected) {
    return h('button', { type: 'button', id: 'tab-' + id, attrs: { role: 'tab', 'aria-controls': 'panel-' + id, 'aria-selected': selected ? 'true' : 'false' }, text: label });
  }
  function panel(id, hidden) {
    return h('div', { id: 'panel-' + id, attrs: { role: 'tabpanel', 'aria-labelledby': 'tab-' + id }, hidden: !!hidden });
  }

  App.views.settings = {
    navLabel: 'Settings',
    render: function (root) {
      root.dataset.activeView = 'settings';
      root.innerHTML = '';
      var b = D.business();
      root.appendChild(h('h1', { text: 'Settings' }));
      root.appendChild(h('p', { class: 'sub', text: 'Your business details, how the app looks, and your data. Everything stays on this device.' }));
      root.appendChild(h('div', { class: 'tabs', attrs: { role: 'tablist' } }, tab('business', 'Business', true), tab('display', 'Display', false), tab('data', 'Your data', false)));

      /* --- Business --- */
      var pB = panel('business', false);
      var name = h('input', { type: 'text', id: 'setName', value: b.name || '', attrs: { maxlength: '80' } });
      var rate = h('input', { type: 'text', id: 'setRate', value: C.inputMoney(b.rate), attrs: { inputmode: 'decimal' } });
      var terms = h('input', { type: 'number', id: 'setTerms', value: String(D.terms()), attrs: { min: '0', max: '365' } });
      var fName = C.field('setName', 'Business name', name, 'Shown on printed invoices.'), fRate = C.field('setRate', 'Hourly rate', rate, 'The Quotes calculator starts from this.');
      var fTerms = C.field('setTerms', 'Days to pay an invoice', terms, 'Sets the due date on new invoices. Overdue badges use it.');
      pB.appendChild(fName); pB.appendChild(fRate); pB.appendChild(fTerms);
      var msg = h('div');
      pB.appendChild(h('button', { type: 'button', id: 'saveBusinessBtn', text: 'Save business details', on: { click: function () {
        C.clearErrors(pB); msg.innerHTML = '';
        var r = rate.value.trim() === '' ? 0 : C.parseMoney(rate.value), t = parseInt(terms.value, 10);
        if (r == null || r < 0) return C.setError(fRate, 'Enter the rate as a number.');
        if (!(t >= 0 && t <= 365)) return C.setError(fTerms, 'Enter a number of days from 0 to 365.');
        D.saveBusiness({ setupDone: true, name: name.value.trim(), rate: r, terms: t });
        msg.appendChild(C.banner('success', 'Saved.'));
      } } }));
      pB.appendChild(msg);

      pB.appendChild(h('h2', { text: 'Your cleaners' }));
      pB.appendChild(h('p', { class: 'sub', text: 'Optional. Add the people who clean for you to assign jobs and filter the schedule.' }));
      var cn = h('input', { type: 'text', id: 'cleanerName', attrs: { maxlength: '40' } });
      var fCn = C.field('cleanerName', 'Cleaner name', cn);
      pB.appendChild(fCn);
      pB.appendChild(h('button', { type: 'button', id: 'addCleanerBtn', class: 'ghost', text: 'Add cleaner', on: { click: function () {
        C.clearErrors(pB);
        var n = cn.value.trim(), list = App.store.get('cleaners', []);
        if (!n) return C.setError(fCn, 'Enter a name.');
        if (list.indexOf(n) >= 0) return C.setError(fCn, 'That cleaner is already in the list.');
        App.store.set('cleaners', list.concat([n]));
        App.views.settings.render(root);
      } } }));
      var cl = App.store.get('cleaners', []);
      if (cl.length) {
        var ul = h('ul');
        cl.forEach(function (n) {
          ul.appendChild(h('li', null, h('span', { text: n }), h('button', { type: 'button', class: 'ghost small', text: 'Remove', attrs: { 'aria-label': 'Remove ' + n }, on: { click: function () {
            App.store.set('cleaners', App.store.get('cleaners', []).filter(function (x) { return x !== n; }));
            App.views.settings.render(root);
          } } })));
        });
        pB.appendChild(ul);
      }
      root.appendChild(pB);

      /* --- Display --- */
      var pD = panel('display', true);
      var cur = h('select', { id: 'setCurrency', attrs: { 'aria-label': 'Currency' } });
      D.CURRENCIES.forEach(function (c) { cur.appendChild(h('option', { value: c, text: c, selected: c === App.store.get('currency', 'USD') })); });
      cur.addEventListener('change', function () { App.store.set('currency', cur.value); });
      pD.appendChild(C.field('setCurrency', 'Currency', cur, 'Only changes how amounts are shown.'));
      var themeBtn = h('button', { type: 'button', id: 'setThemeBtn', class: 'ghost' });
      function themeLabel() { themeBtn.textContent = App.store.get('theme', 'light') === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'; }
      themeLabel();
      themeBtn.addEventListener('click', function () {
        var next = App.store.get('theme', 'light') === 'dark' ? 'light' : 'dark';
        App.store.set('theme', next);
        document.documentElement.setAttribute('data-theme', next);
        themeLabel();
      });
      pD.appendChild(h('div', { class: 'field' }, h('label', { text: 'Appearance' }), themeBtn));
      root.appendChild(pD);

      /* --- Data --- */
      var pDa = panel('data', true);
      pDa.appendChild(h('p', { text: 'There is no account. Your records live in this browser. Save a backup file to move to another device or to keep a copy.' }));
      pDa.appendChild(h('div', { class: 'row wrap' },
        h('button', { type: 'button', id: 'settingsExportBtn', text: 'Export backup', on: { click: function () { document.getElementById('exportBtn').click(); } } }),
        h('button', { type: 'button', id: 'settingsImportBtn', class: 'ghost', text: 'Import backup', on: { click: function () { document.getElementById('importBtn').click(); } } })));
      var counts = [['Clients', D.list('clients').length], ['Jobs', D.list('jobs').length], ['Invoices', D.list('invoices').length], ['Expenses', D.list('expenses').length], ['Cleaners', cl.length]];
      pDa.appendChild(C.tableWrap(h('table', { class: 'table' }, h('thead', null, h('tr', null, h('th', { text: 'Saved on this device' }), h('th', { text: 'Count' }))),
        h('tbody', null, counts.map(function (r) { return h('tr', null, h('td', { text: r[0] }), h('td', { text: String(r[1]) })); })))));
      pDa.appendChild(C.banner('warning', 'Resetting deletes all your records from this device. Export a backup first if you might want them back.'));
      pDa.appendChild(h('button', { type: 'button', id: 'resetBtn', class: 'danger', text: 'Reset all data', on: { click: function () {
        C.confirmDialog('Reset everything?', 'This deletes your clients, jobs, invoices, expenses and settings from this device.', 'Delete everything').then(function (ok) {
          if (!ok) return;
          DATA_KEYS.forEach(function (k) { App.store.set(k, []); });
          App.store.set('business', { setupDone: false, name: '', rate: 0 });
          location.hash = '#dashboard';
          AppRouter.init();
        });
      } } }));
      root.appendChild(pDa);

      App.ui.initTabs(root);
    },
  };
  App.nav.push('settings');
})(window);
