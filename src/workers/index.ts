// ============================================================
// Qarvon CRM — Background Workers
// Runs as a separate Node.js process alongside Next.js.
// In production, deployed as a separate Easypanel service.
// ============================================================

import 'dotenv/config'
import { scoringWorker } from './scoring-worker'
import { capiFlushWorker } from './capi-flush-worker'
import { temperatureWorker } from './temperature-worker'
import { metricsWorker } from './metrics-worker'

const SCORING_INTERVAL_MS = parseInt(process.env.WORKER_SCORING_INTERVAL_MS ?? '900000')   // 15m
const CAPI_INTERVAL_MS    = parseInt(process.env.WORKER_CAPI_INTERVAL_MS ?? '300000')      // 5m
const TEMP_INTERVAL_MS    = parseInt(process.env.WORKER_TEMP_INTERVAL_MS ?? '3600000')     // 1h
const METRICS_INTERVAL_MS = parseInt(process.env.WORKER_METRICS_INTERVAL_MS ?? '3600000')  // 1h

console.log('[Worker] Starting Qarvon CRM background workers...')

// Run each worker on startup
void scoringWorker()
void capiFlushWorker()
void temperatureWorker()
void metricsWorker()

// Schedule recurring runs
setInterval(() => void scoringWorker(), SCORING_INTERVAL_MS)
setInterval(() => void capiFlushWorker(), CAPI_INTERVAL_MS)
setInterval(() => void temperatureWorker(), TEMP_INTERVAL_MS)
setInterval(() => void metricsWorker(), METRICS_INTERVAL_MS)

process.on('SIGTERM', () => {
  console.log('[Worker] SIGTERM received, shutting down gracefully...')
  process.exit(0)
})

process.on('uncaughtException', err => {
  console.error('[Worker] Uncaught exception:', err)
})

process.on('unhandledRejection', (reason) => {
  console.error('[Worker] Unhandled rejection:', reason)
})
