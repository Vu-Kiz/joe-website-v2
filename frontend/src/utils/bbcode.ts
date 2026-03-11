// src/utils/bbcode.ts

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeUrl(url: string): string | null {
  const u = url.trim();
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  return null;
}

function safeColor(input: string): string | null {
  const v = input.trim();
  if (/^#[0-9a-f]{3,8}$/i.test(v)) return v;
  if (/^[a-z]{3,20}$/i.test(v)) return v;
  return null;
}

function safeSize(input: string): string | null {
  const v = input.trim();
  if (/^\d{1,2}px$/i.test(v)) return v;
  if (/^\d{1,3}%$/i.test(v)) return v;
  return null;
}

/**
 * Convert BBCode -> safe-ish HTML.
 *
 * Supported tags:
 * [b] [i] [u] [s]
 * [quote] [code]
 * [url]https://...[/url]
 * [url=https://...]text[/url]
 * [img]https://...[/img]
 * [color=red] [/color]
 * [size=14px] [/size]
 * [left] [center] [right]
 * [hr]
 * [spoiler]
 *
 * We escape first, then apply a whitelist of replacements.
 */
export function bbcodeToHtml(raw: string): string {
  let html = escapeHtml(raw ?? "");

  // Horizontal rule
  html = html.replace(/\[hr\]/gi, '<hr class="bb-hr" />');

  // Basic inline tags
  html = html.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, "<strong>$1</strong>");
  html = html.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, "<em>$1</em>");
  html = html.replace(/\[u\]([\s\S]*?)\[\/u\]/gi, "<u>$1</u>");
  html = html.replace(/\[s\]([\s\S]*?)\[\/s\]/gi, "<s>$1</s>");

  // Quote / code / spoiler
  html = html.replace(
    /\[quote\]([\s\S]*?)\[\/quote\]/gi,
    '<blockquote class="bb-quote">$1</blockquote>'
  );

  html = html.replace(
    /\[code\]([\s\S]*?)\[\/code\]/gi,
    '<pre class="bb-code"><code>$1</code></pre>'
  );

  html = html.replace(
    /\[spoiler\]([\s\S]*?)\[\/spoiler\]/gi,
    '<span class="bb-spoiler">$1</span>'
  );

  // Alignment
  html = html.replace(
    /\[left\]([\s\S]*?)\[\/left\]/gi,
    '<div class="bb-left">$1</div>'
  );
  html = html.replace(
    /\[center\]([\s\S]*?)\[\/center\]/gi,
    '<div class="bb-center">$1</div>'
  );
  html = html.replace(
    /\[right\]([\s\S]*?)\[\/right\]/gi,
    '<div class="bb-right">$1</div>'
  );

  // Color
  html = html.replace(/\[color=([^\]]+)\]([\s\S]*?)\[\/color\]/gi, (_m, color, inner) => {
    const safe = safeColor(color);
    if (!safe) return inner;
    return `<span style="color:${safe}">${inner}</span>`;
  });

  // Size
  html = html.replace(/\[size=([^\]]+)\]([\s\S]*?)\[\/size\]/gi, (_m, size, inner) => {
    const safe = safeSize(size);
    if (!safe) return inner;
    return `<span style="font-size:${safe}">${inner}</span>`;
  });

  // [url]https://...[/url]
  html = html.replace(/\[url\]([\s\S]*?)\[\/url\]/gi, (_m, p1) => {
    const u = safeUrl(p1);
    if (!u) return p1;
    return `<a href="${u}" target="_blank" rel="noopener noreferrer">${
      escapeHtml(u)
    }</a>`;
  });

  // [url=https://...]text[/url]
  html = html.replace(/\[url=([\s\S]*?)\]([\s\S]*?)\[\/url\]/gi, (_m, p1, p2) => {
    const u = safeUrl(p1);
    if (!u) return p2;
    return `<a href="${u}" target="_blank" rel="noopener noreferrer">${p2}</a>`;
  });

  // [img]https://...[/img]
  html = html.replace(/\[img\]([\s\S]*?)\[\/img\]/gi, (_m, p1) => {
    const u = safeUrl(p1);
    if (!u) return "";
    return `<img src="${u}" alt="image" class="bb-img" />`;
  });

  // Preserve line breaks
  html = html.replace(/\r\n|\n|\r/g, "<br />");

  return html;
}