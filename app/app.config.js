// Extiende app.json. Con PREVIEW=1 genera un build web de un solo bundle
// (sin rutas asíncronas) para publicarlo como vista previa estática.
module.exports = ({ config }) => {
  if (process.env.PREVIEW !== '1') return config;
  const plugins = (config.plugins ?? []).map((p) =>
    p === 'expo-router' ? ['expo-router', { asyncRoutes: { web: false } }] : p,
  );
  return { ...config, plugins };
};
