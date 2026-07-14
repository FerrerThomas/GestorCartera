import { useEffect, useRef, useState } from 'react';
import {
  fetchArgCedears,
  fetchArgStocks,
  fetchCryptoPrices,
  fetchDolarBlue,
} from '../services/marketData.js';

const POLL_MS = 15000;

export function useMarketData(assets) {
  const [dolarBlue, setDolarBlue] = useState(null);
  const [prices, setPrices] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const assetsRef = useRef(assets);
  assetsRef.current = assets;

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      const current = assetsRef.current;
      const stockTickers = current.filter((a) => a.category === 'Acción').map((a) => a.ticker);
      const cedearTickers = current.filter((a) => a.category === 'CEDEAR').map((a) => a.ticker);
      const cryptoTickers = current.filter((a) => a.category === 'Cripto').map((a) => a.ticker);

      const [blue, stocks, cedears, crypto] = await Promise.allSettled([
        fetchDolarBlue(),
        fetchArgStocks(),
        fetchArgCedears(),
        fetchCryptoPrices(cryptoTickers),
      ]);
      if (cancelled) return;

      if (blue.status === 'fulfilled' && blue.value != null) setDolarBlue(blue.value);

      const merged = {};
      const stocksMap = stocks.status === 'fulfilled' ? stocks.value : {};
      const cedearsMap = cedears.status === 'fulfilled' ? cedears.value : {};
      const cryptoMap = crypto.status === 'fulfilled' ? crypto.value : {};
      for (const t of stockTickers) if (stocksMap[t] != null) merged[t] = stocksMap[t];
      for (const t of cedearTickers) if (cedearsMap[t] != null) merged[t] = cedearsMap[t];
      for (const t of cryptoTickers) if (cryptoMap[t] != null) merged[t] = cryptoMap[t];

      setPrices((prev) => ({ ...prev, ...merged }));
      setLastUpdated(new Date());
    };

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return { dolarBlue, prices, lastUpdated };
}
