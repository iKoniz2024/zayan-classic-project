/**
 * Helper to safely track client-side Meta Pixel events (AddToCart, ViewContent, InitiateCheckout, Purchase, etc.)
 */
export const trackMetaPixelEvent = (eventName, data = {}) => {
  if (typeof window !== "undefined" && window.fbq) {
    try {
      const payload = { ...data };

      if (payload.currency) {
        payload.currency = String(payload.currency).toUpperCase().trim();
      } else if (payload.value !== undefined) {
        payload.currency = "BDT";
      }

      if (payload.value !== undefined) {
        const val = Number(payload.value);
        payload.value = Number.isFinite(val) ? Number(val.toFixed(2)) : 0;
      }

      window.fbq("track", eventName, payload);
      if (process.env.NODE_ENV !== "production") {
        console.log(`[Meta Pixel Client Event]: ${eventName}`, payload);
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[Meta Pixel Client Warning]:", err);
      }
    }
  } else if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
    console.log(`[Meta Pixel Event Pending ID Setup]: ${eventName}`, data);
  }
};
