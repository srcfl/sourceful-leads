import { chromium, Browser } from "playwright";
import { Lead } from "@/types/lead";

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
    });
  }
  return browser;
}

export async function searchGoogleMaps(
  query: string,
  location: string
): Promise<Lead[]> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    locale: "sv-SE",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(
      `${query} ${location}`
    )}`;

    await page.goto(searchUrl, { waitUntil: "networkidle", timeout: 30000 });

    // Accept cookies if prompted
    try {
      const acceptButton = page.locator('button:has-text("Acceptera alla")');
      if (await acceptButton.isVisible({ timeout: 3000 })) {
        await acceptButton.click();
        await page.waitForTimeout(1000);
      }
    } catch {
      // No cookie banner
    }

    // Wait for results to load
    await page.waitForTimeout(2000);

    // Scroll to load more results
    const feed = page.locator('div[role="feed"]');
    if (await feed.isVisible()) {
      for (let i = 0; i < 5; i++) {
        await feed.evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        });
        await page.waitForTimeout(1500);
      }
    }

    // Extract business data
    const leads = await page.evaluate(() => {
      const results: Lead[] = [];
      const items = document.querySelectorAll('div[role="feed"] > div > div > a');

      items.forEach((item, index) => {
        const container = item.closest('div[jsaction]');
        if (!container) return;

        const nameEl = container.querySelector(".fontHeadlineSmall");
        const name = nameEl?.textContent?.trim();
        if (!name) return;

        // Get aria-label which contains rating info
        const ariaLabel = item.getAttribute("aria-label") || "";

        // Extract rating from aria-label (e.g., "4.5 stars 123 reviews")
        const ratingMatch = ariaLabel.match(/(\d+[.,]\d+)\s*(stjärn|star)/i);
        const reviewMatch = ariaLabel.match(/(\d+)\s*(recension|review)/i);

        const rating = ratingMatch ? parseFloat(ratingMatch[1].replace(",", ".")) : undefined;
        const reviewCount = reviewMatch ? parseInt(reviewMatch[1]) : undefined;

        // Get address and other info
        const infoElements = container.querySelectorAll(".fontBodyMedium");
        let address = "";
        let category = "";
        let phone = "";

        infoElements.forEach((el) => {
          const text = el.textContent?.trim() || "";
          if (text.match(/^\+?\d[\d\s-]{6,}/)) {
            phone = text;
          } else if (text.match(/\d{3}\s?\d{2}/) || text.includes(",")) {
            // Looks like an address (has postal code or comma)
            if (!address) address = text;
          } else if (!category && text.length < 50 && !text.includes("Öppet") && !text.includes("Stängt")) {
            category = text;
          }
        });

        // Get website link
        const websiteEl = container.querySelector('a[data-value="Website"]') as HTMLAnchorElement;
        const website = websiteEl?.href;

        // Get place ID from URL
        const href = (item as HTMLAnchorElement).href;
        const placeIdMatch = href.match(/place\/([^/]+)/);
        const placeId = placeIdMatch ? placeIdMatch[1] : undefined;

        results.push({
          id: `lead-${index}-${Date.now()}`,
          name,
          address: address || "Address not available",
          phone: phone || undefined,
          website,
          rating,
          reviewCount,
          category: category || undefined,
          placeId,
          enriched: false,
        });
      });

      return results;
    }) as Lead[];

    await context.close();
    return leads;
  } catch (error) {
    console.error("Scraping error:", error);
    await context.close();
    throw error;
  }
}

export async function enrichFromWebsite(
  websiteUrl: string
): Promise<{ email?: string; phone?: string }> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    await page.goto(websiteUrl, { waitUntil: "domcontentloaded", timeout: 15000 });

    const result = await page.evaluate(() => {
      const bodyText = document.body.innerText;

      // Find emails
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const emailMatches = bodyText.match(emailRegex);
      const emails: string[] = emailMatches ? [...emailMatches] : [];

      // Filter out common non-business emails
      const filteredEmails: string[] = emails.filter(
        (e) =>
          !e.includes("example") &&
          !e.includes("test") &&
          !e.includes("wix") &&
          !e.includes("wordpress") &&
          !e.includes("squarespace")
      );

      // Find phone numbers (Swedish format)
      const phoneRegex = /(?:\+46|0)[\s.-]?\d{2,3}[\s.-]?\d{2,3}[\s.-]?\d{2,4}/g;
      const phoneMatches = bodyText.match(phoneRegex);
      const phones: string[] = phoneMatches ? [...phoneMatches] : [];

      // Also check mailto links
      const mailtoLinks = document.querySelectorAll('a[href^="mailto:"]');
      mailtoLinks.forEach((link) => {
        const href = link.getAttribute("href");
        if (href) {
          const email = href.replace("mailto:", "").split("?")[0];
          if (!filteredEmails.includes(email)) {
            filteredEmails.push(email);
          }
        }
      });

      // Check tel links
      const telLinks = document.querySelectorAll('a[href^="tel:"]');
      telLinks.forEach((link) => {
        const href = link.getAttribute("href");
        if (href) {
          const phone = href.replace("tel:", "").replace(/\s/g, "");
          if (!phones.includes(phone)) {
            phones.push(phone);
          }
        }
      });

      return {
        email: filteredEmails[0] || undefined,
        phone: phones[0] || undefined,
      };
    });

    // Try to find contact page if no email found
    if (!result.email) {
      const contactLinks = await page.$$('a[href*="kontakt"], a[href*="contact"], a:has-text("Kontakt"), a:has-text("Contact")');

      if (contactLinks.length > 0) {
        try {
          await contactLinks[0].click();
          await page.waitForLoadState("domcontentloaded", { timeout: 5000 });

          const contactResult = await page.evaluate(() => {
            const bodyText = document.body.innerText;
            const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
            const emailMatches = bodyText.match(emailRegex);
            const emails: string[] = emailMatches ? [...emailMatches] : [];
            const filteredEmails: string[] = emails.filter(
              (e) =>
                !e.includes("example") &&
                !e.includes("test") &&
                !e.includes("wix") &&
                !e.includes("wordpress")
            );

            const phoneRegex = /(?:\+46|0)[\s.-]?\d{2,3}[\s.-]?\d{2,3}[\s.-]?\d{2,4}/g;
            const phoneMatches = bodyText.match(phoneRegex);
            const phones: string[] = phoneMatches ? [...phoneMatches] : [];

            return {
              email: filteredEmails[0] || undefined,
              phone: phones[0] || undefined,
            };
          });

          if (contactResult.email) result.email = contactResult.email;
          if (contactResult.phone && !result.phone) result.phone = contactResult.phone;
        } catch {
          // Couldn't navigate to contact page
        }
      }
    }

    await context.close();
    return result;
  } catch (error) {
    console.error("Enrichment error:", error);
    await context.close();
    return {};
  }
}

export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
