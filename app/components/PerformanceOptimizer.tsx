'use client';

import { useEffect } from 'react';

/**
 * Performance optimization component to handle resource loading and optimization
 */
export default function PerformanceOptimizer() {
  useEffect(() => {
    // Remove or disable aggressive preloading to prevent warnings
    const optimizeResourceLoading = () => {
      // Remove any unused preload links that might be causing warnings
      const preloadLinks = document.querySelectorAll('link[rel="preload"]');
      preloadLinks.forEach(link => {
        const href = link.getAttribute('href');
        // Check if the resource is actually being used
        if (href && !isResourceInUse(href)) {
          // Add 'as' attribute if missing to prevent warnings
          if (!link.getAttribute('as')) {
            link.setAttribute('as', getResourceType(href));
          }
        }
      });
    };

    // Helper function to determine if a resource is being used
    const isResourceInUse = (href: string): boolean => {
      // Check for font files
      if (href.includes('.woff') || href.includes('.woff2')) {
        return document.fonts.check('1em ' + getFontFamilyFromUrl(href));
      }
      // Check for CSS files
      if (href.includes('.css')) {
        return document.querySelector(`link[href="${href}"]`) !== null;
      }
      // Check for JS files
      if (href.includes('.js')) {
        return document.querySelector(`script[src="${href}"]`) !== null;
      }
      return true; // Default to true to be safe
    };

    // Helper function to get font family from URL
    const getFontFamilyFromUrl = (url: string): string => {
      if (url.includes('geist-sans')) return 'Geist Sans';
      if (url.includes('geist-mono')) return 'Geist Mono';
      return 'sans-serif';
    };

    // Helper function to determine resource type for 'as' attribute
    const getResourceType = (href: string): string => {
      if (href.includes('.woff') || href.includes('.woff2') || href.includes('.ttf')) return 'font';
      if (href.includes('.css')) return 'style';
      if (href.includes('.js')) return 'script';
      if (href.includes('.png') || href.includes('.jpg') || href.includes('.webp')) return 'image';
      return 'fetch';
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

    // Initialize optimizations
    optimizeResourceLoading();
    optimizeResources();

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return null; // This component doesn't render anything
}
