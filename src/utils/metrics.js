// Simple in-memory metrics (persists per server restart)
// For production, swap with Redis or a DB

const metrics = {
  totalQueries: 0,
  queriesByEndpoint: {},
  totalRevenueUsd: 0,
  revenueByEndpoint: {},
  startedAt: new Date().toISOString(),
  uniqueCallers: new Set(),
};

// Price map (matches config.pricing but as numbers)
const priceMap = {
  "/api/v1/prices": 0.001,
  "/api/v1/trending": 0.002,
  "/api/v1/whale-alerts": 0.005,
  "/api/v1/sentiment": 0.003,
  "/api/v1/agent-score": 0.005,
  "/api/v1/token-scanner": 0.005,
};

export function trackQuery(endpoint, callerAddress) {
  metrics.totalQueries++;
  metrics.queriesByEndpoint[endpoint] =
    (metrics.queriesByEndpoint[endpoint] || 0) + 1;

  const price = priceMap[endpoint] || 0;
  metrics.totalRevenueUsd += price;
  metrics.revenueByEndpoint[endpoint] =
    (metrics.revenueByEndpoint[endpoint] || 0) + price;

  if (callerAddress) {
    metrics.uniqueCallers.add(callerAddress);
  }
}

export function getMetrics() {
  return {
    totalQueries: metrics.totalQueries,
    queriesByEndpoint: { ...metrics.queriesByEndpoint },
    totalRevenueUsd: Math.round(metrics.totalRevenueUsd * 10000) / 10000,
    revenueByEndpoint: { ...metrics.revenueByEndpoint },
    uniqueCallers: metrics.uniqueCallers.size,
    startedAt: metrics.startedAt,
    uptime: Math.floor((Date.now() - new Date(metrics.startedAt)) / 1000),
  };
}
