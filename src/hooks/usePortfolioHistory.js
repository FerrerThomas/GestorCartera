import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';

// Saves at most one snapshot per calendar day (upsert keeps today's row fresh
// across re-runs within the same day) and loads the full history for the chart.
// `ready` gates the very first save until the portfolio total has actually
// loaded, so we never persist a spurious $0 during the initial render.
export function usePortfolioHistory(user, totalARS, totalUSD, ready) {
  const [history, setHistory] = useState([]);
  const savedRef = useRef(false);

  useEffect(() => {
    savedRef.current = false;
  }, [user]);

  useEffect(() => {
    if (!user || !ready || savedRef.current) return;
    savedRef.current = true;

    const snapshotDate = new Date().toISOString().slice(0, 10);
    supabase
      .from('portfolio_snapshots')
      .upsert(
        { user_id: user.id, snapshot_date: snapshotDate, total_ars: totalARS, total_usd: totalUSD },
        { onConflict: 'user_id,snapshot_date' }
      )
      .then(() =>
        supabase
          .from('portfolio_snapshots')
          .select('snapshot_date, total_ars, total_usd')
          .order('snapshot_date')
      )
      .then(({ data }) => setHistory(data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, ready]);

  return history;
}
