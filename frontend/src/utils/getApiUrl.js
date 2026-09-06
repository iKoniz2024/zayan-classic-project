// export function getApiUrl() {
//   let url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
//   url = url.trim().replace(/\/+$/, "");
//   if (!url.endsWith("/api")) {
//     url += "/api";
//   }
//   return url;
// }


export function getApiUrl() {
  let url =
    typeof window === "undefined"
      ? process.env.INTERNAL_API_URL
      : process.env.NEXT_PUBLIC_API_URL;

  url = (url || "http://localhost:5000/api").trim().replace(/\/+$/, "");

  if (!url.endsWith("/api")) {
    url += "/api";
  }

  return url;
}