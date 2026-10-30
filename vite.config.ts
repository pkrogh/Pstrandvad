import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { adoProxy, clientConfig, readAdoSettings } from './server/adoProxy'

export default defineConfig(({ mode }) => {
  // Load all variables (not just VITE_*) — they stay server-side; only clientConfig() reaches the bundle.
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env } as Record<string, string>
  const ado = readAdoSettings(env)
  return {
    plugins: [react(), tailwindcss(), adoProxy(ado)],
    define: { __ADO_CONFIG__: JSON.stringify(clientConfig(ado)) },
  }
})
