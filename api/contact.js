'use strict';

const MAX_BODY_BYTES = 8 * 1024;
const CONTACT_SERVICE_URL = 'https://phyto-booklets.vercel.app/api/contact';
const ALLOWED_CROSS_ORIGINS = new Set([
  'https://elkomymohamed664-dotcom.github.io'
]);

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, function (character) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
  });
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;

  const forwardedHost = req.headers['x-forwarded-host'];
  const requestHost = String(forwardedHost || req.headers.host || '')
    .split(',')[0]
    .trim()
    .toLowerCase();

  try {
    const originUrl = new URL(origin);
    if (originUrl.protocol !== 'https:' && originUrl.protocol !== 'http:') return false;
    return originUrl.host.toLowerCase() === requestHost ||
      ALLOWED_CROSS_ORIGINS.has(originUrl.origin.toLowerCase());
  } catch (error) {
    return false;
  }
}

function corsHeaders(req) {
  const origin = req.headers.origin;
  if (!origin || !sameOrigin(req)) return null;

  try {
    return {
      'Access-Control-Allow-Origin': new URL(origin).origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
      'Access-Control-Max-Age': '600',
      Vary: 'Origin'
    };
  } catch (error) {
    return null;
  }
}

function applyCorsHeaders(req, res) {
  const headers = corsHeaders(req);
  if (!headers) return;
  Object.keys(headers).forEach(function (name) {
    res.setHeader(name, headers[name]);
  });
}

function returnToForm(req) {
  const referer = String(req.headers.referer || '');
  try {
    const pageUrl = new URL(referer);
    const origin = String(req.headers.origin || '');
    if (origin && pageUrl.origin.toLowerCase() === new URL(origin).origin.toLowerCase() && sameOrigin(req)) {
      pageUrl.hash = 'elkomy-contact-form';
      return pageUrl.toString();
    }
  } catch (error) {}

  const origin = String(req.headers.origin || '');
  if (origin && ALLOWED_CROSS_ORIGINS.has(origin.toLowerCase())) {
    return 'https://elkomymohamed664-dotcom.github.io/Elkomy-v2/#elkomy-contact-form';
  }
  return '/#elkomy-contact-form';
}

function respondWithHtml(req, res, statusCode, payload) {
  const successful = statusCode >= 200 && statusCode < 300;
  const heading = successful ? 'وصلت رسالتك' : 'تعذّر إرسال الرسالة';
  const accent = successful ? '#a5d2b3' : '#d8bb82';
  const role = successful ? 'status' : 'alert';
  const message = escapeHtml(payload.message || 'حاول مرة أخرى لاحقًا.');
  const backLink = escapeHtml(returnToForm(req));
  const html = [
    '<!doctype html><html lang="ar" dir="rtl"><head>',
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
    '<meta name="theme-color" content="#081e1f"><title>', heading, ' · PHYTO MOTION</title>',
    '<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#081e1f;color:#f0f1e8;font:16px/1.9 Tahoma,Arial,sans-serif}.card{width:min(100%,560px);padding:30px;border:1px solid rgba(165,210,179,.25);border-right:4px solid ', accent,
    ';border-radius:14px;background:#102b2b;box-shadow:0 18px 50px rgba(0,0,0,.24)}.eyebrow{margin:0 0 8px;color:#d8bb82;font-size:13px;font-weight:700}.card h1{margin:0 0 10px;font-size:25px}.card p:last-of-type{margin:0 0 22px;color:#c1cec3}.card a{display:inline-block;padding:9px 14px;border-radius:7px;background:#d8bb82;color:#102322;font-size:14px;font-weight:700;text-decoration:none}.card a:focus-visible{outline:3px solid #f0d7a7;outline-offset:3px}</style>',
    '</head><body><main class="card" role="', role, '"><p class="eyebrow">PHYTO MOTION · تواصل معنا</p>',
    '<h1>', heading, '</h1><p>', message, '</p><a href="', backLink, '">العودة إلى نموذج التواصل</a>',
    '</main></body></html>'
  ].join('');

  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  return res.end(html);
}

function respond(req, res, statusCode, payload, extraHeaders) {
  applyCorsHeaders(req, res);
  const accept = String(req.headers.accept || '').toLowerCase();
  if (req.method === 'POST' && accept.includes('text/html') && !accept.includes('application/json')) {
    return respondWithHtml(req, res, statusCode, payload);
  }

  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (extraHeaders) {
    Object.keys(extraHeaders).forEach(function (name) {
      res.setHeader(name, extraHeaders[name]);
    });
  }
  return res.end(JSON.stringify(payload));
}

function parseBody(req) {
  let body = req.body;
  const contentType = String(req.headers['content-type'] || '').toLowerCase();

  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') {
    if (contentType.includes('application/x-www-form-urlencoded')) {
      body = Object.fromEntries(new URLSearchParams(body));
    } else {
      try {
        body = JSON.parse(body);
      } catch (error) {
        return null;
      }
    }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  return body;
}

module.exports = async function contactHandler(req, res) {
  if (req.method === 'OPTIONS') {
    if (!sameOrigin(req)) {
      return respond(req, res, 403, { ok: false, message: 'تعذّر التحقق من مصدر الطلب.' });
    }
    res.statusCode = 204;
    res.setHeader('Cache-Control', 'no-store');
    applyCorsHeaders(req, res);
    return res.end();
  }

  if (req.method !== 'POST') {
    return respond(req, res, 405, { ok: false, message: 'طريقة الطلب غير مدعومة.' }, { Allow: 'POST, OPTIONS' });
  }

  const contentLength = Number(req.headers['content-length'] || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return respond(req, res, 413, { ok: false, message: 'حجم الرسالة أكبر من المسموح.' });
  }

  if (!sameOrigin(req)) {
    return respond(req, res, 403, { ok: false, message: 'تعذّر التحقق من مصدر الطلب.' });
  }

  const body = parseBody(req);
  if (!body) {
    return respond(req, res, 400, { ok: false, message: 'تعذّر قراءة بيانات النموذج.' });
  }

  const forwardedSize = Buffer.byteLength(JSON.stringify(body), 'utf8');
  if (forwardedSize > MAX_BODY_BYTES) {
    return respond(req, res, 413, { ok: false, message: 'حجم الرسالة أكبر من المسموح.' });
  }

  const forwardedBody = {
    name: body.name,
    email: body.email,
    message: body.message,
    website: body.website
  };
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    headers['X-Forwarded-For'] = forwardedFor.split(',')[0].trim().slice(0, 64);
  }

  const controller = new AbortController();
  const timeout = setTimeout(function () { controller.abort(); }, 9500);
  if (typeof timeout.unref === 'function') timeout.unref();

  try {
    const upstreamResponse = await fetch(CONTACT_SERVICE_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(forwardedBody),
      signal: controller.signal
    });
    let payload;
    try {
      payload = await upstreamResponse.json();
    } catch (error) {
      return respond(req, res, 502, { ok: false, message: 'خدمة البريد غير متاحة مؤقتًا. حاول لاحقًا.' });
    }

    const statusCode = [200, 400, 403, 413, 429, 502, 503].includes(upstreamResponse.status)
      ? upstreamResponse.status
      : 502;
    return respond(req, res, statusCode, payload);
  } catch (error) {
    return respond(req, res, 502, { ok: false, message: 'تعذّر الاتصال بخدمة البريد. حاول لاحقًا.' });
  } finally {
    clearTimeout(timeout);
  }
};
