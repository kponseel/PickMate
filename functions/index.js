const { onCall, HttpsError } = require("firebase-functions/v2/https");

const getMetaContent = (html, property) => {
  const patterns = [
    new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${property}["']`, "i"),
    new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${property}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }
  return "";
};

exports.scrapeUrl = onCall({ cors: true, timeoutSeconds: 15 }, async (request) => {
  const { url } = request.data;

  if (!url || typeof url !== "string") {
    throw new HttpsError("invalid-argument", "URL is required");
  }

  try {
    new URL(url);
  } catch {
    throw new HttpsError("invalid-argument", "Invalid URL");
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PickMate/1.0; +https://pickmate-123c1.web.app)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new HttpsError("not-found", "Could not reach URL");
    }

    const html = await response.text();

    // Extract OG / meta tags
    const title =
      getMetaContent(html, "og:title") ||
      getMetaContent(html, "twitter:title") ||
      (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] ||
      "";

    const description =
      getMetaContent(html, "og:description") ||
      getMetaContent(html, "twitter:description") ||
      getMetaContent(html, "description") ||
      "";

    let image =
      getMetaContent(html, "og:image") ||
      getMetaContent(html, "twitter:image") ||
      "";

    // Make relative image URLs absolute
    if (image && !image.startsWith("http")) {
      const base = new URL(url);
      image = new URL(image, base.origin).href;
    }

    const price =
      getMetaContent(html, "product:price:amount") ||
      getMetaContent(html, "og:price:amount") ||
      "";

    return {
      title: title.trim(),
      description: description.trim(),
      image,
      price: price.trim(),
    };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", "Failed to fetch URL metadata");
  }
});
