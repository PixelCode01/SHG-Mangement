'use client';

import { useEffect } from 'react';

/**
 * Performance optimization component to handle resource loading and optimization
 */
export default function PerformanceOptimizer() {
  useEffect(() => {
    // Preload critical resources only when needed
    const preloadCriticalResources = () => {
      // Only preload in production to avoid development warnings
      if (process.env.NODE_ENV === 'production') {
        // Add any critical resource preloading here
        // Example: prefetch important API routes
        if ('serviceWorker' in navigator) {
          // Register service worker for caching if needed
        }
      }
    };

    // Optimize images and other resources
    const optimizeResources = () => {
      // Add intersection observer for lazy loading if needed
      const images = document.querySelectorAll('img[loading="lazy"]');
      
      if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const img = entry.target as HTMLImageElement;
              if (img.dataset.src) {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                observer.unobserve(img);
              }
            }
          });
        });

        images.forEach(img => imageObserver.observe(img));
      }
    };

    // Debounce function for performance
    const debounce = (func: Function, wait: number) => {
      let timeout: NodeJS.Timeout;
      return function executedFunction(...args: any[]) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    };

    // Throttle scroll events to improve performance
    const handleScroll = debounce(() => {
      // Handle scroll optimizations if needed
    }, 100);

    // Reduce console logging in production
    if (process.env.NODE_ENV === 'production') {
      // Override console methods to reduce logging in production
      const originalConsole = { ...console };
      console.log = () => {};
      console.warn = originalConsole.warn; // Keep warnings
      console.error = originalConsole.error; // Keep errors
    }

    preloadCriticalResources();
    optimizeResources();

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return null; // This component doesn't render anything
}
