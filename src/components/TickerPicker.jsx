import { useMemo, useState } from 'react';
import { formatMoney } from '../utils/finance.js';

export default function TickerPicker({ options, value, onChange, priceCurrency, placeholder }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    const list = q ? options.filter((o) => o.ticker.includes(q)) : options;
    return list.slice(0, 50);
  }, [options, query]);

  const selected = options.find((o) => o.ticker === value);
  const displayValue = open ? query : selected ? `${selected.ticker}${selected.name ? ' — ' + selected.name : ''}` : '';

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={displayValue}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true);
          setQuery('');
        }}
        onChange={(e) => setQuery(e.target.value)}
        onBlur={() => setOpen(false)}
      />
      {open && (
        <div className="ticker-dropdown">
          {filtered.length === 0 && <div className="ticker-dropdown-empty">Sin resultados</div>}
          {filtered.map((o) => (
            <div
              key={o.ticker}
              className="ticker-dropdown-item"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(o.ticker);
                setOpen(false);
                setQuery('');
              }}
            >
              <span className="ticker-dropdown-symbol">{o.ticker}</span>
              {o.name && <span className="ticker-dropdown-name">{o.name}</span>}
              {o.price != null && (
                <span className="ticker-dropdown-price">{formatMoney(o.price, priceCurrency ?? 'ARS')}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
