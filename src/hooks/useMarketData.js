import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import {
  fetchArgCedears,
  fetchArgStocks,
  fetchCryptoPrices,
  fetchCs2Prices,
  fetchDolarBlue,
} from '../services/marketData.js';

const POLL_MS = 15000;
// Live prices are also persisted to assets.current_price so a fresh page load
// shows a recent price instantly instead of the purchase-time one. Throttled
// per asset so the 15s poll doesn't turn into constant DB writes.
const PERSIST_MS = 5 * 60 * 1000;
// El mapa de skins se refetchea como máximo cada 5 min (el proxy cachea eso
// mismo, y Skinport admite 8 req/5min) — entre medio el poll reusa el último.
const CS2_REFRESH_MS = 5 * 60 * 1000;

export function useMarketData(assets) {
  const [dolarBlue, setDolarBlue] = useState(null);
  const [prices, setPrices] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const assetsRef = useRef(assets);
  assetsRef.current = assets;
  const lastPersistRef = useRef({});
  const cs2Ref = useRef({ at: 0, map: {} });

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      const current = assetsRef.current;
      const stockTickers = current.filter((a) => a.category === 'Acción').map((a) => a.ticker);
      const cedearTickers = current.filter((a) => a.category === 'CEDEAR').map((a) => a.ticker);
      const cryptoTickers = current.filter((a) => a.category === 'Cripto').map((a) => a.ticker);
      const skinTickers = current.filter((a) => a.category === 'Skin CS2').map((a) => a.ticker);

      const needCs2 =
        skinTickers.length > 0 && Date.now() - cs2Ref.current.at >= CS2_REFRESH_MS;
      const [blue, stocks, cedears, crypto, cs2] = await Promise.allSettled([
        fetchDolarBlue(),
        fetchArgStocks(),
        fetchArgCedears(),
        fetchCryptoPrices(cryptoTickers),
        needCs2 ? fetchCs2Prices() : Promise.resolve(null),
      ]);
      if (cancelled) return;

      if (cs2.status === 'fulfilled' && cs2.value && Object.keys(cs2.value).length) {
        cs2Ref.current = { at: Date.now(), map: cs2.value };
      }

      if (blue.status === 'fulfilled' && blue.value != null) setDolarBlue(blue.value);

      const merged = {};
      const stocksMap = stocks.status === 'fulfilled' ? stocks.value : {};
      const cedearsMap = cedears.status === 'fulfilled' ? cedears.value : {};
      const cryptoMap = crypto.status === 'fulfilled' ? crypto.value : {};
      for (const t of stockTickers) if (stocksMap[t] != null) merged[t] = stocksMap[t];
      for (const t of cedearTickers) if (cedearsMap[t] != null) merged[t] = cedearsMap[t];
      for (const t of cryptoTickers) if (cryptoMap[t] != null) merged[t] = cryptoMap[t];
      for (const t of skinTickers) if (cs2Ref.current.map[t] != null) merged[t] = cs2Ref.current.map[t];

      setPrices((prev) => ({ ...prev, ...merged }));
      setLastUpdated(new Date());

      // Best-effort persistence of fresh prices (never blocks or breaks the poll).
      const now = Date.now();
      const blueValue = blue.status === 'fulfilled' ? blue.value : null;
      for (const a of current) {
        if (a.kind === 'fund') continue;
        const live =
          a.category === 'Efectivo' ? (a.ticker === 'USD' ? blueValue : null) : merged[a.ticker];
        if (live == null) continue;
        const last = lastPersistRef.current[a.id];
        if (last && (now - last.ts < PERSIST_MS || last.price === live)) continue;
        lastPersistRef.current[a.id] = { ts: now, price: live };
        supabase
          .from('assets')
          .update({ current_price: live })
          .eq('id', a.id)
          .then(() => {}, () => {});
      }
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
