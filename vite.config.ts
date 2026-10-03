import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`         → sitio estático para Netlify (rutas reales, datos en un chunk aparte).
// `npm run build:preview` → un único HTML autocontenido (navegación por hash) para compartir una vista previa.
export default defineConfig(({ mode }) => {
  const single = mode === 'singlefile';
  return {
    plugins: [react(), ...(single ? [viteSingleFile()] : [])],
    define: { __ROUTER_MODE__: JSON.stringify(single ? 'hash' : 'history') },
    build: {
      outDir: single ? 'dist-preview' : 'dist',
      target: 'es2020',
      sourcemap: !single,
    },
    test: {
      include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
      environment: 'node',
    },
  };
});
