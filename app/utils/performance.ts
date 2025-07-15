// Development performance utilities
export const isDevelopment = process.env.NODE_ENV === 'development';
export const isProduction = process.env.NODE_ENV === 'production';

// Rate-limited console logging to prevent spam
class RateLimitedLogger {
  private lastLogTimes: Map<string, number> = new Map();
  private readonly rateLimitMs: number;

  constructor(rateLimitMs: number = 5000) {
    this.rateLimitMs = rateLimitMs;
  }

  log(key: string, message: any, ...args: any[]) {
    const now = Date.now();
    const lastLogTime = this.lastLogTimes.get(key) || 0;

    if (now - lastLogTime >= this.rateLimitMs) {
      console.log(message, ...args);
      this.lastLogTimes.set(key, now);
    }
  }

  warn(key: string, message: any, ...args: any[]) {
    const now = Date.now();
    const lastLogTime = this.lastLogTimes.get(key) || 0;

    if (now - lastLogTime >= this.rateLimitMs) {
      console.warn(message, ...args);
      this.lastLogTimes.set(key, now);
    }
  }

  error(_key: string, message: any, ...args: any[]) {
    // Always log errors immediately
    console.error(message, ...args);
  }
}

// Global rate-limited logger instance
export const rateLogger = new RateLimitedLogger(10000); // 10 seconds rate limit

// Performance measurement utilities
export const perfStart = (label: string) => {
  if (isDevelopment) {
    performance.mark(`${label}-start`);
  }
};

export const perfEnd = (label: string) => {
  if (isDevelopment) {
    performance.mark(`${label}-end`);
    performance.measure(label, `${label}-start`, `${label}-end`);
    const measure = performance.getEntriesByName(label)[0];
    if (measure) {
      rateLogger.log(
        `perf-${label}`,
        `⚡ [PERFORMANCE] ${label}: ${measure.duration.toFixed(2)}ms`
      );
    }
  }
};

// Debounce utility for frequent operations
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  waitMs: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), waitMs);
  };
};

// Throttle utility for frequent operations
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limitMs: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limitMs);
    }
  };
};

// Memory usage monitoring (development only)
export const logMemoryUsage = () => {
  if (isDevelopment && 'memory' in performance) {
    const memInfo = (performance as any).memory;
    rateLogger.log(
      'memory-usage',
      `🧠 [MEMORY] Used: ${(memInfo.usedJSHeapSize / 1048576).toFixed(2)}MB, ` +
      `Total: ${(memInfo.totalJSHeapSize / 1048576).toFixed(2)}MB, ` +
      `Limit: ${(memInfo.jsHeapSizeLimit / 1048576).toFixed(2)}MB`
    );
  }
};

// Optimized console methods for development
export const devConsole = {
  log: isDevelopment ? 
    (message: any, ...args: any[]) => console.log(message, ...args) : 
    () => {},
  warn: (message: any, ...args: any[]) => console.warn(message, ...args),
  error: (message: any, ...args: any[]) => console.error(message, ...args),
  group: isDevelopment ? 
    (label: string) => console.group(label) : 
    () => {},
  groupEnd: isDevelopment ? 
    () => console.groupEnd() : 
    () => {},
  time: isDevelopment ? 
    (label: string) => console.time(label) : 
    () => {},
  timeEnd: isDevelopment ? 
    (label: string) => console.timeEnd(label) : 
    () => {},
};
