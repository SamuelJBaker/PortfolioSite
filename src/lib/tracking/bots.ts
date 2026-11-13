/**
 * User-agent fragments that mark a session as a bot: link previewers,
 * crawlers, HTTP libraries, headless browsers and mail-security scanners.
 * Matched case-insensitively as substrings of the visit_server user agent.
 * Maintained by hand; add a fragment when a new scanner shows up in the
 * admin session list.
 */
export const BOT_UA_FRAGMENTS: readonly string[] = [
  // link previewers
  "Slackbot",
  "LinkedInBot",
  "facebookexternalhit",
  "Twitterbot",
  "Discordbot",
  "WhatsApp",
  "TelegramBot",
  "Embedly",
  "Iframely",
  // crawlers
  "Googlebot",
  "bingbot",
  "AhrefsBot",
  "SemrushBot",
  "DuckDuckBot",
  "YandexBot",
  "Applebot",
  "PetalBot",
  "DotBot",
  "MJ12bot",
  "GPTBot",
  "ClaudeBot",
  "CCBot",
  "Bytespider",
  // http libraries and tools
  "curl/",
  "Wget",
  "python-requests",
  "Python-urllib",
  "aiohttp",
  "Go-http-client",
  "okhttp",
  "Java/",
  "libwww-perl",
  "node-fetch",
  "undici",
  "axios/",
  "HTTPie",
  "PostmanRuntime",
  // headless browsers
  "HeadlessChrome",
  "PhantomJS",
  "Puppeteer",
  "Playwright",
  "Selenium",
  // mail-security and url scanners
  "Proofpoint",
  "Mimecast",
  "Barracuda",
  "urlscan",
  "Microsoft Office",
  "Outlook-iOS",
  "SafeLinks",
  "Zscaler",
  "FireEye",
  "Symantec",
  "Trend Micro",
  "BitDefender",
  "Sophos",
  "Avast",
  "Kaspersky",
  "Cisco",
  "Palo Alto",
  "Fortinet",
  "Netcraft",
  "Pingdom",
  "UptimeRobot",
  "StatusCake",
  "Site24x7",
];

const LOWER = BOT_UA_FRAGMENTS.map((f) => f.toLowerCase());

/** True when the user agent contains any listed fragment (case-insensitive). Empty or missing agents are not bots by this test. */
export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return false;
  const lower = ua.toLowerCase();
  return LOWER.some((f) => lower.includes(f));
}
