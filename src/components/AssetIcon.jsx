import { useState } from 'react';
import { getAssetLogoUrl } from '../data/logos.js';

// Logo image with graceful fallback to the initials badge when the asset has
// no known logo or the image fails to load.
export default function AssetIcon({ asset, accountName, size = 30 }) {
  const [failed, setFailed] = useState(false);
  // La imagen propia del activo (skins CS2 / URL manual) pisa el logo curado.
  const url = asset.imageUrl || getAssetLogoUrl(asset, accountName);

  if (!url || failed) {
    return (
      <span
        className="asset-icon"
        style={{ background: asset.iconBg, color: asset.iconColor, width: size, height: size }}
      >
        {asset.iconLabel}
      </span>
    );
  }

  return (
    <img
      className="asset-icon asset-icon-img"
      src={url}
      alt={asset.ticker}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}
