import { useState } from 'react';
import { getAccountLogoUrl } from '../../data/logos.js';
import { accountColor } from './Icon.jsx';

// Logo de la marca de una cuenta (Mercado Pago, Cuenta DNI, IOL, Binance…) o,
// si no se reconoce, su inicial sobre el color del tipo de cuenta.
export default function AccountIcon({ account, name, size = 36 }) {
  const [failed, setFailed] = useState(false);
  const label = name ?? account?.name ?? '';
  const url = getAccountLogoUrl(label);
  const box = { width: size, height: size, borderRadius: size / 2, flex: 'none' };

  if (url && !failed) {
    return (
      <span aria-hidden="true" className="account-logo" style={box}>
        <img src={url} alt="" width={size} height={size} onError={() => setFailed(true)} />
      </span>
    );
  }
  return (
    <span className="dot-icon" aria-hidden="true" style={{ ...box, background: accountColor(account), fontSize: size * 0.42 }}>
      {label.trim()[0]?.toUpperCase() ?? '?'}
    </span>
  );
}
