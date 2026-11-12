import { useEffect, useState } from 'react';
import { fetchFciLatest, fetchWalletRates } from '../services/fundRates.js';

const REFRESH_MS = 30 * 60 * 1000;

// Cotizaciones de los fondos/tasas de las billeteras vinculadas.
// `force` trae igual la lista de FCI (para elegir uno en Ajustes).
export function useFundQuotes(accounts, force = false) {
  const [fci, setFci] = useState({});
  const [rates, setRates] = useState({});
  const needFci = force || accounts.some((a) => a.fund_fci);
  const needRates = force || accounts.some((a) => a.fund_api);

  useEffect(() => {
    if (!needFci && !needRates) return undefined;
    let cancelled = false;
    const load = () => {
      if (needFci) fetchFciLatest().then((m) => !cancelled && setFci(m));
      if (needRates) fetchWalletRates().then((m) => !cancelled && setRates(m));
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [needFci, needRates]);

  return { fci, rates };
}
