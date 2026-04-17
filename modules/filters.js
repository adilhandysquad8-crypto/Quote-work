// ─── FILTERS MODULE ───────────────────────────────────────────────
// Global filter state: keyed by page name, holds { search, status, dateFrom, dateTo }
let FILTERS = {};

// ─── FILTER BAR RENDERER ─────────────────────────────────────────
// Renders a search + status + date filter strip for a given page.
// opts = { searchPlaceholder, statuses: [], dateFilter: bool }
function filterBar(key, opts = {}) {
  if (!FILTERS[key]) FILTERS[key] = {};
  const f = FILTERS[key];

  const searchHtml = `
    <input
      class="filter-input"
      type="text"
      placeholder="${opts.searchPlaceholder || 'Search...'}"
      value="${f.search || ''}"
      oninput="setFilter('${key}','search',this.value)"
      style="flex:1;min-width:140px;padding:7px 12px;border:1px solid var(--gray-200);border-radius:8px;font-size:13px;outline:none"
    />`;

  const statusHtml = opts.statuses && opts.statuses.length ? `
    <select
      class="filter-select"
      onchange="setFilter('${key}','status',this.value)"
      style="padding:7px 10px;border:1px solid var(--gray-200);border-radius:8px;font-size:13px;background:white;min-width:130px"
    >
      <option value="">All statuses</option>
      ${opts.statuses.map(s =>
        `<option value="${s}" ${f.status === s ? 'selected' : ''}>${s.replace(/_/g,' ')}</option>`
      ).join('')}
    </select>` : '';

  const dateHtml = opts.dateFilter ? `
    <input
      type="date"
      value="${f.dateFrom || ''}"
      onchange="setFilter('${key}','dateFrom',this.value)"
      title="From date"
      style="padding:7px 8px;border:1px solid var(--gray-200);border-radius:8px;font-size:13px"
    />
    <span style="font-size:12px;color:var(--gray-400);align-self:center">→</span>
    <input
      type="date"
      value="${f.dateTo || ''}"
      onchange="setFilter('${key}','dateTo',this.value)"
      title="To date"
      style="padding:7px 8px;border:1px solid var(--gray-200);border-radius:8px;font-size:13px"
    />` : '';

  const hasActive = f.search || f.status || f.dateFrom || f.dateTo;
  const clearHtml = hasActive ? `
    <button
      onclick="clearFilters('${key}')"
      style="padding:7px 12px;border:1px solid var(--red-100);border-radius:8px;font-size:12px;background:var(--red-50);color:var(--red-700);cursor:pointer;white-space:nowrap"
    >✕ Clear</button>` : '';

  return `
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;align-items:center">
      ${searchHtml}
      ${statusHtml}
      ${dateHtml}
      ${clearHtml}
    </div>`;
}

// ─── FILTER ACTIONS ───────────────────────────────────────────────
function setFilter(key, field, value) {
  if (!FILTERS[key]) FILTERS[key] = {};
  FILTERS[key][field] = value;
  renderPage(STATE.currentPage);
}

function clearFilters(key) {
  FILTERS[key] = {};
  renderPage(STATE.currentPage);
}

// ─── APPLY FILTERS ────────────────────────────────────────────────
// Applies the stored filter state for `key` to `data` array.
// opts.searchFields = array of field names to search across
function applyFilters(data, key, opts = {}) {
  if (!FILTERS[key]) FILTERS[key] = {};
  const f = FILTERS[key];
  let result = data;

  if (f.search) {
    const q = f.search.toLowerCase().trim();
    const fields = opts.searchFields || [];
    result = result.filter(item =>
      fields.some(field => {
        const val = item[field];
        return val && String(val).toLowerCase().includes(q);
      })
    );
  }

  if (f.status) {
    result = result.filter(item => item.status === f.status);
  }

  if (f.dateFrom) {
    const from = new Date(f.dateFrom);
    result = result.filter(item => {
      const d = item.created_at || item.date || item.scheduled_date;
      return d && new Date(d) >= from;
    });
  }

  if (f.dateTo) {
    const to = new Date(f.dateTo + 'T23:59:59');
    result = result.filter(item => {
      const d = item.created_at || item.date || item.scheduled_date;
      return d && new Date(d) <= to;
    });
  }

  return result;
}
