/* TuinBooks v60.5.22 — complete schedule cloud-read compatibility shim.
   Restores the missing global helper used by the live app.js schedule path.
   Read-only: does not create, delete, move, or rewrite schedule rows. */
(function () {
  if (typeof window.loadAllScheduleRowsResultV60522 === 'function') return;

  window.loadAllScheduleRowsResultV60522 = async function loadAllScheduleRowsResultV60522(client, businessId) {
    const PAGE = 1000;
    const MAX_PAGES = 50;
    const columns = 'id,visit_date,client_id,team_id,status,estimated_hours,sort_order,billing_profile_id,payload,updated_at';
    const rows = [];
    const seen = new Set();

    for (let page = 0; page < MAX_PAGES; page++) {
      const from = page * PAGE;
      const to = from + PAGE - 1;
      const result = await client
        .from('schedule_jobs')
        .select(columns)
        .eq('business_id', businessId)
        .order('visit_date')
        .order('sort_order')
        .order('id')
        .range(from, to);

      if (result && result.error) return { data: null, error: result.error };

      const batch = Array.isArray(result && result.data) ? result.data : [];
      for (const row of batch) {
        const id = String((row && row.id) || '');
        if (id && seen.has(id)) continue;
        if (id) seen.add(id);
        rows.push(row);
      }

      if (batch.length < PAGE) return { data: rows, error: null };
    }

    return {
      data: null,
      error: new Error('Calendar is larger than the safe 50,000-row load limit. Contact TuinBooks support before continuing.')
    };
  };
})();
