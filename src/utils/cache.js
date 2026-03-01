import NodeCache from "node-cache";

// Single cache instance for all data
// stdTTL = default TTL in seconds, checkperiod = cleanup interval
const cache = new NodeCache({ stdTTL: 30, checkperiod: 60 });

/**
 * Get cached data or fetch fresh data
 * @param {string} key - Cache key
 * @param {Function} fetcher - Async function to fetch data
 * @param {number} ttl - TTL in seconds
 */
export async function cachedFetch(key, fetcher, ttl) {
  const cached = cache.get(key);
  if (cached) return cached;

  const data = await fetcher();
  cache.set(key, data, ttl);
  return data;
}

export function getCacheStats() {
  return cache.getStats();
}
