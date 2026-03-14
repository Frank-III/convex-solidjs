import tsdownConfig from './tsdown.config.ts'
import { defineConfig } from 'vite-plus'

export default defineConfig({
  pack: tsdownConfig,
  run: {
    tasks: {
      'lint:all': {
        command: 'vp lint src --quiet --ignore-path .gitignore',
        dependsOn: ['lint:types'],
      },
      'test:all': {
        command: 'vp test',
        dependsOn: ['test:ssr'],
      },
    },
  },
})
