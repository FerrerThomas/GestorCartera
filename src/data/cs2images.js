// Imágenes de skins CS2 — dataset comunitario CSGO-API (ByMykel), ~21k ítems
// con market_hash_name + imagen del CDN de Steam. Se fetchea lazy UNA vez por
// sesión y solo cuando se está agregando una skin; la URL matcheada se
// persiste en assets.image_url, así el dashboard nunca depende de este fetch.

const DATASET_URL =
  'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins_not_grouped.json';

let datasetPromise = null;

async function loadDataset() {
  if (!datasetPromise) {
    datasetPromise = fetch(DATASET_URL)
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => {
        const map = new Map();
        for (const item of list) {
          if (item?.market_hash_name && item?.image) map.set(item.market_hash_name, item.image);
        }
        return map;
      })
      .catch(() => new Map());
  }
  return datasetPromise;
}

// URL de imagen para un market_hash_name exacto, o null si no está en el dataset.
export async function findSkinImage(marketHashName) {
  const map = await loadDataset();
  return map.get(marketHashName) ?? null;
}
