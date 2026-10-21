/* Data access + every computed number the app shows. Keeping the arithmetic in one
 * place (all money in whole cents) is what the audit's totals checks rely on. There are
 * no spreadsheet formulas here to overwrite: totals are always recomputed from the
 * records. */
(function (g) {
  var App = g.App = g.App || { views: {}, nav: [] };
  var C = App.core;

  var SIZES = [
    ['Small (up to 1,000 sq ft)', 1.0], ['Medium (1,000 to 1,800 sq ft)', 1.75],
    ['Large (1,800 to 2,800 sq ft)', 2.5], ['Extra large (2,800 sq ft and up)', 3.5],
  ];
  var TYPES = [['Standard clean', 1, 'standard'], ['Deep clean', 1.6, 'deep'], ['Move-in / move-out clean', 1.9, 'move']];
  var FREQS = [['One-off', 0, 'none'], ['Monthly', 0.05, 'monthly'], ['Every two weeks', 0.10, 'biweekly'], ['Weekly', 0.15, 'weekly']];
  /** How many visits a new repeating job creates (the first one included). */
  var SERIES_COUNT = { weekly: 12, biweekly: 8, monthly: 6 };
  var EXPENSE_CATEGORIES = ['Supplies', 'Fuel and mileage', 'Equipment', 'Insurance', 'Marketing', 'Software', 'Wages', 'Other'];

  function find(arr, id) { for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i]; return null; }

  var D = App.data = {
    SIZES: SIZES, TYPES: TYPES, FREQS: FREQS, EXPENSE_CATEGORIES: EXPENSE_CATEGORIES,
    CURRENCIES: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'CHF', 'SEK', 'NOK', 'DKK', 'MAD', 'AED', 'ZAR', 'INR', 'MXN', 'BRL', 'JPY'],

    business: function () { return App.store.get('business', { setupDone: false, name: '', rate: 0 }); },
    saveBusiness: function (b) { App.store.set('business', b); },
    list: function (key) { return App.store.get(key, []); },
    save: function (key, arr) { App.store.set(key, arr); },
    client: function (id) { return find(D.list('clients'), id); },
    clientName: function (id) { var c = D.client(id); return c ? c.name : '(removed client)'; },

    /* ---------- Quotes ---------- */
    /** hours = (base size + 0.25 per bedroom + 0.5 per bathroom) x clean type, rounded to a quarter hour;
     *  price = hours x hourly rate, less the repeat discount. Every step is returned so it can be shown. */
    quote: function (inp, rate) {
      var size = SIZES[inp.size] || SIZES[0], type = TYPES[inp.type] || TYPES[0], freq = FREQS[inp.freq] || FREQS[0];
      var beds = Math.max(0, inp.beds || 0), baths = Math.max(0, inp.baths || 0);
      var raw = (size[1] + 0.25 * beds + 0.5 * baths) * type[1];
      var hours = Math.max(1, Math.round(raw * 4) / 4);
      var gross = Math.round(hours * (rate || 0));
      var discount = Math.round(gross * freq[1]);
      return {
        hours: hours, rate: rate || 0, gross: gross, discount: discount, discountPct: Math.round(freq[1] * 100),
        price: gross - discount, repeat: freq[2], typeLabel: type[0], sizeLabel: size[0], beds: beds, baths: baths,
      };
    },

    /* ---------- Jobs ---------- */
    /** ISO dates for a new job: just the first date, or the whole series when it repeats. */
    seriesDates: function (startIso, repeat) {
      var start = C.parseISO(startIso), n = SERIES_COUNT[repeat] || 1, out = [];
      if (!start) return out;
      for (var i = 0; i < n; i++) {
        out.push(C.iso(repeat === 'weekly' ? C.addDays(start, 7 * i) : repeat === 'biweekly' ? C.addDays(start, 14 * i) : repeat === 'monthly' ? C.addMonths(start, i) : start));
      }
      return out;
    },
    sortedJobs: function () {
      return D.list('jobs').slice().sort(function (a, b) {
        var ka = a.date + ' ' + (a.time || ''), kb = b.date + ' ' + (b.time || '');
        return ka < kb ? -1 : ka > kb ? 1 : 0;
      });
    },
    jobsOn: function (isoDate) {
      return D.sortedJobs().filter(function (j) { return j.date === isoDate && j.status !== 'cancelled'; });
    },

    /* ---------- Invoices ---------- */
    invoicePaid: function (inv) {
      var t = 0;
      (inv.payments || []).forEach(function (p) { t += p.amount || 0; });
      return t;
    },
    invoiceDue: function (inv) { return Math.max(0, (inv.amount || 0) - D.invoicePaid(inv)); },
    isOverdue: function (inv) { return D.invoiceDue(inv) > 0 && !!inv.due && inv.due < C.iso(C.today()); },
    invoiceStatus: function (inv) {
      var due = D.invoiceDue(inv);
      if (due === 0) return 'paid';
      if (D.isOverdue(inv)) return 'overdue';
      return D.invoicePaid(inv) > 0 ? 'part-paid' : 'unpaid';
    },
    nextInvoiceNumber: function () {
      var max = 0;
      D.list('invoices').forEach(function (i) { var m = /(\d+)$/.exec(i.number || ''); if (m) max = Math.max(max, +m[1]); });
      var n = String(max + 1);
      while (n.length < 4) n = '0' + n;
      return 'INV-' + n;
    },
    /** Unpaid invoices grouped by client, largest balance first. */
    owedByClient: function () {
      var map = {};
      D.list('invoices').forEach(function (inv) {
        var due = D.invoiceDue(inv);
        if (!due) return;
        var row = map[inv.clientId] || (map[inv.clientId] = { clientId: inv.clientId, due: 0, overdue: 0, count: 0 });
        row.due += due; row.count += 1;
        if (D.isOverdue(inv)) row.overdue += due;
      });
      return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return b.due - a.due; });
    },
    owedTotals: function () {
      var t = { due: 0, overdue: 0, overdueCount: 0 };
      D.list('invoices').forEach(function (inv) {
        var due = D.invoiceDue(inv);
        t.due += due;
        if (due && D.isOverdue(inv)) { t.overdue += due; t.overdueCount += 1; }
      });
      return t;
    },

    /** Days from the invoice date to the due date (Settings; defaults to 7). */
    terms: function () { var t = D.business().terms; return t >= 0 && t <= 365 ? t : 7; },
    /** Saves a new invoice dated today (or `date`) and returns it. */
    createInvoice: function (o) {
      var date = o.date || C.iso(C.today()), d = C.parseISO(date) || C.today();
      var inv = { id: C.uid(), number: D.nextInvoiceNumber(), clientId: o.clientId, date: date, due: C.iso(C.addDays(d, D.terms())),
        description: o.description || 'Cleaning', amount: o.amount || 0, payments: [], jobId: o.jobId || null };
      var all = D.list('invoices'); all.push(inv); D.save('invoices', all);
      return inv;
    },

    /* ---------- Money in and out, by month ---------- */
    monthIncome: function (key) {
      var t = 0;
      D.list('invoices').forEach(function (inv) { (inv.payments || []).forEach(function (p) { if (C.monthKey(p.date) === key) t += p.amount || 0; }); });
      return t;
    },
    monthExpenses: function (key) {
      var t = 0;
      D.list('expenses').forEach(function (e) { if (C.monthKey(e.date) === key) t += e.amount || 0; });
      return t;
    },
    /** The last n month keys (YYYY-MM), oldest first, ending with the current month. */
    lastMonths: function (n) {
      var now = C.today(), out = [];
      for (var i = n - 1; i >= 0; i--) out.push(C.iso(new Date(now.getFullYear(), now.getMonth() - i, 1)).slice(0, 7));
      return out;
    },
    monthSummary: function (key) {
      var inc = D.monthIncome(key), exp = D.monthExpenses(key);
      return { key: key, income: inc, expenses: exp, profit: inc - exp };
    },
  };
})(window);
