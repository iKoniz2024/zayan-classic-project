export function getApiUrl() {
  if (typeof window === "undefined") {
    // Server side: Force 127.0.0.1 to avoid Node.js 18+ IPv6 (::1) 3-second DNS connection fallback timeout
    let serverUrl =
      process.env.INTERNAL_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://127.0.0.1:5000/api";
    serverUrl = serverUrl.replace("localhost", "127.0.0.1").trim().replace(/\/+$/, "");
    if (!serverUrl.endsWith("/api")) {
      serverUrl += "/api";
    }
    return serverUrl;
  }

  // Client side (browser)
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return "http://localhost:5000/api";
  }

  let clientUrl = process.env.NEXT_PUBLIC_API_URL;

  // If in production browser but NEXT_PUBLIC_API_URL was set to localhost, ignore localhost!
  if (!clientUrl || clientUrl.includes("localhost") || clientUrl.includes("127.0.0.1")) {
    clientUrl = window.location.origin + "/api";
  }

  clientUrl = clientUrl.trim().replace(/\/+$/, "");

  if (!clientUrl.endsWith("/api")) {
    clientUrl += "/api";
  }

  return clientUrl;
}
