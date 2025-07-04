// Simple in-memory rate limiter for API routes

type RateLimitEntry = {
  count: number;
  resetTime: number;
};

// Store rate limit data in memory (will reset on server restart)
const rateLimits = new Map<string, RateLimitEntry>();

export const RATE_LIMIT_RESET_TIME = 60 * 1000; // 1 minute in milliseconds
export const MAX_REQUESTS_PER_WINDOW = 10; // Number of requests allowed per window

// IP-based rate limiting
export function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  
  // Get existing data for this identifier
  const rateLimitData = rateLimits.get(identifier);
  
  // If no existing data or window has expired, set/reset counter
  if (!rateLimitData || now > rateLimitData.resetTime) {
    rateLimits.set(identifier, {
      count: 1,
      resetTime: now + RATE_LIMIT_RESET_TIME,
    });
    return false;
  }
  
  // Increment counter and check if over limit
  rateLimitData.count += 1;
  
  // If over limit, return true (request should be limited)
  if (rateLimitData.count > MAX_REQUESTS_PER_WINDOW) {
    return true;
  }
  
  return false;
}

// Clean up expired entries periodically
// In a production environment, consider using a more robust solution like Redis
setInterval(() => {
  const now = Date.now();
  for (const [identifier, data] of rateLimits.entries()) {
    if (now > data.resetTime) {
      rateLimits.delete(identifier);
    }
  }
}, RATE_LIMIT_RESET_TIME);
