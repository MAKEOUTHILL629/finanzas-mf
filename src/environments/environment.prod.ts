export const environment = {
  production: true,
  // ❌ ANTES (Causante del error CORS):
  // apiUrl: 'https://d2k6anvt1vxcuu.cloudfront.net/api'

  // ✅ AHORA (Solución "Same Origin"):
  apiUrl: '/api'
};
