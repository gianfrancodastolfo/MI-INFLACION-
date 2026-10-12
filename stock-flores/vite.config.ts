import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  build: { target: 'es2019' },
  test: { include: ['src/**/*.test.ts', 'gas/**/*.test.ts'] },
});
