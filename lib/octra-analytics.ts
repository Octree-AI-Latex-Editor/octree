/**
 * Analytics and monitoring for Octra AI interactions
 * Helps track usage patterns, model performance, and costs
 */

export interface OctraAnalyticsEvent {
  eventType: 'request' | 'response' | 'error';
  model: string;
  timestamp: number;
  duration?: number;
  tokenCount?: number;
  complexity?: 'simple' | 'moderate' | 'complex';
  errorType?: string;
  fileLineCount?: number;
}

class OctraAnalytics {
  private events: OctraAnalyticsEvent[] = [];
  private readonly MAX_EVENTS = 1000;

  logEvent(event: OctraAnalyticsEvent) {
    this.events.push(event);

    // Keep only recent events to prevent memory issues
    if (this.events.length > this.MAX_EVENTS) {
      this.events = this.events.slice(-this.MAX_EVENTS);
    }

    // In production, send to analytics service
    if (process.env.ENVIRONMENT === 'prod') {
      this.sendToAnalytics(event);
    }
  }

  private sendToAnalytics(event: OctraAnalyticsEvent) {
    // Placeholder for analytics integration (e.g., PostHog, Mixpanel, etc.)
    // console.log('[Analytics]', event);
  }

  getStats() {
    const total = this.events.length;
    const errors = this.events.filter(e => e.eventType === 'error').length;
    const avgDuration = this.events
      .filter(e => e.duration)
      .reduce((sum, e) => sum + (e.duration || 0), 0) / total || 0;

    const modelUsage = this.events.reduce((acc, e) => {
      acc[e.model] = (acc[e.model] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      errors,
      errorRate: errors / total || 0,
      avgDuration,
      modelUsage,
    };
  }
}

// Singleton instance
const analytics = new OctraAnalytics();

export function logOctraEvent(event: OctraAnalyticsEvent) {
  analytics.logEvent(event);
}

export function getOctraStats() {
  return analytics.getStats();
} 