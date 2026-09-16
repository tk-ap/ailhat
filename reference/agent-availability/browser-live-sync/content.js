// Live Source Sync intentionally reads only visible page text.
// It does not inspect cookies, localStorage, network requests, passwords, or tokens.
const text = () => document.body?.innerText || '';

function numberAfter(patterns) {
  for (const re of patterns) {
    const m = text().match(re);
    if (m) return Number(m[1]);
  }
  return null;
}

function hoursAfter(patterns) {
  for (const re of patterns) {
    const m = text().match(re);
    if (m) return Number(m[1]) * 60 * 60 * 1000;
  }
  return null;
}

function extract() {
  const host = location.hostname;
  const provider = host.includes('cto.new') ? 'cto.new' : 'ChatGPT';
  const cap = numberAfter([/(\d{1,3})\s*%\s*(?:available|remaining|left)/i, /(?:available|remaining|left)[^\d]{0,20}(\d{1,3})\s*%/i]);
  const delay = hoursAfter([/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\s*(?:until|to|before)/i, /(?:in|after)\s*(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i]);
  const next = delay == null ? null : Date.now() + delay;
  return { provider, cap, next, url: location.href, title: document.title, observedAt: Date.now(), method: 'browser', confidence: cap != null ? 'medium' : 'low' };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'extractAvailability') sendResponse(extract());
});

// Re-extract when the visible page changes, without scraping private state.
let last = '';
const observer = new MutationObserver(() => {
  const current = text().slice(0, 20000);
  if (current !== last) last = current;
});
if (document.body) observer.observe(document.body, {subtree: true, childList: true, characterData: true});