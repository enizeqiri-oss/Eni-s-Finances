// Atelier · client-side state store
// Persists to localStorage. No backend.

(function (global) {
  'use strict';

  const KEY = 'atelier.state.v1';

  const DEFAULTS = {
    profile: {
      firstName: 'You',
      lastName: '',
      kanton: 'Zürich',
      currency: 'CHF',
      startedAt: null,
    },
    employment: {
      employer: '',
      bruttoMonthly: 0,
      payday: 25,
      thirteenth: false,
    },
    side: {
      freelance: 0,
      dividends: 0,
      rental: 0,
      other: 0,
    },
    taxes: {
      taxRate: 14.2,
      saule3a: 0,
      bvg: 0,
      ahvRate: 6.4,
    },
    bills: [],
    budgets: {
      groceries: 0,
      dining: 0,
      transport: 0,
      leisure: 0,
      shopping: 0,
    },
    spending: {
      groceries: 0,
      dining: 0,
      transport: 0,
      leisure: 0,
      shopping: 0,
    },
    transactions: [],
    netWorth: 0,
    investments: 0,
    onboarded: false,
  };

  const DEMO = {
    profile: { firstName: 'Lena', lastName: 'Bühlmann', kanton: 'Zürich', currency: 'CHF' },
    employment: { employer: 'Studio Schibler AG', bruttoMonthly: 9200, payday: 25, thirteenth: true },
    side: { freelance: 160, dividends: 80, rental: 0, other: 0 },
    taxes: { taxRate: 14.2, saule3a: 583, bvg: 517, ahvRate: 6.4 },
    bills: [
      { id: 'b1', vendor: 'Rent — Kreis 4',          category: 'Housing',   amount: 2200, dueDay: 1,  status: 'paid' },
      { id: 'b2', vendor: 'Krankenkasse — Helsana',  category: 'Insurance', amount: 384,  dueDay: 3,  status: 'paid' },
      { id: 'b3', vendor: 'EWZ Strom',               category: 'Utilities', amount: 124,  dueDay: 8,  status: 'paid' },
      { id: 'b4', vendor: 'Salt mobile + internet',  category: 'Utilities', amount: 95,   dueDay: 12, status: 'upcoming' },
      { id: 'b5', vendor: 'SBB GA Monatsabo',        category: 'Transport', amount: 185,  dueDay: 15, status: 'upcoming' },
      { id: 'b6', vendor: 'Holmes Place',            category: 'Health',    amount: 89,   dueDay: 20, status: 'upcoming' },
      { id: 'b7', vendor: 'Spotify Family',          category: 'Subs',      amount: 22,   dueDay: 22, status: 'upcoming' },
      { id: 'b8', vendor: 'iCloud+ 2TB',             category: 'Subs',      amount: 12,   dueDay: 24, status: 'upcoming' },
    ],
    budgets:  { groceries: 700, dining: 250, transport: 80,  leisure: 200, shopping: 300 },
    spending: { groceries: 612, dining: 268, transport: 78,  leisure: 142, shopping: 198 },
    transactions: [
      { id: 't1', date: '2026-05-17', vendor: 'Migros Sihlcity',       category: 'Groceries', amount: -84.30 },
      { id: 't2', date: '2026-05-16', vendor: 'Hiltl',                 category: 'Dining',    amount: -38.50 },
      { id: 't3', date: '2026-05-15', vendor: 'Salary · Studio Schibler', category: 'Income', amount: 7800 },
      { id: 't4', date: '2026-05-14', vendor: 'Globus',                category: 'Shopping',  amount: -128.00 },
    ],
    netWorth: 184320,
    investments: 54520,
    onboarded: true,
  };

  // ── persistence ────────────────────────────
  function deepMerge(target, source) {
    if (typeof source !== 'object' || source === null) return source;
    const out = Array.isArray(target) ? [...(target || [])] : { ...(target || {}) };
    for (const k of Object.keys(source)) {
      if (Array.isArray(source[k])) out[k] = source[k].slice();
      else if (typeof source[k] === 'object' && source[k] !== null) out[k] = deepMerge(out[k] || {}, source[k]);
      else out[k] = source[k];
    }
    return out;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return deepMerge({}, DEFAULTS);
      const parsed = JSON.parse(raw);
      return deepMerge(DEFAULTS, parsed);
    } catch (e) {
      console.warn('[atelier] state load failed; resetting', e);
      return deepMerge({}, DEFAULTS);
    }
  }

  function persist(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); }
    catch (e) { console.warn('[atelier] state save failed', e); }
  }

  let _state = load();
  const _listeners = new Set();

  function get() { return _state; }
  function update(patch) {
    _state = deepMerge(_state, patch);
    persist(_state);
    _listeners.forEach(fn => { try { fn(_state); } catch (_) {} });
  }
  function replace(newState) {
    _state = deepMerge({}, deepMerge(DEFAULTS, newState));
    persist(_state);
    _listeners.forEach(fn => { try { fn(_state); } catch (_) {} });
  }
  function reset() {
    localStorage.removeItem(KEY);
    _state = deepMerge({}, DEFAULTS);
    _listeners.forEach(fn => { try { fn(_state); } catch (_) {} });
  }
  function loadDemo() {
    replace(DEMO);
  }
  function onChange(fn) {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  }

  // ── derived ────────────────────────────────
  function derived() {
    const s = _state;
    const brutto = num(s.employment.bruttoMonthly);
    const ahv = brutto * num(s.taxes.ahvRate) / 100;
    const bvg = num(s.taxes.bvg);
    const netSalary = Math.max(0, brutto - ahv - bvg);
    const side = num(s.side.freelance) + num(s.side.dividends) + num(s.side.rental) + num(s.side.other);
    const netMonthly = Math.round(netSalary + side);

    const totalFixed = sumBy(s.bills, b => num(b.amount));
    const paid = s.bills.filter(b => b.status === 'paid');
    const upcoming = s.bills.filter(b => b.status === 'upcoming');
    const paidTotal = sumBy(paid, b => num(b.amount));
    const upcomingTotal = sumBy(upcoming, b => num(b.amount));
    const annual = totalFixed * 12;

    const totalSpent = num(s.spending.groceries) + num(s.spending.dining) +
                       num(s.spending.transport) + num(s.spending.leisure) +
                       num(s.spending.shopping);
    const totalOut = totalFixed + totalSpent;
    const saved = Math.max(0, netMonthly - totalOut);
    const savingsRate = netMonthly > 0 ? Math.round((saved / netMonthly) * 100) : 0;

    // for the "spent" stat we show fixed-paid + variable, since upcoming haven't hit yet
    const spentThisMonth = paidTotal + totalSpent;

    // budget over/under
    const budgetTotal = num(s.budgets.groceries) + num(s.budgets.dining) +
                        num(s.budgets.transport) + num(s.budgets.leisure) +
                        num(s.budgets.shopping);
    const budgetRemaining = Math.max(0, budgetTotal - totalSpent);

    const today = new Date();
    const eom = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const daysLeft = Math.max(0, eom.getDate() - today.getDate());
    const avgDay = daysLeft > 0 ? Math.round(saved / daysLeft) : 0;

    return {
      brutto, ahv, bvg, netSalary, side, netMonthly,
      totalFixed, paidTotal, upcomingTotal, annual,
      paidCount: paid.length, upcomingCount: upcoming.length,
      totalSpent, totalOut, saved, savingsRate, spentThisMonth,
      budgetTotal, budgetRemaining, daysLeft, avgDay,
    };
  }

  // ── formatting (Swiss) ─────────────────────
  function num(v) { const n = parseFloat(v); return isFinite(n) ? n : 0; }
  function sumBy(arr, fn) { return (arr || []).reduce((a, x) => a + fn(x), 0); }

  function fmt(n, opts) {
    const { decimals = 0, signed = false } = opts || {};
    const v = num(n);
    const fixed = Math.abs(v).toFixed(decimals);
    const [intPart, decPart] = fixed.split('.');
    const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '’'); // U+2019 apostrophe
    let s = decPart ? `${withSep}.${decPart}` : withSep;
    if (signed) s = (v >= 0 ? '+' : '−') + s;
    else if (v < 0) s = '−' + s;
    return s;
  }
  function fmtPct(n, decimals = 0) {
    return num(n).toFixed(decimals) + '%';
  }
  function uid() { return 'x' + Math.random().toString(36).slice(2, 9); }

  // ── greeting ───────────────────────────────
  function greeting(hour) {
    const h = (typeof hour === 'number') ? hour : new Date().getHours();
    if (h < 5)  return 'Good night';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    if (h < 22) return 'Good evening';
    return 'Good night';
  }
  function todayLabel(d) {
    const date = d || new Date();
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return `${days[date.getDay()]} · ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  }
  function monthLabel(d) {
    const date = d || new Date();
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  // ── export ─────────────────────────────────
  global.Atelier = {
    get, update, replace, reset, loadDemo, onChange,
    derived, fmt, fmtPct, uid, num, deepMerge,
    greeting, todayLabel, monthLabel,
    DEFAULTS, DEMO, KEY,
  };
})(window);
