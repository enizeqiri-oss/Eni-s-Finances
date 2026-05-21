// Atelier · page bootstrap & bindings
// Renders [data-bind] attributes from state, wires page-specific behaviors.

(function () {
  'use strict';
  const A = window.Atelier;
  if (!A) { console.error('[atelier] state.js missing'); return; }

  // Pages that require onboarding to be complete first.
  const GATED = new Set(['overview', 'income', 'bills', 'upload', 'summary', 'mobile']);

  function page() {
    return document.body.getAttribute('data-page') || '';
  }

  function go(path) { location.href = path; }

  // ── tiny dom helpers ──
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  // ── binding ──
  // <span data-bind="profile.firstName"></span>
  // <span data-bind="netMonthly" data-fmt="num"></span>
  function bind() {
    const s = A.get();
    const d = A.derived();
    const ctx = { ...s, ...d };

    $$('[data-bind]').forEach(el => {
      const path = el.getAttribute('data-bind');
      const fmt = el.getAttribute('data-fmt') || 'text';
      const v = read(ctx, path);
      const out = format(v, fmt, el);
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.value = out;
      } else {
        el.textContent = out;
      }
    });

    $$('[data-bind-html]').forEach(el => {
      const path = el.getAttribute('data-bind-html');
      el.innerHTML = String(read(ctx, path) ?? '');
    });

    $$('[data-bind-width]').forEach(el => {
      const expr = el.getAttribute('data-bind-width');
      // expr like: "spending.groceries / budgets.groceries"
      const w = ratioPercent(ctx, expr);
      el.style.width = Math.min(100, Math.max(0, w)) + '%';
    });

    $$('[data-show-if]').forEach(el => {
      const expr = el.getAttribute('data-show-if');
      const v = read(ctx, expr);
      el.style.display = v ? '' : 'none';
    });

    $$('[data-hide-if]').forEach(el => {
      const expr = el.getAttribute('data-hide-if');
      const v = read(ctx, expr);
      el.style.display = v ? 'none' : '';
    });
  }

  function read(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }
  function ratioPercent(ctx, expr) {
    const [num, den] = expr.split('/').map(s => s.trim());
    const n = parseFloat(read(ctx, num)) || 0;
    const d = parseFloat(read(ctx, den)) || 0;
    if (d === 0) return 0;
    return (n / d) * 100;
  }
  function format(v, kind, el) {
    if (v === undefined || v === null) return '';
    if (kind === 'text') return String(v);
    if (kind === 'num')  return A.fmt(v);
    if (kind === 'num2') return A.fmt(v, { decimals: 2 });
    if (kind === 'pct')  return A.fmtPct(v);
    if (kind === 'pct1') return A.fmtPct(v, 1);
    if (kind === 'signed') return A.fmt(v, { signed: true });
    if (kind === 'amt')  return A.fmt(v, { decimals: (Math.round(v) === v ? 0 : 2) });
    if (kind === 'greeting') return A.greeting();
    return String(v);
  }

  // ── per-page wiring ──
  const pages = {
    overview() {
      renderBills();
      renderTransactions();
      renderSpendingDonut();

      $('[data-action="add-tx"]')?.addEventListener('click', () => {
        const vendor = prompt('Vendor (e.g. Coop)');
        if (!vendor) return;
        const amount = parseFloat(prompt('Amount in CHF (use negative for spend, positive for income)', '-25'));
        if (!isFinite(amount)) return;
        const category = prompt('Category', amount > 0 ? 'Income' : 'Groceries') || 'Other';
        A.update({
          transactions: [
            { id: A.uid(), date: new Date().toISOString().slice(0, 10), vendor, category, amount },
            ...A.get().transactions,
          ],
        });
        bind();
        renderTransactions();
      });
    },

    income() {
      // Two-way bind every form field via data-field="path"
      $$('[data-field]').forEach(el => {
        const path = el.getAttribute('data-field');
        const v = read(A.get(), path);
        el.value = v == null ? '' : v;
        el.addEventListener('input', () => {
          const val = isNumericField(el) ? parseFloat(el.value) || 0 : el.value;
          const patch = pathToObject(path, val);
          A.update(patch);
          bind();
          renderCalc();
        });
      });
      renderCalc();
    },

    bills() {
      renderBillsTable();

      $('[data-action="add-bill"]')?.addEventListener('click', () => {
        const vendor = prompt('Vendor (e.g. Helsana)');
        if (!vendor) return;
        const category = prompt('Category (Housing, Insurance, Utilities, Transport, Health, Subs)', 'Subs') || 'Other';
        const amount = parseFloat(prompt('Amount per month, CHF', '50'));
        if (!isFinite(amount)) return;
        const dueDay = parseInt(prompt('Due day of month (1–28)', '15'), 10) || 15;
        A.update({
          bills: [
            ...A.get().bills,
            { id: A.uid(), vendor, category, amount, dueDay, status: 'upcoming' },
          ],
        });
        bind();
        renderBillsTable();
      });

      // Filter chips
      $$('.chip-btn').forEach(c => c.addEventListener('click', () => {
        $$('.chip-btn').forEach(x => x.classList.remove('active'));
        c.classList.add('active');
        renderBillsTable(c.dataset.filter || 'all');
      }));
    },

    summary() {
      renderCategoryBreakdown();
      renderInsights();
    },

    upload() {
      $('[data-action="confirm-tx"]')?.addEventListener('click', () => {
        A.update({
          transactions: [
            { id: A.uid(), date: '2026-05-17', vendor: 'Migros M-Restaurant', category: 'Dining', amount: -18.40 },
            ...A.get().transactions,
          ],
          spending: { dining: A.get().spending.dining + 18.40 },
        });
        alert('Filed under May · Variable · Dining. View it on the Overview.');
      });
    },

    mobile() {
      renderMobileBills();
      renderMobileBudgets();
    },

    onboarding() {
      Onboarding.start();
    },
  };

  function isNumericField(el) {
    return el.type === 'number' || el.dataset.numeric === 'true';
  }
  function pathToObject(path, value) {
    const parts = path.split('.');
    const out = {};
    let cur = out;
    for (let i = 0; i < parts.length - 1; i++) {
      cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
    return out;
  }

  // ── renderers ──
  function renderBills() {
    const list = $('[data-list="upcoming-bills"]');
    if (!list) return;
    const month = new Date().toLocaleString('en-US', { month: 'short' });
    const items = A.get().bills.filter(b => b.status === 'upcoming').slice(0, 3);
    if (!items.length) { list.innerHTML = '<div class="card-sub" style="padding:8px 0;">No upcoming bills.</div>'; return; }
    list.innerHTML = items.map((b, i) => `
      <div class="row" style="gap:14px; padding:8px 0;${i ? 'border-top:1px solid var(--rule);' : ''}">
        <div class="day-chip"><div><span>${month}</span><span class="d">${b.dueDay}</span></div></div>
        <div style="flex:1;">
          <div style="font-weight:500; font-size:14.5px;">${escapeHtml(b.vendor)}</div>
          <div class="card-sub" style="margin:2px 0 0;">${escapeHtml(b.category)}</div>
        </div>
        <div class="num-m">${A.fmt(b.amount)}</div>
      </div>
    `).join('');
  }

  function renderTransactions() {
    const list = $('[data-list="transactions"]');
    if (!list) return;
    const items = A.get().transactions.slice(0, 4);
    if (!items.length) {
      list.innerHTML = '<div class="card-sub" style="padding:8px 0;">No transactions yet — add one with the + button.</div>';
      return;
    }
    const colors = {
      Groceries: '#9DA978', Dining: '#C66A4E', Income: '#1A1815', Shopping: '#A89779',
      Transport: '#7A8FA8', Health: '#C4A571', Leisure: '#9C7BA0',
    };
    list.innerHTML = items.map(t => {
      const c = colors[t.category] || '#A89779';
      const positive = t.amount >= 0;
      return `
      <div style="display:grid; grid-template-columns: 10px 1fr auto; gap:10px; align-items:center; padding:9px 0; border-bottom:1px dashed var(--rule);">
        <span class="dot" style="background:${c}"></span>
        <div>
          <div style="font-weight:500; font-size:14px;">${escapeHtml(t.vendor)}</div>
          <div class="card-sub" style="margin:2px 0 0;">${formatDate(t.date)} · ${escapeHtml(t.category)}</div>
        </div>
        <div class="num-m" style="color: ${positive ? '#3D5A33' : 'var(--accent)'};">${positive ? '+' : '−'}${A.fmt(Math.abs(t.amount), { decimals: Math.abs(t.amount) % 1 ? 2 : 0 })}</div>
      </div>`;
    }).join('');
  }

  function renderSpendingDonut() {
    const wrap = $('[data-donut="spending"]');
    if (!wrap) return;
    const s = A.get().spending;
    const segs = [
      { key: 'groceries', color: '#9DA978', label: 'Groceries' },
      { key: 'dining',    color: '#C66A4E', label: 'Dining' },
      { key: 'shopping',  color: '#A89779', label: 'Shopping' },
      { key: 'leisure',   color: '#9C7BA0', label: 'Leisure' },
      { key: 'transport', color: '#7A8FA8', label: 'Transport' },
    ];
    const total = segs.reduce((a, x) => a + (s[x.key] || 0), 0);
    const C = 2 * Math.PI * 56; // 351.86
    let offset = 0;
    const circles = total > 0 ? segs.map(x => {
      const v = s[x.key] || 0;
      const len = (v / total) * C;
      const c = `<circle r="56" cx="80" cy="80" stroke="${x.color}" stroke-dasharray="${len.toFixed(2)} ${C - len.toFixed(2)}" stroke-dashoffset="-${offset.toFixed(2)}" transform="rotate(-90 80 80)"/>`;
      offset += len;
      return c;
    }).join('') : `<circle r="56" cx="80" cy="80" stroke="#E5DCC2" fill="none" stroke-width="22"/>`;
    const legend = segs.map(x => {
      const v = s[x.key] || 0;
      const pct = total > 0 ? Math.round((v / total) * 100) : 0;
      return `<li><span class="dot" style="background:${x.color}"></span>${x.label}<span class="amt">${A.fmt(v)}</span><span class="pct">${pct}%</span></li>`;
    }).join('');
    wrap.innerHTML = `
      <svg viewBox="0 0 160 160" width="148" height="148" aria-label="Spending donut">
        <g fill="none" stroke-width="22">${circles}</g>
        <text x="80" y="76" text-anchor="middle" font-family="Newsreader, serif" font-size="22" fill="#1A1815">${A.fmt(total)}</text>
        <text x="80" y="94" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="9" fill="#8A8472" letter-spacing="1">VARIABLE</text>
      </svg>
      <ul class="cats" style="flex:1;">${legend}</ul>
    `;
  }

  function renderBillsTable(filter) {
    const tbody = $('[data-list="bills"]');
    if (!tbody) return;
    const f = (filter || 'all').toLowerCase();
    const month = new Date().toLocaleString('en-US', { month: 'short' });
    let bills = A.get().bills;
    if (f !== 'all') bills = bills.filter(b => (b.category || '').toLowerCase() === f);
    if (!bills.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="padding:30px 0; text-align:center; color: var(--ink-3);"><em>No bills here. Use “+ New bill” to add one.</em></td></tr>`;
      return;
    }
    tbody.innerHTML = bills.map(b => `
      <tr data-id="${b.id}">
        <td>
          <div class="vendor">
            <div class="vicon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="5" width="16" height="14" rx="2"/></svg></div>
            <div><div class="vname">${escapeHtml(b.vendor)}</div><div class="vsub">monthly · auto-debit</div></div>
          </div>
        </td>
        <td>${escapeHtml(b.category)}</td>
        <td class="mono" style="font-size:13px;">${String(b.dueDay).padStart(2,'0')} ${month}</td>
        <td>
          <button class="pill ${b.status === 'paid' ? 'paid' : 'upcoming'}" data-toggle-bill="${b.id}" style="border:0; cursor:pointer;">${b.status}</button>
        </td>
        <td class="amt">${A.fmt(b.amount, { decimals: 2 })}</td>
        <td class="more"><button data-remove-bill="${b.id}" style="background:none; border:0; color: var(--ink-3); cursor:pointer; font-size:18px; padding: 0 4px;">×</button></td>
      </tr>
    `).join('');

    $$('[data-toggle-bill]', tbody).forEach(btn => btn.addEventListener('click', () => {
      const id = btn.dataset.toggleBill;
      const bills = A.get().bills.map(b => b.id === id ? { ...b, status: b.status === 'paid' ? 'upcoming' : 'paid' } : b);
      A.update({ bills });
      bind();
      renderBillsTable(f);
    }));
    $$('[data-remove-bill]', tbody).forEach(btn => btn.addEventListener('click', () => {
      const id = btn.dataset.removeBill;
      if (!confirm('Remove this bill?')) return;
      A.update({ bills: A.get().bills.filter(b => b.id !== id) });
      bind();
      renderBillsTable(f);
    }));
  }

  function renderCalc() {
    const d = A.derived();
    const set = (sel, v) => { const el = $(sel); if (el) el.textContent = v; };
    set('[data-calc="brutto"]', A.fmt(d.brutto));
    set('[data-calc="ahv"]', '−' + A.fmt(d.ahv));
    set('[data-calc="bvg"]', '−' + A.fmt(d.bvg));
    set('[data-calc="3a"]', '−' + A.fmt(A.get().taxes.saule3a));
    set('[data-calc="tax"]', '−' + A.fmt(d.brutto * (A.get().taxes.taxRate / 100)));
    set('[data-calc="side"]', '+' + A.fmt(d.side));
    set('[data-calc="net"]', A.fmt(d.netMonthly));
    set('[data-calc="annual"]', A.fmt(d.netMonthly * 12));
    set('[data-calc="ahv-rate-pct"]', A.fmtPct(A.get().taxes.ahvRate, 1));
    set('[data-calc="tax-rate-pct"]', A.fmtPct(A.get().taxes.taxRate, 1));
  }

  function renderCategoryBreakdown() {
    const list = $('[data-list="categories"]');
    if (!list) return;
    const s = A.get();
    const d = A.derived();
    const bills = s.bills;
    const grouped = {};
    bills.forEach(b => { grouped[b.category] = (grouped[b.category] || 0) + (parseFloat(b.amount) || 0); });
    const variable = s.spending;
    const variableMap = {
      Groceries: variable.groceries, Dining: variable.dining,
      Shopping: variable.shopping, Leisure: variable.leisure, Transport: variable.transport,
    };
    Object.entries(variableMap).forEach(([k, v]) => {
      if (k === 'Dining') grouped['Dining & leisure'] = (grouped['Dining & leisure'] || 0) + (v || 0) + (variableMap.Leisure || 0);
      else if (k === 'Leisure') return;
      else if (k === 'Groceries') grouped['Groceries'] = (grouped['Groceries'] || 0) + (v || 0);
      else if (k === 'Shopping') grouped['Shopping & other'] = (grouped['Shopping & other'] || 0) + (v || 0);
      else if (k === 'Transport') grouped['Transport'] = (grouped['Transport'] || 0) + (v || 0);
    });
    // Merge Housing/Utilities
    const housing = (grouped['Housing'] || 0) + (grouped['Utilities'] || 0);
    delete grouped['Housing']; delete grouped['Utilities'];
    if (housing) grouped['Housing & utilities'] = housing;

    const colors = {
      'Housing & utilities': 'var(--cat-housing)',
      'Insurance': 'var(--cat-insurance)',
      'Transport': 'var(--cat-transport)',
      'Groceries': 'var(--cat-groceries)',
      'Dining & leisure': 'var(--cat-dining)',
      'Shopping & other': 'var(--cat-shopping)',
      'Subs': 'var(--cat-subs)',
      'Health': 'var(--cat-health)',
    };
    const order = ['Housing & utilities','Insurance','Transport','Groceries','Dining & leisure','Shopping & other','Subs','Health'];
    const entries = order.map(k => [k, grouped[k] || 0]).filter(([, v]) => v > 0);
    const total = entries.reduce((a, [, v]) => a + v, 0) || 1;

    list.innerHTML = entries.map(([k, v]) => {
      const pct = Math.round((v / total) * 100);
      return `<li><span class="dot" style="background:${colors[k] || '#A89779'}"></span>${k}<span class="amt">${A.fmt(v)}</span><span class="pct">${pct}%</span></li>`;
    }).join('') || `<li style="border:none; color: var(--ink-3); padding: 18px 0; justify-content:center;"><em>No categorised spending yet.</em></li>`;
  }

  function renderInsights() {
    // recompute the three insights based on data
    const s = A.get();
    const groceriesUnder = s.budgets.groceries > 0 && s.spending.groceries <= s.budgets.groceries;
    const diningOver = s.budgets.dining > 0 && s.spending.dining > s.budgets.dining;

    const set = (sel, v) => { const el = $(sel); if (el) el.innerHTML = v; };
    if (groceriesUnder) {
      set('[data-insight="achievement-body"]', `You spent <strong>CHF ${A.fmt(s.spending.groceries)}</strong> against your <strong>CHF ${A.fmt(s.budgets.groceries)}</strong> grocery target.`);
    } else {
      set('[data-insight="achievement-body"]', `Set a grocery budget on the Overview to start tracking against a target.`);
    }
    if (diningOver) {
      const over = s.spending.dining - s.budgets.dining;
      set('[data-insight="drift-body"]', `CHF ${A.fmt(s.spending.dining)} vs CHF ${A.fmt(s.budgets.dining)} target — <strong>CHF ${A.fmt(over)}</strong> over. Worth a glance.`);
    } else {
      set('[data-insight="drift-body"]', `Dining within budget. CHF ${A.fmt(s.spending.dining)} vs CHF ${A.fmt(s.budgets.dining)} target.`);
    }
  }

  function renderMobileBills() {
    const list = $('[data-list="mobile-bills"]');
    if (!list) return;
    const today = new Date();
    const month = today.toLocaleString('en-US', { month: 'short' });
    const items = A.get().bills.filter(b => b.status === 'upcoming').slice(0, 3);
    list.innerHTML = items.map((b, i) => {
      const inDays = Math.max(0, b.dueDay - today.getDate());
      return `
      <div class="m-bill">
        <div class="day-chip"><div><span>${month}</span><span class="d">${b.dueDay}</span></div></div>
        <div class="name">${escapeHtml(b.vendor)}<span class="sub">${escapeHtml(b.category)} · in ${inDays} day${inDays === 1 ? '' : 's'}</span></div>
        <div class="amt">${A.fmt(b.amount)}</div>
      </div>`;
    }).join('') || '<div class="card-sub" style="padding:8px 0;">No upcoming bills.</div>';
  }

  function renderMobileBudgets() {
    const wrap = $('[data-list="mobile-budgets"]');
    if (!wrap) return;
    const s = A.get();
    const items = [
      { key: 'groceries', label: 'Groceries', color: 'var(--cat-groceries)' },
      { key: 'dining',    label: 'Dining & leisure', color: 'var(--accent)' },
      { key: 'shopping',  label: 'Shopping', color: 'var(--cat-shopping)' },
    ];
    wrap.innerHTML = items.map(x => {
      const spent = s.spending[x.key] || 0;
      const budget = s.budgets[x.key] || 0;
      const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
      const over = budget > 0 && spent > budget;
      return `
      <div class="m-budget">
        <div class="top">
          <span>${x.label}</span>
          <span class="v">${A.fmt(spent)} / ${A.fmt(budget)}${over ? ' · over' : ''}</span>
        </div>
        <div class="bar"><span style="width:${pct}%; background:${over ? 'var(--accent)' : x.color};"></span></div>
      </div>`;
    }).join('');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  }

  // ── settings: reset link ──
  function wireGlobals() {
    $$('[data-action="reset"]').forEach(el => el.addEventListener('click', (e) => {
      e.preventDefault();
      if (!confirm('Clear all your data and restart onboarding?')) return;
      A.reset();
      go('onboarding.html');
    }));
    $$('[data-action="load-demo"]').forEach(el => el.addEventListener('click', (e) => {
      e.preventDefault();
      A.loadDemo();
      go('index.html');
    }));

    // dynamic greeting / date
    $$('[data-greeting]').forEach(el => el.textContent = A.greeting());
    $$('[data-today]').forEach(el => el.textContent = A.todayLabel());
    $$('[data-month]').forEach(el => el.textContent = A.monthLabel());
  }

  // ── onboarding ──
  const Onboarding = {
    step: 1,
    total: 6,
    start() {
      this.step = 1;
      this.render();
      $('[data-onb-next]').addEventListener('click', () => this.next());
      $('[data-onb-back]').addEventListener('click', () => this.back());
      $('[data-onb-skip]').addEventListener('click', () => { this.commit(); go('index.html'); });
      $('[data-onb-demo]').addEventListener('click', () => { A.loadDemo(); go('index.html'); });

      // live-bind every input on the form
      $$('[data-field]').forEach(el => {
        const path = el.getAttribute('data-field');
        const v = read(A.get(), path);
        el.value = v == null ? '' : v;
        el.addEventListener('input', () => {
          const val = isNumericField(el) ? parseFloat(el.value) || 0 : el.value;
          A.update(pathToObject(path, val));
          this.updateCalc();
        });
      });

      // bill list
      this.renderBills();
      $('[data-onb-add-bill]').addEventListener('click', () => this.addBill());
    },
    render() {
      $$('[data-step]').forEach(el => {
        el.style.display = (parseInt(el.dataset.step, 10) === this.step) ? '' : 'none';
      });
      $('[data-onb-progress]').style.width = ((this.step / this.total) * 100) + '%';
      $('[data-onb-step]').textContent = `Step ${this.step} of ${this.total}`;
      $('[data-onb-back]').style.visibility = this.step === 1 ? 'hidden' : '';
      $('[data-onb-next]').textContent = this.step === this.total ? 'Open dashboard' : 'Next →';
      this.updateCalc();
    },
    next() {
      if (this.step < this.total) { this.step++; this.render(); }
      else { this.commit(); go('index.html'); }
    },
    back() {
      if (this.step > 1) { this.step--; this.render(); }
    },
    commit() {
      A.update({ onboarded: true, profile: { startedAt: new Date().toISOString() } });
    },
    updateCalc() {
      const d = A.derived();
      const set = (sel, v) => { const el = $(sel); if (el) el.textContent = v; };
      set('[data-onb-calc="net"]', A.fmt(d.netMonthly));
      set('[data-onb-calc="brutto"]', A.fmt(d.brutto));
      set('[data-onb-calc="deductions"]', A.fmt(d.ahv + d.bvg));
      set('[data-onb-calc="side"]', A.fmt(d.side));
      set('[data-onb-calc="fixed"]', A.fmt(d.totalFixed));
      set('[data-onb-calc="budget-total"]', A.fmt(d.budgetTotal));
      set('[data-onb-calc="firstname"]', A.get().profile.firstName || 'there');
    },
    renderBills() {
      const list = $('[data-onb-bills]');
      if (!list) return;
      const items = A.get().bills;
      if (!items.length) {
        list.innerHTML = '<div class="card-sub" style="padding:10px 0;">No bills yet. Add the ones that hit your account every month.</div>';
        return;
      }
      list.innerHTML = items.map(b => `
        <div class="row" style="gap: 12px; padding: 10px 0; border-bottom: 1px dashed var(--rule);">
          <div class="day-chip"><div><span>day</span><span class="d">${b.dueDay}</span></div></div>
          <div style="flex:1;">
            <div style="font-weight:500; font-size:14.5px;">${escapeHtml(b.vendor)}</div>
            <div class="card-sub" style="margin:2px 0 0;">${escapeHtml(b.category)}</div>
          </div>
          <div class="num-m">${A.fmt(b.amount)}</div>
          <button data-remove-bill="${b.id}" style="background:none; border:0; color: var(--ink-3); cursor:pointer; font-size:20px; padding: 0 6px;">×</button>
        </div>
      `).join('');

      $$('[data-remove-bill]', list).forEach(btn => btn.addEventListener('click', () => {
        A.update({ bills: A.get().bills.filter(b => b.id !== btn.dataset.removeBill) });
        this.renderBills();
        this.updateCalc();
      }));
    },
    addBill() {
      const vendor = $('[data-onb-bill-vendor]').value.trim();
      const category = $('[data-onb-bill-category]').value;
      const amount = parseFloat($('[data-onb-bill-amount]').value);
      const dueDay = parseInt($('[data-onb-bill-day]').value, 10);
      if (!vendor || !isFinite(amount) || !isFinite(dueDay)) {
        alert('Please fill vendor, amount and due day.');
        return;
      }
      A.update({
        bills: [
          ...A.get().bills,
          { id: A.uid(), vendor, category, amount, dueDay, status: 'upcoming' },
        ],
      });
      $('[data-onb-bill-vendor]').value = '';
      $('[data-onb-bill-amount]').value = '';
      $('[data-onb-bill-day]').value = '';
      this.renderBills();
      this.updateCalc();
    },
  };

  // ── boot ──
  function boot() {
    const p = page();

    // Gate: if not onboarded, force onboarding (except onboarding/mobile preview)
    if (GATED.has(p) && !A.get().onboarded) {
      // tiny note — onboarding will run from onboarding.html
      go('onboarding.html');
      return;
    }

    wireGlobals();
    bind();
    if (pages[p]) pages[p]();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
