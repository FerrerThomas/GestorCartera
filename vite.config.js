import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En prod, /api/cs2prices lo sirve la función serverless de Vercel (api/cs2prices.js).
// En dev, este middleware replica el endpoint reusando la misma lógica compartida.
function cs2PricesDevEndpoint() {
  return {
    name: 'cs2-prices-dev-endpoint',
    configureServer(server) {
      server.middlewares.use('/api/cs2prices', async (_req, res) => {
        try {
          const { getCs2Prices } = await import('./api/_lib/skinport.js');
          const data = await getCs2Prices();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        } catch (e) {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: String(e?.message ?? e) }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), cs2PricesDevEndpoint()],
});
