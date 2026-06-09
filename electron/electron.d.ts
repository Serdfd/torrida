/**
 * electron.d.ts
 * Declaración global de window.electronAPI
 * para que TypeScript lo reconozca en todo el renderer.
 */

import type { ElectronAPI } from './src/types'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}