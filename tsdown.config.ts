import { defineConfig } from 'vite-plus/pack'
import solidPlugin from 'vite-plugin-solid'

export default defineConfig({
  entry: ['src/index.tsx'],
  format: 'esm',
  dts: true,
  clean: true,
  platform: 'neutral',
  target: 'esnext',
  plugins: [
    solidPlugin({
      hot: false,
      solid: { generate: 'dom' },
    }),
  ],
})
