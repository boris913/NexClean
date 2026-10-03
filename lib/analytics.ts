// ============================================================
// ANALYTICS — mesure des conversions (Google Analytics 4).
// Activé uniquement si NEXT_PUBLIC_GA_ID est défini.
// Les clics WhatsApp / appels / e-mails sont suivis automatiquement
// (voir components/analytics/Analytics.tsx).
// ============================================================

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export type AnalyticsEvent =
  | 'whatsapp_click'
  | 'phone_click'
  | 'email_click'
  | 'quote_form_submit'
  | 'job_application_submit'
  | 'product_order_click';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent(event: AnalyticsEvent, params: Record<string, string | number> = {}) {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', event, { page_path: window.location.pathname, ...params });
}
