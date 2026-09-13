/**
 * Helper to safely track client-side Meta Pixel events (AddToCart, ViewContent, InitiateCheckout, Purchase, etc.)
 */
export const trackMetaPixelEvent = (eventName, data = {}) => {
  if (typeof window !== "undefined" && window.fbq) {
    try {
      window.fbq("track", eventName, data);
      if (process.env.NODE_ENV !== "production") {
        console.log(`[Meta Pixel Client Event]: ${eventName}`, data);
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
