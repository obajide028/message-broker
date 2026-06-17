import { registerAs } from '@nestjs/config';

export default registerAs('broker', () => ({
  port: parseInt(process.env.BROKER_PORT ?? '3000', 10),
  
  persistence: {
    adapter: process.env.PERSISTENCE_ADAPTER ?? 'memory',
  },

  ws: {
    cors: process.env.WS_CORS_ORIGIN ?? '*',
    pingInterval: parseInt(process.env.WS_PING_INTERVAL ?? '25000', 10),
    pingTimeout: parseInt(process.env.WS_PING_TIMEOUT ?? '60000', 10),
  },

  scheduler: {
    retryIntervalMs: parseInt(process.env.RETRY_INTERVAL_MS ?? '30000', 10),
    evictIntervalMs: parseInt(process.env.EVICT_INTERVAL_MS ?? '60000', 10),
  },

  message: {
    defaultTtlMs: parseInt(process.env.DEFAULT_TTL_MS ?? '86400000', 10), // 24h
    defaultMaxRetries: parseInt(process.env.DEFAULT_MAX_RETRIES ?? '3', 10),
  },
}));