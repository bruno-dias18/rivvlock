import { logger } from './logger';

/**
 * Performance monitoring utilities for RivvLock
 */

interface PerformanceMark {
  name: string;
  startTime: number;
}

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: Date;
}

class PerformanceMonitor {
  private marks: Map<string, PerformanceMark> = new Map();
  private metrics: PerformanceMetric[] = [];
  private readonly maxMetrics = 100;

  /**
   * Start measuring a performance metric
   */
  startMeasure(name: string): void {
    this.marks.set(name, {
      name,
      startTime: performance.now(),
    });
  }

  /**
   * End measuring and record the metric
   */
  endMeasure(name: string): number | null {
    const mark = this.marks.get(name);
    if (!mark) {
      logger.warn(`Performance mark "${name}" not found`);
      return null;
    }

    const duration = performance.now() - mark.startTime;
    this.marks.delete(name);

    // Store metric
    this.metrics.push({
      name,
      duration,
      timestamp: new Date(),
    });

    // Limit stored metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Log slow operations (> 1 second)
    if (duration > 1000) {
      logger.warn(`Slow operation detected: ${name} took ${duration.toFixed(2)}ms`);
    }

    return duration;
  }

  /**
   * Get average duration for a specific metric
   */
  getAverageDuration(name: string): number {
    const relevantMetrics = this.metrics.filter(m => m.name === name);
    if (relevantMetrics.length === 0) return 0;

    const total = relevantMetrics.reduce((sum, m) => sum + m.duration, 0);
    return total / relevantMetrics.length;
  }

  /**
   * Get all recorded metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    this.marks.clear();
  }

  /**
   * Get performance summary
   */
  getSummary(): Record<string, { count: number; average: number; max: number }> {
    const summary: Record<string, { count: number; average: number; max: number }> = {};

    this.metrics.forEach(metric => {
      if (!summary[metric.name]) {
        summary[metric.name] = { count: 0, average: 0, max: 0 };
      }

      summary[metric.name].count++;
      summary[metric.name].max = Math.max(summary[metric.name].max, metric.duration);
    });

    // Calculate averages
    Object.keys(summary).forEach(name => {
      const relevantMetrics = this.metrics.filter(m => m.name === name);
      const total = relevantMetrics.reduce((sum, m) => sum + m.duration, 0);
      summary[name].average = total / relevantMetrics.length;
    });

    return summary;
  }
}

export const performanceMonitor = new PerformanceMonitor();

/**
 * Core Web Vitals monitoring
 * Tracks key performance metrics: LCP, INP, CLS, FCP, TTFB
 */
interface WebVitalMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
}

const webVitalsMetrics: WebVitalMetric[] = [];

function sendToAnalytics(metric: WebVitalMetric) {
  webVitalsMetrics.push(metric);
  
  // Log only poor ratings in production
  if (import.meta.env.PROD && metric.rating === 'poor') {
    logger.warn(`⚠️ Poor Web Vital: ${metric.name} = ${metric.value.toFixed(2)}ms (${metric.rating})`);
  }
  
  // In development, log all metrics
  if (!import.meta.env.PROD) {
    logger.log(`📊 Web Vital: ${metric.name} = ${metric.value.toFixed(2)}ms (${metric.rating})`);
  }
}

/**
 * Initialize Core Web Vitals tracking
 * Should be called once in main.tsx
 */
export async function initWebVitals() {
  if (typeof window === 'undefined') return;
  
  try {
    const { onCLS, onINP, onLCP, onFCP, onTTFB } = await import('web-vitals');
    
    onCLS((metric) => sendToAnalytics({ 
      name: 'CLS', 
      value: metric.value, 
      rating: metric.rating,
      delta: metric.delta 
    }));
    
    onINP((metric) => sendToAnalytics({ 
      name: 'INP', 
      value: metric.value, 
      rating: metric.rating,
      delta: metric.delta 
    }));
    
    onLCP((metric) => sendToAnalytics({ 
      name: 'LCP', 
      value: metric.value, 
      rating: metric.rating,
      delta: metric.delta 
    }));
    
    onFCP((metric) => sendToAnalytics({ 
      name: 'FCP', 
      value: metric.value, 
      rating: metric.rating,
      delta: metric.delta 
    }));
    
    onTTFB((metric) => sendToAnalytics({ 
      name: 'TTFB', 
      value: metric.value, 
      rating: metric.rating,
      delta: metric.delta 
    }));
    
    logger.log('✅ Core Web Vitals monitoring initialized');
  } catch (error) {
    logger.error('Failed to initialize Web Vitals:', error);
  }
}

/**
 * Get all collected Web Vitals metrics
 */
export function getWebVitalsMetrics(): WebVitalMetric[] {
  return [...webVitalsMetrics];
}

/**
 * Get Web Vitals summary
 */
export function getWebVitalsSummary(): Record<string, WebVitalMetric> {
  const summary: Record<string, WebVitalMetric> = {};
  
  webVitalsMetrics.forEach(metric => {
    // Keep only the latest value for each metric
    summary[metric.name] = metric;
  });
  
  return summary;
}
