// middleware.js - shared-password gate for the dashboard PAGES.
// The password lives in the DASH_PASSWORD env var (set in Vercel); this file never contains it.
// /api/* is intentionally NOT gated so the nightly snapshot refresh keeps working.
// If DASH_PASSWORD is unset, the gate is inactive (fail-open) so nothing locks during setup.

export const config = {
  // Pin the Edge runtime: this file uses Request/Response/atob, which are Web APIs.
  // Without this it can run in the Node runtime, where req.headers.get is not a
  // function -- the request then dies before any response is produced (503).
  runtime: 'edge',
  // gate everything except /api, Next internals, and static assets
  matcher: ['/((?!api/|_next/|favicon\\.ico|logo\\.png).*)'],
};

// Vercel middleware must ALWAYS return a Response. A bare "return" leaves the
// request unanswered, which the platform eventually surfaces as a 503. This is
// the documented way to say "continue to the origin".
const CONTINUE = () => new Response(null, { headers: { 'x-middleware-next': '1' } });

export default function middleware(req) {
  const expected = process.env.DASH_PASSWORD || '';
  if (!expected) return CONTINUE(); // not configured yet -> stay open

  // Works whether req.headers is a Web Headers object or a plain Node object.
  const h = req.headers;
  const header =
    (h && typeof h.get === 'function' ? h.get('authorization') : h && h.authorization) || '';

  if (header.startsWith('Basic ')) {
    try {
      const decoded = atob(header.slice(6));
      const pass = decoded.slice(decoded.indexOf(':') + 1);
      if (pass === expected) return CONTINUE(); // authorized
    } catch (e) { /* fall through to 401 */ }
  }
  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Douglas Roofing Dashboard"',
      'Content-Type': 'text/plain',
    },
  });
}
