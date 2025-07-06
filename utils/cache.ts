// Simple in-memory cache with TTL (Time To Live)
// Perfect for marketing stats that only need hourly accuracy

interface CacheItem<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

class SimpleCache {
  private cache: Map<string, CacheItem<any>> = new Map()
  private readonly DEFAULT_TTL = 60 * 60 * 1000 // 1 hour in milliseconds

  /**
   * Set a value in cache with optional TTL
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Time to live in milliseconds (default: 1 hour)
   */
  set<T>(key: string, value: T, ttl: number = this.DEFAULT_TTL): void {
    const item: CacheItem<T> = {
      data: value,
      timestamp: Date.now(),
      ttl
    }
    this.cache.set(key, item)
  }

  /**
   * Get a value from cache if it exists and hasn't expired
   * @param key Cache key
   * @returns Cached value or null if not found/expired
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key)
    
    if (!item) {
      return null
    }

    const now = Date.now()
    const isExpired = (now - item.timestamp) > item.ttl

    if (isExpired) {
      this.cache.delete(key)
      return null
    }

    return item.data as T
  }

  /**
   * Check if a key exists and is valid (not expired)
   * @param key Cache key
   * @returns True if key exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null
  }

  /**
   * Delete a specific key from cache
   * @param key Cache key to delete
   */
  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   * @returns Object with cache size and item details
   */
  getStats(): { size: number; items: Array<{ key: string; age: number; ttl: number }> } {
    const now = Date.now()
    const items: Array<{ key: string; age: number; ttl: number }> = []

    for (const [key, item] of this.cache.entries()) {
      items.push({
        key,
        age: now - item.timestamp,
        ttl: item.ttl
      })
    }

    return {
      size: this.cache.size,
      items
    }
  }

  /**
   * Clean up expired entries
   * @returns Number of entries removed
   */
  cleanup(): number {
    const now = Date.now()
    let removed = 0

    for (const [key, item] of this.cache.entries()) {
      const isExpired = (now - item.timestamp) > item.ttl
      if (isExpired) {
        this.cache.delete(key)
        removed++
      }
    }

    return removed
  }
}

// Create singleton instance
const cache = new SimpleCache()

// Cache keys for marketing endpoints
export const MARKETING_CACHE_KEYS = {
  WEEKLY_ACTIVITY: 'marketing:weekly-activity',
  TOTAL_HOURS: 'marketing:total-hours',
  AVERAGE_WEEKLY_HOURS: 'marketing:average-weekly-hours',
  DAILY_ACTIVITY: 'marketing:daily-activity',
  TOP_CREATING_DAYS: 'marketing:top-creating-days'
} as const

// Export cache instance and helper functions
export { cache }

/**
 * Get cached data or execute function if cache miss
 * @param key Cache key
 * @param fetchFunction Function to execute on cache miss
 * @param ttl Time to live in milliseconds (default: 1 hour)
 * @returns Cached or freshly fetched data
 */
export async function getCachedOrFetch<T>(
  key: string,
  fetchFunction: () => Promise<T>,
  ttl: number = 60 * 60 * 1000
): Promise<T> {
  // Try to get from cache first
  const cachedData = cache.get<T>(key)
  
  if (cachedData !== null) {
    console.log(`Cache HIT for key: ${key}`)
    return cachedData
  }

  // Cache miss - fetch fresh data
  console.log(`Cache MISS for key: ${key} - fetching fresh data`)
  const freshData = await fetchFunction()
  
  // Store in cache
  cache.set(key, freshData, ttl)
  
  return freshData
}

/**
 * Get cache key with dynamic parameters
 * @param baseKey Base cache key
 * @param params Parameters to include in key
 * @returns Generated cache key
 */
export function getCacheKey(baseKey: string, params?: Record<string, any>): string {
  if (!params || Object.keys(params).length === 0) {
    return baseKey
  }
  
  const paramString = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b)) // Sort for consistent keys
    .map(([key, value]) => `${key}:${value}`)
    .join('|')
  
  return `${baseKey}:${paramString}`
}

// Optional: Set up periodic cleanup (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const removed = cache.cleanup()
    if (removed > 0) {
      console.log(`Cache cleanup: removed ${removed} expired entries`)
    }
  }, 5 * 60 * 1000) // 5 minutes
}

export default cache 