/* Clients: one record per client, entered once. Jobs, quotes and invoices start from it.
 * Also imports an existing client list from a CSV exported from a spreadsheet. The public
 * demo build (window.APP_DEMO_MODE) caps the list and turns the CSV import off. */
(function (g) {
  var App = g.App = g.App || { views: {}, nav: [] };
  var C = App.core, D = App.data, h = C.h;
  var DEMO_LIMIT = 3, MAX_IMPORT = 500;
  var editingId = null, filterText = '', importState = null;

  function demoFull() { return window.APP_DEMO_MODE && D.list('clients').length >= DEMO_LIMIT; }
  function key(c) { return (c.name || '').trim().toLowerCase() + '|' + (c.address || '').trim().toLowerCase(); }

  /** Reads the uploaded CSV into { valid: [...], problems: [...] } without saving anything. */
  function analyseCSV(text) {
    var rows = C.parseCSV(text), out = { valid: [], problems: [], fatal: '' };
    if (rows.length < 2) { out.fatal = 'The file needs a header row and at least one client.'; return out; }
    var head = rows[0].map(function (x) { return x.trim().toLowerCase(); });
    function col(words) { for (var i = 0; i < head.length; i++) for (var w = 0; w < words.length; w++) if (head[i].indexOf(words[w]) >= 0) return i; return -1; }
    var cName = col(['name', 'client', 'customer']), cAddr = col(['address', 'street', 'location']), cPhone = col(['phone', 'mobile', 'tel']), cNote = col(['note', 'comment', 'detail']);
    if (cName < 0) { out.fatal = 'No Name column found. Put a header like "Name" in the first row.'; return out; }
    var seen = {};
    D.list('clients').forEach(function (c) { seen[key(c)] = true; });
    rows.slice(1).forEach(function (r, i) {
      var line = i + 2;
      if (out.valid.length >= MAX_IMPORT) { if (!out.capped) { out.capped = true; out.problems.push('Only the first ' + MAX_IMPORT + ' clients are imported at once.'); } return; }
      var c = { id: C.uid(), name: (r[cName] || '').trim().slice(0, 80), address: (cAddr >= 0 ? r[cAddr] || '' : '').trim().slice(0, 160),
        phone: (cPhone >= 0 ? r[cPhone] || '' : '').trim().slice(0, 40), notes: (cNote >= 0 ? r[cNote] || '' : '').trim().slice(0, 300), price: 0, freq: 'none' };
      if (!c.name) { out.problems.push('Row ' + line + ': no name, skipped.'); return; }
      if (seen[key(c)]) { out.problems.push('Row ' + line + ': ' + c.name + ' is already in your list (or repeated in the file), skipped.'); return; }
      seen[key(c)] = true;
      out.valid.push(c);
    });
    return out;
  }

  function renderImport(root, box) {
    box.innerHTML = '';
    var card = h('div', { class: 'card' }, h('h2', { text: 'Import from your spreadsheet' }));
    if (window.APP_DEMO_MODE) {
      card.appendChild(C.banner('info', 'Importing a client list from a spreadsheet (CSV) is part of the full version.'));
      box.appendChild(card);
      return;
    }
    card.appendChild(h('p', { class: 'sub', text: 'In Excel or Google Sheets choose File, then Save or Download as CSV. Use a header row with Name, and optionally Address, Phone and Notes. You see a preview before anything is added.' }));
    var file = h('input', { type: 'file', id: 'csvFile', attrs: { accept: '.csv,text/csv', 'aria-label': 'Choose a CSV file' } });
    file.addEventListener('change', function () {
      var f = file.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () { importState = analyseCSV(String(r.result)); renderImport(root, box); };
      r.onerror = function () { importState = { valid: [], problems: [], fatal: 'That file could not be read.' }; renderImport(root, box); };
      r.readAsText(f);
    });
    card.appendChild(file);
    if (importState) {
      if (importState.fatal) card.appendChild(C.banner('error', importState.fatal));
      else {
        card.appendChild(C.banner(importState.valid.length ? 'success' : 'warning', importState.valid.length + (importState.valid.length === 1 ? ' client is' : ' clients are') + ' ready to import' + (importState.problems.length ? '; ' + importState.problems.length + ' row(s) skipped.' : '.')));
        if (importState.valid.length) {
          card.appendChild(C.tableWrap(h('table', { class: 'table cardrows' },
            h('thead', null, h('tr', null, ['Name', 'Address', 'Phone'].map(function (x) { return h('th', { text: x }); }))),
            h('tbody', null, importState.valid.slice(0, 8).map(function (c) { return h('tr', null, h('td', { text: c.name }), h('td', { text: c.address }), h('td', { text: c.phone })); })))));
          if (importState.valid.length > 8) card.appendChild(h('p', { class: 'caption', text: '…and ' + (importState.valid.length - 8) + ' more.' }));
        }
        if (importState.problems.length) {
          var ul = h('ul', { class: 'plain' });
          importState.problems.slice(0, 10).forEach(function (p) { ul.appendChild(h('li', { text: p })); });
          card.appendChild(ul);
          if (importState.problems.length > 10) card.appendChild(h('p', { class: 'caption', text: '…and ' + (importState.problems.length - 10) + ' more skipped rows.' }));
        }
        if (importState.valid.length) {
          card.appendChild(h('div', { class: 'row' },
            h('button', { type: 'button', id: 'confirmImportBtn', text: 'Import ' + importState.valid.length + (importState.valid.length === 1 ? ' client' : ' clients'), on: { click: function () {
              D.save('clients', D.list('clients').concat(importState.valid));
              importState = null;
              App.views.clients.render(root);
            } } }),
            h('button', { type: 'button', class: 'ghost', text: 'Cancel', on: { click: function () { importState = null; renderImport(root, box); } } })));
        }
      }
    }
    box.appendChild(card);
  }

  App.views.clients = {
    navLabel: 'Clients',
    render: function (root) {
      root.dataset.activeView = 'clients';
      root.innerHTML = '';
      var clients = D.list('clients'), editing = editingId ? D.client(editingId) : null;
      if (editingId && !editing) editingId = null;
      root.appendChild(h('h1', { text: 'Clients' }));
      root.appendChild(h('p', { class: 'sub', text: 'Enter each client once. Jobs, quotes and invoices fill in their details from here.' }));
      if (window.APP_DEMO_MODE) root.appendChild(C.banner('info', 'Demo: up to ' + DEMO_LIMIT + ' clients. The full version has no limit.'));

      var name = h('input', { type: 'text', id: 'clientName', value: editing ? editing.name : '', attrs: { maxlength: '80', autocomplete: 'off' } });
      var address = h('input', { type: 'text', id: 'clientAddress', value: editing ? editing.address : '', attrs: { maxlength: '160', autocomplete: 'off' } });
      var phone = h('input', { type: 'text', id: 'clientPhone', value: editing ? editing.phone : '', attrs: { maxlength: '40', inputmode: 'tel', autocomplete: 'off' } });
      var price = h('input', { type: 'text', id: 'clientPrice', value: editing ? C.inputMoney(editing.price) : '', attrs: { inputmode: 'decimal' } });
      var freq = h('select', { id: 'clientFreq' });
      D.FREQS.forEach(function (f) { freq.appendChild(h('option', { value: f[2], text: f[0], selected: !!editing && editing.freq === f[2] })); });
      var notes = h('input', { type: 'text', id: 'clientNotes', value: editing ? editing.notes : '', attrs: { maxlength: '300' } });
      var fName = C.field('clientName', 'Name', name), fPrice = C.field('clientPrice', 'Usual price per visit', price, 'Optional. Pre-fills new jobs and invoices.');
      var form = h('div', { class: 'card' }, h('h2', { text: editing ? 'Edit client' : 'Add a client' }), fName,
        C.field('clientAddress', 'Address', address), C.field('clientPhone', 'Phone', phone),
        h('div', { class: 'grid-2' }, fPrice, C.field('clientFreq', 'Usually repeats', freq)),
        C.field('clientNotes', 'Notes', notes, 'Access codes, pets, things to avoid. Stays on this device.'),
        h('div', { class: 'row' },
          h('button', { type: 'button', id: 'addClientBtn', text: editing ? 'Save changes' : 'Add client' }),
          editing ? h('button', { type: 'button', id: 'cancelEditBtn', class: 'ghost', text: 'Cancel', on: { click: function () { editingId = null; App.views.clients.render(root); } } }) : null));
      form.querySelector('#addClientBtn').addEventListener('click', function () {
        C.clearErrors(form);
        var nm = name.value.trim(), p = price.value.trim() === '' ? 0 : C.parseMoney(price.value);
        if (!nm) return C.setError(fName, 'Enter the client\'s name.');
        if (p == null || p < 0) return C.setError(fPrice, 'Enter the price as a number, or leave it empty.');
        var all = D.list('clients');
        if (editing) {
          all.forEach(function (c) { if (c.id === editing.id) { c.name = nm; c.address = address.value.trim(); c.phone = phone.value.trim(); c.notes = notes.value.trim(); c.price = p; c.freq = freq.value; } });
          editingId = null;
        } else {
          if (demoFull()) return C.setError(fName, 'The demo is limited to ' + DEMO_LIMIT + ' clients. The full version has no limit.');
          all.push({ id: C.uid(), name: nm, address: address.value.trim(), phone: phone.value.trim(), notes: notes.value.trim(), price: p, freq: freq.value });
        }
        D.save('clients', all);
        App.views.clients.render(root);
      });
      var importBox = h('div');
      var side = h('div', { class: 'side' }, form, importBox);
      renderImport(root, importBox);

      var search = h('input', { type: 'text', id: 'clientSearch', value: filterText, attrs: { placeholder: 'Search clients', 'aria-label': 'Search clients' } });
      var listCard = h('div', { class: 'card' }, h('h2', { text: clients.length ? 'Your clients (' + clients.length + ')' : 'Your clients' }));
      if (!clients.length) listCard.appendChild(C.emptyState('No clients yet', 'Add your first client on the left, or import your spreadsheet list.'));
      else {
        listCard.appendChild(search);
        var q = filterText.trim().toLowerCase();
        var shown = clients.filter(function (c) { return !q || (c.name + ' ' + c.address + ' ' + c.phone).toLowerCase().indexOf(q) >= 0; })
          .sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; });
        var tbody = h('tbody');
        shown.forEach(function (c) {
          var f = D.FREQS.filter(function (x) { return x[2] === c.freq; })[0];
          var edit = h('button', { type: 'button', class: 'ghost small', text: 'Edit', attrs: { 'aria-label': 'Edit ' + c.name }, on: { click: function () { editingId = c.id; App.views.clients.render(root); window.scrollTo(0, 0); } } });
          var del = h('button', { type: 'button', class: 'ghost small', text: 'Delete', attrs: { 'aria-label': 'Delete ' + c.name } });
          del.addEventListener('click', function () {
            var used = D.list('jobs').some(function (j) { return j.clientId === c.id; }) || D.list('invoices').some(function (i) { return i.clientId === c.id; });
            C.confirmDialog('Delete ' + c.name + '?', used ? 'Their jobs and invoices stay in your records but will show "(removed client)".' : 'This removes the client record.', 'Delete').then(function (ok) {
              if (!ok) return;
              D.save('clients', D.list('clients').filter(function (x) { return x.id !== c.id; }));
              App.views.clients.render(root);
            });
          });
          tbody.appendChild(h('tr', null, h('td', { text: c.name }), h('td', { text: c.address || '—' }), h('td', { text: c.phone || '—' }),
            h('td', { text: c.price ? C.fmt(c.price) + (f && f[2] !== 'none' ? ' · ' + f[0].toLowerCase() : '') : '—' }), h('td', null, h('span', { class: 'row' }, edit, del))));
        });
        if (!shown.length) listCard.appendChild(C.emptyState('No match', 'Try a different search.'));
        else listCard.appendChild(C.tableWrap(h('table', { class: 'table cardrows' },
          h('thead', null, h('tr', null, ['Name', 'Address', 'Phone', 'Usual visit', ''].map(function (x) { return h('th', { text: x }); }))), tbody)));
        search.addEventListener('input', function () { filterText = search.value; App.views.clients.render(root); var s = root.querySelector('#clientSearch'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } });
      }
      root.appendChild(h('div', { class: 'split' }, side, h('div', { class: 'main' }, listCard)));
    },
  };
  App.nav.push('clients');
})(window);
