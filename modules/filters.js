// ─── FILTER ENGINE ───────────────────────────────────────────────
// Global filter state per page
const FILTERS = {};

function initFilter(pageId, defaults) {
  if (!FILTERS[pageId]) FILTERS[pageId] = { ...defaults };
  return FILTERS[pageId];
}

function setFilter(pageId, key, value) {
  if (!FILTERS[pageId]) FILTERS[pageId] = {};
  FILTERS[pageId][key] = value;
  renderPage(pageId);
}

// ── Reusable filter bar builder ───────────────────────────────────
function filterBar(pageId, opts = {}) {
  const f = FILTERS[pageId] || {};
  const parts = [];

  // Search box
  parts.push(`
    <div style="position:relative;flex:1;min-width:160px">
      <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--gray-400);font-size:14px">🔍</span>
      <input class="form-input" style="padding:8px 10px 8px 32px;font-size:13px" 
        placeholder="${opts.searchPlaceholder||'Search customer, location...'}"
        value="${f.search||''}"
        oninput="setFilter('${pageId}','search',this.value)"/>
    </div>`);

  // Status filter
  if (opts.statuses) {
    const statusOpts = [['', 'All Status'], ...opts.statuses.map(s => [s, s.replace(/_/g,' ')])];
    parts.push(`
      <select class="form-select" style="padding:8px 10px;font-size:13px;min-width:130px"
        onchange="setFilter('${pageId}','status',this.value)">
        ${statusOpts.map(([v,l]) => `<option value="${v}" ${f.status===v?'selected':''}>${l}</option>`).join('')}
      </select>`);
  }

  // Date range
  if (opts.dateFilter) {
    parts.push(`
      <input class="form-input" type="date" style="padding:8px 10px;font-size:13px;width:140px"
        title="From date" value="${f.dateFrom||''}"
        onchange="setFilter('${pageId}','dateFrom',this.value)"/>
      <input class="form-input" type="date" style="padding:8px 10px;font-size:13px;width:140px"
        title="To date" value="${f.dateTo||''}"
        onchange="setFilter('${pageId}','dateTo',this.value)"/>`);
  }

  // Clear button
  const hasActive = Object.values(f).some(v => v && v !== '');
  if (hasActive) {
    parts.push(`<button class="btn-sm" style="white-space:nowrap;background:var(--red-50);color:var(--red-700);border:1px solid var(--red-100)" 
      onclick="FILTERS['${pageId}']={};renderPage('${pageId}')">✕ Clear</button>`);
  }

  return `<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:14px;background:var(--gray-50);padding:10px;border-radius:10px;border:1px solid var(--gray-200)">
    ${parts.join('')}
  </div>`;
}

// ── Apply filters to a dataset ────────────────────────────────────
function applyFilters(items, pageId, opts = {}) {
  const f = FILTERS[pageId] || {};
  let result = [...items];

  // Text search across multiple fields
  if (f.search) {
    const q = f.search.toLowerCase();
    result = result.filter(item => {
      const fields = (opts.searchFields || ['customer_name', 'location_text', 'requirement_summary'])
        .map(field => {
          // Support nested fields like jobs.customer_name
          if (field.includes('.')) {
            const [parent, child] = field.split('.');
            return (item[parent]?.[child] || '').toLowerCase();
          }
          return (item[field] || '').toLowerCase();
        });
      return fields.some(f => f.includes(q));
    });
  }

  // Status filter
  if (f.status) {
    result = result.filter(item => item.status === f.status);
  }

  // Date range filter
  if (f.dateFrom) {
    result = result.filter(item => {
      const d = new Date(item[opts.dateField || 'created_at']);
      return d >= new Date(f.dateFrom);
    });
  }
  if (f.dateTo) {
    result = result.filter(item => {
      const d = new Date(item[opts.dateField || 'created_at']);
      return d <= new Date(f.dateTo + 'T23:59:59');
    });
  }

  return result;
}
