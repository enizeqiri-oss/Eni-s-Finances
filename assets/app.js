// Eni's Finances · page bootstrap, bindings, modals, OCR-lite

(function () {
  'use strict';
  const A = window.Eni;
  if (!A) { console.error('[enifin] state.js missing'); return; }

  const GATED = new Set(['overview', 'income', 'bills', 'upload', 'summary', 'mobile']);

  function page() { return document.body.getAttribute('data-page') || ''; }
  function go(path) { location.href = path; }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  // ─── Toasts ───────────────────────────────────────
  function toast(msg, kind) {
    let stack = $('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      document.body.appendChild(stack);
    }
    const el = document.createElement('div');
    el.className = 'toast-msg' + (kind ? ' ' + kind : '');
    el.textContent = msg;
    stack.appendChild(el);
    requestAnimationFrame(() => el.classList.add('open'));
    setTimeout(() => {
      el.classList.remove('open');
      setTimeout(() => el.remove(), 240);
    }, 2800);
  }

  // ─── Modal ────────────────────────────────────────
  // openModal({ title, sub?, content: HTMLElement|string, primaryLabel, onSubmit(modalRoot) → boolean|void })
  function openModal(opts) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="${escapeAttr(opts.title || '')}">
        <h2>${escapeHtml(opts.title || '')}</h2>
        ${opts.sub ? `<div class="sub">${escapeHtml(opts.sub)}</div>` : ''}
        <div class="modal-body"></div>
        <div class="actions">
          <button type="button" class="btn-ghost" data-modal-cancel>${escapeHtml(opts.cancelLabel || 'Abbrechen')}</button>
          <button type="button" class="btn-primary" data-modal-submit>${escapeHtml(opts.primaryLabel || 'Speichern')}</button>
        </div>
      </div>`;
    const root = backdrop.querySelector('.modal');
    const body = backdrop.querySelector('.modal-body');
    if (typeof opts.content === 'string') body.innerHTML = opts.content;
    else if (opts.content) body.appendChild(opts.content);

    document.body.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add('open'));

    const close = () => {
      backdrop.classList.remove('open');
      setTimeout(() => backdrop.remove(), 200);
      document.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Enter' && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) {
        // allow enter inside select/input to submit, but not textarea
        e.preventDefault();
        submit();
      }
    };
    const submit = () => {
      const ok = opts.onSubmit ? opts.onSubmit(root) : true;
      if (ok !== false) close();
    };
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
    backdrop.querySelector('[data-modal-cancel]').addEventListener('click', close);
    backdrop.querySelector('[data-modal-submit]').addEventListener('click', submit);
    document.addEventListener('keydown', onKey);

    // autofocus first input
    const first = body.querySelector('input,select,textarea');
    if (first) setTimeout(() => first.focus(), 80);

    return { close, root };
  }

  // segmented chip group: <div class="seg" data-name="category">…</div>
  function makeSegmented(name, options, current) {
    const cur = current || options[0].value;
    return `<div class="seg" data-name="${escapeAttr(name)}" data-value="${escapeAttr(cur)}">
      ${options.map(o => `
        <button type="button" data-val="${escapeAttr(o.value)}" class="${o.value === cur ? 'active' : ''}">${escapeHtml(o.label)}</button>
      `).join('')}
    </div>`;
  }
  function wireSegmented(root) {
    $$('.seg', root).forEach(seg => {
      seg.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-val]');
        if (!btn) return;
        $$('button', seg).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        seg.setAttribute('data-value', btn.dataset.val);
      });
    });
  }
  function segValue(root, name) {
    const seg = root.querySelector(`.seg[data-name="${name}"]`);
    return seg ? seg.getAttribute('data-value') : null;
  }

  // ─── Add transaction modal ─────────────────────────
  function openAddTransactionModal() {
    const today = new Date().toISOString().slice(0, 10);
    const categories = A.TX_CATEGORIES.map(k => ({ value: k, label: A.catLabel(k) }));
    const content = `
      <div class="form-grid">
        <div class="field full">
          <span class="label">Verkäufer</span>
          <input data-k="vendor" placeholder="z.B. Migros, Coop, SBB">
        </div>
        <div class="field">
          <span class="label">Betrag</span>
          <input data-k="amount" inputmode="decimal" placeholder="25.00"><span class="suffix">CHF</span>
        </div>
        <div class="field">
          <span class="label">Datum</span>
          <input data-k="date" type="date" value="${today}">
        </div>
        <div class="full">
          <span class="label">Art</span>
          ${makeSegmented('type', [{value:'out',label:'Ausgabe'},{value:'in',label:'Einnahme'}], 'out')}
        </div>
        <div class="full">
          <span class="label">Kategorie</span>
          ${makeSegmented('category', categories, 'Groceries')}
        </div>
      </div>
    `;
    openModal({
      title: 'Transaktion hinzufügen',
      sub: 'Diese Bewegung erscheint sofort unter „Letzte Aktivität".',
      primaryLabel: 'Hinzufügen',
      content,
      onSubmit(root) {
        wireSegmented(root); // safe no-op if already wired
        const vendor = root.querySelector('[data-k="vendor"]').value.trim();
        const raw = parseFloat(root.querySelector('[data-k="amount"]').value);
        const date = root.querySelector('[data-k="date"]').value;
        const type = segValue(root, 'type');
        const category = segValue(root, 'category');
        if (!vendor) { toast('Bitte einen Verkäufer eingeben.', 'error'); return false; }
        if (!isFinite(raw) || raw <= 0) { toast('Bitte einen Betrag > 0 eingeben.', 'error'); return false; }
        const amount = type === 'in' ? Math.abs(raw) : -Math.abs(raw);
        A.addTransaction({ vendor, amount, date, category });
        toast('Transaktion gespeichert.', 'success');
        bind();
        renderOverview();
      },
    });
    // wire segmented immediately so initial clicks work even before submit
    wireSegmented(document);
  }

  // ─── Add bill modal ────────────────────────────────
  function openAddBillModal(prefill) {
    const cats = A.BILL_CATEGORIES.map(k => ({ value: k, label: A.catLabel(k) }));
    const p = prefill || {};
    const content = `
      <div class="form-grid">
        <div class="field full">
          <span class="label">Anbieter / Bezeichnung</span>
          <input data-k="vendor" placeholder="z.B. Krankenkasse Helsana" value="${escapeAttr(p.vendor || '')}">
        </div>
        <div class="field">
          <span class="label">Betrag</span>
          <input data-k="amount" inputmode="decimal" placeholder="0.00" value="${p.amount != null ? p.amount : ''}"><span class="suffix">CHF / Monat</span>
        </div>
        <div class="field">
          <span class="label">Fälligkeit</span>
          <input data-k="dueDay" inputmode="numeric" placeholder="Tag im Monat (1–28)" value="${p.dueDay != null ? p.dueDay : ''}">
        </div>
        <div class="full">
          <span class="label">Kategorie</span>
          ${makeSegmented('category', cats, p.category || 'Subs')}
        </div>
        <div class="full">
          <span class="label">Status</span>
          ${makeSegmented('status', [{value:'upcoming',label:'Anstehend'},{value:'paid',label:'Bezahlt'}], p.status || 'upcoming')}
        </div>
      </div>
    `;
    openModal({
      title: prefill ? 'Rechnung hinzufügen' : 'Neue Rechnung',
      sub: prefill ? 'Vorgefüllt aus dem Beleg – prüfe die Felder und speichere.' : 'Wiederkehrende monatliche Belastung.',
      primaryLabel: 'Speichern',
      content,
      onSubmit(root) {
        wireSegmented(root);
        const vendor = root.querySelector('[data-k="vendor"]').value.trim();
        const amount = parseFloat(root.querySelector('[data-k="amount"]').value);
        const dueDay = parseInt(root.querySelector('[data-k="dueDay"]').value, 10);
        const category = segValue(root, 'category');
        const status = segValue(root, 'status');
        if (!vendor) { toast('Bitte einen Anbieter eingeben.', 'error'); return false; }
        if (!isFinite(amount) || amount <= 0) { toast('Bitte einen Betrag eingeben.', 'error'); return false; }
        if (!isFinite(dueDay) || dueDay < 1 || dueDay > 31) { toast('Fälligkeit zwischen 1 und 31.', 'error'); return false; }
        A.addBill({ vendor, amount, dueDay, category, status });
        toast('Rechnung gespeichert.', 'success');
        bind();
        renderBillsTable(currentFilter || 'all');
      },
    });
    wireSegmented(document);
  }

  // ─── Binding ──────────────────────────────────────
  function bind() {
    const s = A.get();
    const d = A.derived();
    const ctx = { ...s, ...d };

    $$('[data-bind]').forEach(el => {
      const path = el.getAttribute('data-bind');
      const fmt = el.getAttribute('data-fmt') || 'text';
      const v = read(ctx, path);
      const out = format(v, fmt);
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.value = out;
      else el.textContent = out;
    });

    $$('[data-bind-html]').forEach(el => {
      el.innerHTML = String(read(ctx, el.getAttribute('data-bind-html')) ?? '');
    });

    $$('[data-bind-width]').forEach(el => {
      const w = ratioPercent(ctx, el.getAttribute('data-bind-width'));
      el.style.width = Math.min(100, Math.max(0, w)) + '%';
    });

    $$('[data-show-if]').forEach(el => {
      const v = read(ctx, el.getAttribute('data-show-if'));
      el.style.display = v ? '' : 'none';
    });
    $$('[data-hide-if]').forEach(el => {
      const v = read(ctx, el.getAttribute('data-hide-if'));
      el.style.display = v ? 'none' : '';
    });
  }

  function read(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }
  function ratioPercent(ctx, expr) {
    const [n, d] = expr.split('/').map(s => s.trim());
    const a = parseFloat(read(ctx, n)) || 0;
    const b = parseFloat(read(ctx, d)) || 0;
    return b === 0 ? 0 : (a / b) * 100;
  }
  function format(v, kind) {
    if (v === undefined || v === null) return '';
    if (kind === 'text') return String(v);
    if (kind === 'num')  return A.fmt(v);
    if (kind === 'num2') return A.fmt(v, { decimals: 2 });
    if (kind === 'pct')  return A.fmtPct(v);
    if (kind === 'pct1') return A.fmtPct(v, 1);
    if (kind === 'signed') return A.fmt(v, { signed: true });
    if (kind === 'amt')  return A.fmt(v, { decimals: (Math.round(v) === v ? 0 : 2) });
    return String(v);
  }

  // ─── Per-page wiring ──────────────────────────────
  let currentFilter = 'all';

  const pages = {
    overview() {
      renderOverview();
      $('[data-action="add-tx"]')?.addEventListener('click', (e) => {
        e.preventDefault();
        openAddTransactionModal();
      });
      $$('[data-action="add-tx-inline"]').forEach(el => el.addEventListener('click', (e) => {
        e.preventDefault();
        openAddTransactionModal();
      }));
    },

    income() {
      $$('[data-field]').forEach(el => {
        const path = el.getAttribute('data-field');
        const v = read(A.get(), path);
        el.value = v == null ? '' : v;
        el.addEventListener('input', () => {
          const val = isNumericField(el) ? parseFloat(el.value) || 0 : el.value;
          A.update(pathToObject(path, val));
          bind();
          renderCalc();
        });
      });
      renderCalc();
    },

    bills() {
      renderBillsTable('all');
      $('[data-action="add-bill"]')?.addEventListener('click', () => openAddBillModal());
      $$('.chip-btn').forEach(c => c.addEventListener('click', () => {
        $$('.chip-btn').forEach(x => x.classList.remove('active'));
        c.classList.add('active');
        currentFilter = c.dataset.filter || 'all';
        renderBillsTable(currentFilter);
      }));
    },

    summary() {
      renderCategoryBreakdown();
      renderInsights();
    },

    upload() {
      Upload.init();
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
    for (let i = 0; i < parts.length - 1; i++) { cur[parts[i]] = {}; cur = cur[parts[i]]; }
    cur[parts[parts.length - 1]] = value;
    return out;
  }

  // ─── Renderers ────────────────────────────────────
  function renderOverview() {
    renderUpcomingBills();
    renderTransactions();
    renderSpendingDonut();
  }

  function renderUpcomingBills() {
    const list = $('[data-list="upcoming-bills"]');
    if (!list) return;
    const month = A.monthShort();
    const items = A.get().bills
      .filter(b => b.status === 'upcoming')
      .sort((a, b) => a.dueDay - b.dueDay)
      .slice(0, 3);
    if (!items.length) {
      list.innerHTML = '<div class="card-sub" style="padding:8px 0;">Keine anstehenden Rechnungen.</div>';
      return;
    }
    list.innerHTML = items.map((b, i) => `
      <div class="row" style="gap:14px; padding:8px 0;${i ? 'border-top:1px solid var(--rule);' : ''}">
        <div class="day-chip"><div><span>${month}</span><span class="d">${b.dueDay}</span></div></div>
        <div style="flex:1;">
          <div style="font-weight:500; font-size:14.5px;">${escapeHtml(b.vendor)}</div>
          <div class="card-sub" style="margin:2px 0 0;">${escapeHtml(A.catLabel(b.category))}</div>
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
      list.innerHTML = '<div class="card-sub" style="padding:8px 0;">Noch keine Bewegungen — füge eine über „+ Transaktion" hinzu.</div>';
      return;
    }
    const colors = {
      Groceries: '#9DA978', Dining: '#C66A4E', Income: '#1A1815', Shopping: '#A89779',
      Transport: '#7A8FA8', Health: '#C4A571', Leisure: '#9C7BA0', Subs: '#9C7BA0',
    };
    list.innerHTML = items.map(t => {
      const c = colors[t.category] || '#A89779';
      const positive = t.amount >= 0;
      const amt = Math.abs(t.amount);
      const dec = amt % 1 ? 2 : 0;
      return `
      <div style="display:grid; grid-template-columns: 10px 1fr auto; gap:10px; align-items:center; padding:9px 0; border-bottom:1px dashed var(--rule);">
        <span class="dot" style="background:${c}"></span>
        <div>
          <div style="font-weight:500; font-size:14px;">${escapeHtml(t.vendor)}</div>
          <div class="card-sub" style="margin:2px 0 0;">${formatDate(t.date)} · ${escapeHtml(A.catLabel(t.category))}</div>
        </div>
        <div class="num-m" style="color: ${positive ? '#3D5A33' : 'var(--accent)'};">${positive ? '+' : '−'}${A.fmt(amt, { decimals: dec })}</div>
      </div>`;
    }).join('');
  }

  function renderSpendingDonut() {
    const wrap = $('[data-donut="spending"]');
    if (!wrap) return;
    const s = A.get().spending;
    const segs = [
      { key: 'groceries', color: '#9DA978', label: 'Lebensmittel' },
      { key: 'dining',    color: '#C66A4E', label: 'Restaurants' },
      { key: 'shopping',  color: '#A89779', label: 'Einkauf' },
      { key: 'leisure',   color: '#9C7BA0', label: 'Freizeit' },
      { key: 'transport', color: '#7A8FA8', label: 'Transport' },
    ];
    const total = segs.reduce((a, x) => a + (s[x.key] || 0), 0);
    const C = 2 * Math.PI * 56;
    let offset = 0;
    const circles = total > 0 ? segs.map(x => {
      const v = s[x.key] || 0;
      const len = (v / total) * C;
      const c = `<circle r="56" cx="80" cy="80" stroke="${x.color}" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="-${offset.toFixed(2)}" transform="rotate(-90 80 80)"/>`;
      offset += len;
      return c;
    }).join('') : `<circle r="56" cx="80" cy="80" stroke="#E5DCC2" fill="none" stroke-width="22"/>`;
    const legend = segs.map(x => {
      const v = s[x.key] || 0;
      const pct = total > 0 ? Math.round((v / total) * 100) : 0;
      return `<li><span class="dot" style="background:${x.color}"></span>${x.label}<span class="amt">${A.fmt(v)}</span><span class="pct">${pct}%</span></li>`;
    }).join('');
    wrap.innerHTML = `
      <svg viewBox="0 0 160 160" width="148" height="148" aria-label="Ausgaben Donut">
        <g fill="none" stroke-width="22">${circles}</g>
        <text x="80" y="76" text-anchor="middle" font-family="Newsreader, serif" font-size="22" fill="#1A1815">${A.fmt(total)}</text>
        <text x="80" y="94" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="9" fill="#8A8472" letter-spacing="1">VARIABEL</text>
      </svg>
      <ul class="cats" style="flex:1;">${legend}</ul>
    `;
  }

  function renderBillsTable(filter) {
    const tbody = $('[data-list="bills"]');
    if (!tbody) return;
    const f = (filter || 'all').toLowerCase();
    const month = A.monthShort();
    let bills = A.get().bills.slice().sort((a, b) => a.dueDay - b.dueDay);
    if (f !== 'all') bills = bills.filter(b => (b.category || '').toLowerCase() === f);
    if (!bills.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="padding:30px 0; text-align:center; color: var(--ink-3);"><em>Keine Rechnungen — füge eine über „+ Neue Rechnung" hinzu.</em></td></tr>`;
      return;
    }
    tbody.innerHTML = bills.map(b => `
      <tr data-id="${b.id}">
        <td>
          <div class="vendor">
            <div class="vicon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="5" width="16" height="14" rx="2"/></svg></div>
            <div><div class="vname">${escapeHtml(b.vendor)}</div><div class="vsub">monatlich · Lastschrift</div></div>
          </div>
        </td>
        <td>${escapeHtml(A.catLabel(b.category))}</td>
        <td class="mono" style="font-size:13px;">${String(b.dueDay).padStart(2,'0')} ${month}</td>
        <td>
          <button class="pill ${b.status === 'paid' ? 'paid' : 'upcoming'}" data-toggle-bill="${b.id}" style="border:0; cursor:pointer;">${b.status === 'paid' ? 'bezahlt' : 'anstehend'}</button>
        </td>
        <td class="amt">${A.fmt(b.amount, { decimals: 2 })}</td>
        <td class="more">
          <button data-edit-bill="${b.id}" title="Bearbeiten" style="background:none; border:0; color: var(--ink-3); cursor:pointer; padding: 0 4px;">✎</button>
          <button data-remove-bill="${b.id}" title="Löschen" style="background:none; border:0; color: var(--ink-3); cursor:pointer; font-size:18px; padding: 0 4px;">×</button>
        </td>
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
      const bill = A.get().bills.find(b => b.id === id);
      if (!bill) return;
      if (!confirm(`„${bill.vendor}" wirklich löschen?`)) return;
      A.update({ bills: A.get().bills.filter(b => b.id !== id) });
      bind();
      renderBillsTable(f);
      toast('Rechnung gelöscht.', 'success');
    }));
    $$('[data-edit-bill]', tbody).forEach(btn => btn.addEventListener('click', () => {
      const id = btn.dataset.editBill;
      const bill = A.get().bills.find(b => b.id === id);
      if (!bill) return;
      openEditBillModal(bill);
    }));
  }

  function openEditBillModal(bill) {
    const cats = A.BILL_CATEGORIES.map(k => ({ value: k, label: A.catLabel(k) }));
    const content = `
      <div class="form-grid">
        <div class="field full">
          <span class="label">Anbieter</span>
          <input data-k="vendor" value="${escapeAttr(bill.vendor)}">
        </div>
        <div class="field">
          <span class="label">Betrag</span>
          <input data-k="amount" inputmode="decimal" value="${bill.amount}"><span class="suffix">CHF / Monat</span>
        </div>
        <div class="field">
          <span class="label">Fälligkeit</span>
          <input data-k="dueDay" inputmode="numeric" value="${bill.dueDay}">
        </div>
        <div class="full">
          <span class="label">Kategorie</span>
          ${makeSegmented('category', cats, bill.category)}
        </div>
        <div class="full">
          <span class="label">Status</span>
          ${makeSegmented('status', [{value:'upcoming',label:'Anstehend'},{value:'paid',label:'Bezahlt'}], bill.status)}
        </div>
      </div>
    `;
    openModal({
      title: 'Rechnung bearbeiten',
      primaryLabel: 'Aktualisieren',
      content,
      onSubmit(root) {
        wireSegmented(root);
        const patch = {
          vendor: root.querySelector('[data-k="vendor"]').value.trim() || bill.vendor,
          amount: parseFloat(root.querySelector('[data-k="amount"]').value) || bill.amount,
          dueDay: parseInt(root.querySelector('[data-k="dueDay"]').value, 10) || bill.dueDay,
          category: segValue(root, 'category'),
          status: segValue(root, 'status'),
        };
        const bills = A.get().bills.map(b => b.id === bill.id ? { ...b, ...patch } : b);
        A.update({ bills });
        toast('Rechnung aktualisiert.', 'success');
        bind();
        renderBillsTable(currentFilter || 'all');
      },
    });
    wireSegmented(document);
  }

  function renderCalc() {
    const d = A.derived();
    const set = (sel, v) => { const el = $(sel); if (el) el.textContent = v; };
    set('[data-calc="brutto"]', A.fmt(d.brutto));
    set('[data-calc="ahv"]',    '−' + A.fmt(d.ahv));
    set('[data-calc="bvg"]',    '−' + A.fmt(d.bvg));
    set('[data-calc="3a"]',     '−' + A.fmt(A.get().taxes.saule3a));
    set('[data-calc="tax"]',    '−' + A.fmt(d.brutto * (A.get().taxes.taxRate / 100)));
    set('[data-calc="side"]',   '+' + A.fmt(d.side));
    set('[data-calc="net"]',    A.fmt(d.netMonthly));
    set('[data-calc="annual"]', A.fmt(d.netMonthly * 12));
    set('[data-calc="ahv-rate-pct"]', A.fmtPct(A.get().taxes.ahvRate, 1));
    set('[data-calc="tax-rate-pct"]', A.fmtPct(A.get().taxes.taxRate, 1));
  }

  function renderCategoryBreakdown() {
    const list = $('[data-list="categories"]');
    if (!list) return;
    const s = A.get();
    const bills = s.bills;
    const grouped = {};
    bills.forEach(b => { grouped[A.catLabel(b.category)] = (grouped[A.catLabel(b.category)] || 0) + (parseFloat(b.amount) || 0); });
    // merge variable spending into labels
    grouped[A.catLabel('Groceries')] = (grouped[A.catLabel('Groceries')] || 0) + (s.spending.groceries || 0);
    const diningLeisure = (s.spending.dining || 0) + (s.spending.leisure || 0);
    if (diningLeisure) grouped['Restaurants & Freizeit'] = (grouped['Restaurants & Freizeit'] || 0) + diningLeisure;
    grouped[A.catLabel('Transport')] = (grouped[A.catLabel('Transport')] || 0) + (s.spending.transport || 0);
    grouped['Einkauf & Sonstiges']   = (grouped['Einkauf & Sonstiges'] || 0)   + (s.spending.shopping || 0);

    // merge Housing + Utilities under one label
    const housing = (grouped[A.catLabel('Housing')] || 0) + (grouped[A.catLabel('Utilities')] || 0);
    delete grouped[A.catLabel('Housing')]; delete grouped[A.catLabel('Utilities')];
    if (housing) grouped['Wohnen & Energie'] = housing;

    const colors = {
      'Wohnen & Energie':       'var(--cat-housing)',
      'Versicherung':           'var(--cat-insurance)',
      'Transport':              'var(--cat-transport)',
      'Lebensmittel':           'var(--cat-groceries)',
      'Restaurants & Freizeit': 'var(--cat-dining)',
      'Einkauf & Sonstiges':    'var(--cat-shopping)',
      'Abos':                   'var(--cat-subs)',
      'Gesundheit':             'var(--cat-health)',
    };
    const order = ['Wohnen & Energie','Versicherung','Transport','Lebensmittel','Restaurants & Freizeit','Einkauf & Sonstiges','Abos','Gesundheit'];
    const entries = order.map(k => [k, grouped[k] || 0]).filter(([, v]) => v > 0);
    const total = entries.reduce((a, [, v]) => a + v, 0) || 1;

    list.innerHTML = entries.map(([k, v]) => {
      const pct = Math.round((v / total) * 100);
      return `<li><span class="dot" style="background:${colors[k] || '#A89779'}"></span>${k}<span class="amt">${A.fmt(v)}</span><span class="pct">${pct}%</span></li>`;
    }).join('') || `<li style="border:none; color: var(--ink-3); padding: 18px 0; justify-content:center;"><em>Noch keine kategorisierten Ausgaben.</em></li>`;
  }

  function renderInsights() {
    const s = A.get();
    const set = (sel, v) => { const el = $(sel); if (el) el.innerHTML = v; };
    const groceriesUnder = s.budgets.groceries > 0 && s.spending.groceries <= s.budgets.groceries;
    const diningOver = s.budgets.dining > 0 && s.spending.dining > s.budgets.dining;

    if (groceriesUnder) {
      set('[data-insight="achievement-body"]', `Du hast <strong>CHF ${A.fmt(s.spending.groceries)}</strong> gegen dein Ziel von <strong>CHF ${A.fmt(s.budgets.groceries)}</strong> ausgegeben.`);
    } else {
      set('[data-insight="achievement-body"]', `Lege im Onboarding ein Lebensmittel-Budget fest, um es hier zu verfolgen.`);
    }
    if (diningOver) {
      const over = s.spending.dining - s.budgets.dining;
      set('[data-insight="drift-body"]', `CHF ${A.fmt(s.spending.dining)} vs. CHF ${A.fmt(s.budgets.dining)} Ziel — <strong>CHF ${A.fmt(over)}</strong> über. Ein Blick lohnt sich.`);
    } else {
      set('[data-insight="drift-body"]', `Restaurants im Budget. CHF ${A.fmt(s.spending.dining)} vs. CHF ${A.fmt(s.budgets.dining)} Ziel.`);
    }
  }

  function renderMobileBills() {
    const list = $('[data-list="mobile-bills"]');
    if (!list) return;
    const today = new Date();
    const month = A.monthShort();
    const items = A.get().bills.filter(b => b.status === 'upcoming').sort((a, b) => a.dueDay - b.dueDay).slice(0, 3);
    if (!items.length) { list.innerHTML = '<div class="card-sub" style="padding:8px 0;">Nichts anstehend.</div>'; return; }
    list.innerHTML = items.map(b => {
      const inDays = Math.max(0, b.dueDay - today.getDate());
      return `
      <div class="m-bill">
        <div class="day-chip"><div><span>${month}</span><span class="d">${b.dueDay}</span></div></div>
        <div class="name">${escapeHtml(b.vendor)}<span class="sub">${escapeHtml(A.catLabel(b.category))} · in ${inDays} Tag${inDays === 1 ? '' : 'en'}</span></div>
        <div class="amt">${A.fmt(b.amount)}</div>
      </div>`;
    }).join('');
  }

  function renderMobileBudgets() {
    const wrap = $('[data-list="mobile-budgets"]');
    if (!wrap) return;
    const s = A.get();
    const items = [
      { key: 'groceries', label: 'Lebensmittel',   color: 'var(--cat-groceries)' },
      { key: 'dining',    label: 'Restaurants',    color: 'var(--accent)' },
      { key: 'shopping',  label: 'Einkauf',        color: 'var(--cat-shopping)' },
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
          <span class="v">${A.fmt(spent)} / ${A.fmt(budget)}${over ? ' · über' : ''}</span>
        </div>
        <div class="bar"><span style="width:${pct}%; background:${over ? 'var(--accent)' : x.color};"></span></div>
      </div>`;
    }).join('');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escapeAttr(s) { return escapeHtml(s); }
  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return `${d.getDate()}. ${A.monthShort(d)}`;
  }

  // ─── PDF upload + light "OCR" ─────────────────────
  const Upload = (function () {
    let pdfjsReady = null;

    function loadPdfJs() {
      if (pdfjsReady) return pdfjsReady;
      pdfjsReady = new Promise((resolve, reject) => {
        if (window.pdfjsLib) return resolve(window.pdfjsLib);
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        s.onload = () => {
          if (!window.pdfjsLib) return reject(new Error('pdfjsLib not on window'));
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          resolve(window.pdfjsLib);
        };
        s.onerror = () => reject(new Error('pdf.js failed to load'));
        document.head.appendChild(s);
      });
      return pdfjsReady;
    }

    async function extractPdfText(file) {
      const lib = await loadPdfJs();
      const buf = await file.arrayBuffer();
      const pdf = await lib.getDocument({ data: buf }).promise;
      let text = '';
      const max = Math.min(pdf.numPages, 4);
      for (let i = 1; i <= max; i++) {
        const page = await pdf.getPage(i);
        const tc = await page.getTextContent();
        text += tc.items.map(it => it.str).join(' ') + '\n';
      }
      return text;
    }

    // Pattern matching across common Swiss vendors
    const RULES = [
      { rx: /helsana|krankenkasse|sanitas|css|swica|kpt|sympany|atupri/i,                  vendor: 'Krankenkasse',         category: 'Insurance', bill: true },
      { rx: /\bmigros\b/i,                                                                 vendor: 'Migros',                category: 'Groceries', bill: false },
      { rx: /\bcoop\b/i,                                                                   vendor: 'Coop',                  category: 'Groceries', bill: false },
      { rx: /denner|aldi|lidl|spar(?!\w)/i,                                                vendor: '$0',                    category: 'Groceries', bill: false },
      { rx: /sbb|cff|ffs|generalabonnement|halbtax/i,                                      vendor: 'SBB',                   category: 'Transport', bill: true },
      { rx: /zvv|trams?|verkehrsbetriebe/i,                                                vendor: 'ZVV',                   category: 'Transport', bill: false },
      { rx: /\bsalt\b|swisscom|sunrise/i,                                                  vendor: 'Telekom',               category: 'Utilities', bill: true },
      { rx: /\bewz\b|elektriz|stromrechnung|stadtwerke|iwb|bkw|romande energie/i,          vendor: 'Elektrizitätswerk',     category: 'Utilities', bill: true },
      { rx: /spotify|netflix|disney|apple\s*music|youtube/i,                               vendor: '$0',                    category: 'Subs',      bill: true },
      { rx: /icloud|google one|dropbox|notion|adobe/i,                                     vendor: '$0',                    category: 'Subs',      bill: true },
      { rx: /holmes place|fitness|mcfit|migros fitness|basefit/i,                          vendor: 'Fitness',               category: 'Health',    bill: true },
      { rx: /apotheke|pharmacie|topwell|amavita/i,                                         vendor: 'Apotheke',              category: 'Health',    bill: false },
      { rx: /miete|loyer|rent\b/i,                                                         vendor: 'Miete',                 category: 'Housing',   bill: true },
      { rx: /serafe|billag/i,                                                              vendor: 'Serafe',                category: 'Subs',      bill: true },
      { rx: /restaurant|cafe|caf[eé]|hiltl|starbucks|mcdonald|burger|kebab|pizza|migros\s*restaurant/i,
                                                                                             vendor: '$0',                  category: 'Dining',    bill: false },
      { rx: /globus|manor|zara|h&m|uniqlo|ikea|amazon/i,                                  vendor: '$0',                    category: 'Shopping',  bill: false },
    ];

    function titleCase(s) {
      return String(s || '').toLowerCase().replace(/\b([a-zäöü])/g, m => m.toUpperCase());
    }

    function detect(text, filename) {
      const haystack = (text || '') + ' ' + (filename || '');
      let hit = null;
      for (const r of RULES) {
        const m = haystack.match(r.rx);
        if (m) {
          hit = { ...r, match: m[0] };
          break;
        }
      }
      // amount: prefer "Total" / "Betrag" / "CHF X.XX" patterns
      let amount = null;
      const amountRxs = [
        /(?:total|betrag|summe|amount|zu\s*bezahlen|f[äa]llig)[^0-9-]{0,12}(?:chf\s*)?([0-9]+(?:[’',\s.]?[0-9]{3})*(?:[.,][0-9]{2})?)/i,
        /chf\s*([0-9]+(?:[’',\s.]?[0-9]{3})*(?:[.,][0-9]{2}))/i,
        /([0-9]+(?:[’',\s.]?[0-9]{3})*[.,][0-9]{2})\s*chf/i,
      ];
      for (const rx of amountRxs) {
        const m = haystack.match(rx);
        if (m) {
          amount = parseFloat(m[1].replace(/[’',\s]/g, '').replace(',', '.'));
          if (isFinite(amount)) break;
        }
      }
      // date DD.MM.YYYY or DD/MM/YYYY
      let date = null;
      const dm = haystack.match(/\b(0?[1-9]|[12][0-9]|3[01])[.\-/](0?[1-9]|1[0-2])[.\-/](20\d{2})\b/);
      if (dm) {
        const dd = dm[1].padStart(2, '0');
        const mm = dm[2].padStart(2, '0');
        date = `${dm[3]}-${mm}-${dd}`;
      }

      const vendor = hit
        ? (hit.vendor === '$0' ? titleCase(hit.match) : hit.vendor)
        : (filename ? titleCase(filename.replace(/[-_]/g, ' ').replace(/\.[a-z]+$/i, '')) : 'Unbekannt');
      const category = hit ? hit.category : 'Other';
      const bill = hit ? !!hit.bill : false;

      // confidences
      const conf = {
        vendor: hit ? 95 : 60,
        amount: amount != null ? 92 : 40,
        date:   date   ? 90 : 50,
        category: hit ? 88 : 55,
      };

      return { vendor, category, amount, date, bill, conf, hit: !!hit };
    }

    // UI bits
    function setStatus(s) {
      const el = $('[data-up-status]');
      if (!el) return;
      el.textContent = s;
    }
    function setReceiptPreview(filename) {
      const el = $('[data-up-filename]');
      if (el) el.textContent = filename;
    }
    function setField(key, value, confidence) {
      const v = $(`[data-up-field="${key}"] .v`);
      if (v) v.textContent = value == null ? '—' : value;
      const c = $(`[data-up-field="${key}"] .conf`);
      if (c) {
        c.innerHTML = `<span class="bar"><span style="width:${confidence}%"></span></span>${confidence}`;
        c.classList.toggle('warn', confidence < 90);
      }
    }
    function paintReading() {
      ['vendor','amount','date','category','bucket'].forEach(k => setField(k, '…', 30));
    }

    function applyResult(result, filename) {
      const amount = result.amount != null ? `CHF ${A.fmt(result.amount, { decimals: 2 })}` : null;
      const date   = result.date ? formatLong(result.date) : null;
      setField('vendor',   result.vendor,                          result.conf.vendor);
      setField('amount',   amount || '—',                           result.conf.amount);
      setField('date',     date || '—',                             result.conf.date);
      setField('category', A.catLabel(result.category),             result.conf.category);
      setField('bucket',   result.bill ? `Fixkosten · ${A.monthLabel()}` : `Variabel · ${A.monthLabel()}`, 100);

      // store last result so confirm-tx knows what to file
      window.__upLast = { ...result, filename };
    }
    function formatLong(iso) {
      const d = new Date(iso + 'T00:00:00');
      if (isNaN(d.getTime())) return iso;
      return `${d.getDate()}. ${A.monthShort(d)} ${d.getFullYear()}`;
    }

    async function handleFile(file) {
      if (!file) return;
      setReceiptPreview(file.name);
      paintReading();
      setStatus('lese');
      let text = '';
      let imageDataUrl = null;
      try {
        if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
          text = await extractPdfText(file);
        } else if (/^image\//.test(file.type)) {
          imageDataUrl = await readAsDataURL(file);
        }
      } catch (e) {
        console.warn('[upload] parse failed', e);
        toast('PDF konnte nicht gelesen werden — wir versuchen es mit dem Dateinamen.', 'error');
      }
      const result = Upload.detect(text, file.name);
      applyResult(result, file.name);
      setStatus(result.hit ? 'erkannt' : 'gelesen');

      // optional thumbnail preview
      if (imageDataUrl) {
        const thumb = $('[data-up-thumb]');
        if (thumb) thumb.innerHTML = `<img src="${imageDataUrl}" alt="" style="width:100%; height:100%; object-fit:cover; border-radius:10px;">`;
      }
      // add to inbox list
      addInbox({
        filename: file.name,
        vendor: result.vendor,
        amount: result.amount,
        status: result.hit ? 'parsed' : 'reading',
      });
    }
    function readAsDataURL(file) {
      return new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
    }

    function addInbox(item) {
      const list = $('[data-up-inbox]');
      if (!list) return;
      const row = document.createElement('div');
      row.className = 'inbox-row';
      row.innerHTML = `
        <div class="fic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/></svg></div>
        <div>
          <div class="name">${escapeHtml(item.vendor)}</div>
          <div class="file">${escapeHtml(item.filename)}</div>
        </div>
        <div class="right">
          ${item.amount != null ? `<span class="amt">${A.fmt(item.amount, { decimals: 2 })}</span>` : ''}
          <span class="pill ${item.status}">${item.status === 'reading' ? 'lese…' : (item.status === 'parsed' ? 'geparst' : item.status)}</span>
        </div>`;
      list.prepend(row);
    }

    function init() {
      const dz = $('[data-up-dropzone]');
      const input = $('[data-up-input]');
      if (!dz) return;

      dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
      dz.addEventListener('dragleave', () => dz.classList.remove('over'));
      dz.addEventListener('drop', (e) => {
        e.preventDefault();
        dz.classList.remove('over');
        const f = e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) handleFile(f);
      });
      $('[data-up-choose]')?.addEventListener('click', () => input.click());
      input?.addEventListener('change', () => handleFile(input.files && input.files[0]));

      $('[data-action="confirm-tx"]')?.addEventListener('click', () => confirmCurrent());
      $('[data-action="edit-fields"]')?.addEventListener('click', () => editCurrentFields());
    }

    function confirmCurrent() {
      const r = window.__upLast;
      if (!r) { toast('Erst eine Datei einlesen.', 'error'); return; }
      if (r.bill) {
        if (r.amount == null) { toast('Betrag fehlt — bitte mit „Felder bearbeiten" ergänzen.', 'error'); return; }
        // Defaults for bill
        const today = new Date();
        const dueDay = r.date ? new Date(r.date + 'T00:00:00').getDate() : today.getDate();
        openAddBillModal({
          vendor: r.vendor,
          amount: r.amount,
          dueDay,
          category: r.category,
          status: 'upcoming',
        });
      } else {
        if (r.amount == null) { toast('Betrag fehlt — bitte mit „Felder bearbeiten" ergänzen.', 'error'); return; }
        A.addTransaction({
          vendor: r.vendor,
          amount: -Math.abs(r.amount),
          date: r.date || new Date().toISOString().slice(0, 10),
          category: r.category,
        });
        toast(`„${r.vendor}" abgelegt unter ${A.catLabel(r.category)}.`, 'success');
      }
    }

    function editCurrentFields() {
      const r = window.__upLast || {};
      openAddTransactionModal();
    }

    return { init, detect, handleFile };
  })();

  // ─── Onboarding wizard ─────────────────────────────
  const Onboarding = {
    step: 1,
    total: 6,
    start() {
      this.step = 1;
      this.render();
      $('[data-onb-next]').addEventListener('click', () => this.next());
      $('[data-onb-back]').addEventListener('click', () => this.back());
      $('[data-onb-skip]').addEventListener('click', () => { this.commit(); go('index.html'); });
      $$('[data-onb-demo]').forEach(el => el.addEventListener('click', (e) => { e.preventDefault(); A.loadDemo(); go('index.html'); }));

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

      this.renderBills();
      $('[data-onb-add-bill]').addEventListener('click', () => this.addBill());
    },
    render() {
      $$('[data-step]').forEach(el => {
        el.style.display = (parseInt(el.dataset.step, 10) === this.step) ? '' : 'none';
      });
      $('[data-onb-progress]').style.width = ((this.step / this.total) * 100) + '%';
      $('[data-onb-step]').textContent = `Schritt ${this.step} von ${this.total}`;
      $('[data-onb-back]').style.visibility = this.step === 1 ? 'hidden' : '';
      $('[data-onb-next]').textContent = this.step === this.total ? 'Dashboard öffnen' : 'Weiter →';
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
      set('[data-onb-calc="firstname"]', A.get().profile.firstName || 'dort');
    },
    renderBills() {
      const list = $('[data-onb-bills]');
      if (!list) return;
      const items = A.get().bills;
      if (!items.length) {
        list.innerHTML = '<div class="card-sub" style="padding:10px 0;">Noch keine Rechnungen. Füge die hinzu, die jeden Monat von deinem Konto abgehen.</div>';
        return;
      }
      list.innerHTML = items.map(b => `
        <div class="row" style="gap: 12px; padding: 10px 0; border-bottom: 1px dashed var(--rule);">
          <div class="day-chip"><div><span>Tag</span><span class="d">${b.dueDay}</span></div></div>
          <div style="flex:1;">
            <div style="font-weight:500; font-size:14.5px;">${escapeHtml(b.vendor)}</div>
            <div class="card-sub" style="margin:2px 0 0;">${escapeHtml(A.catLabel(b.category))}</div>
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
        toast('Bitte Anbieter, Betrag und Fälligkeit ausfüllen.', 'error');
        return;
      }
      A.addBill({ vendor, category, amount, dueDay, status: 'upcoming' });
      $('[data-onb-bill-vendor]').value = '';
      $('[data-onb-bill-amount]').value = '';
      $('[data-onb-bill-day]').value = '';
      this.renderBills();
      this.updateCalc();
    },
  };

  // ─── Globals: reset, greeting, date ───────────────
  function wireGlobals() {
    $$('[data-action="reset"]').forEach(el => el.addEventListener('click', (e) => {
      e.preventDefault();
      if (!confirm('Alle Daten löschen und Onboarding neu starten?')) return;
      A.reset();
      go('onboarding.html');
    }));
    $$('[data-action="load-demo"]').forEach(el => el.addEventListener('click', (e) => {
      e.preventDefault();
      A.loadDemo();
      go('index.html');
    }));
    $$('[data-greeting]').forEach(el => el.textContent = A.greeting());
    $$('[data-today]').forEach(el => el.textContent = A.todayLabel());
    $$('[data-month]').forEach(el => el.textContent = A.monthLabel());
    $$('[data-initials]').forEach(el => {
      const p = A.get().profile;
      const a = ((p.firstName || '').trim()[0] || '').toUpperCase();
      const b = ((p.lastName  || '').trim()[0] || '').toUpperCase();
      el.textContent = (a + b) || '?';
    });
  }

  function boot() {
    const p = page();
    if (GATED.has(p) && !A.get().onboarded) { go('onboarding.html'); return; }
    wireGlobals();
    bind();
    if (pages[p]) pages[p]();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();
