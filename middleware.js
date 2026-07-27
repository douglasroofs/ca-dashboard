// middleware.js - shared-password gate for the dashboard PAGES.
// The password lives in the DASH_PASSWORD env var (set in Vercel); this file never contains it.
// /api/* is intentionally NOT gated so the nightly snapshot refresh keeps working.
// If DASH_PASSWORD is unset, the gate is inactive (fail-open) so nothing locks during setup.

export const config = {
  // gate everything except /api, Next internals, and static assets
  matcher: ['/((?!api/|_next/|favicon\\.ico|logo\\.png).*)'],
};

export default function middleware(req) {
  const expected = process.env.DASH_PASSWORD || '';
  if (!expected) return; // not configured yet -> stay open

  const header = req.headers.get('authorization') || '';
  if (header.startsWith('Basic ')) {
    try {
      const decoded = atob(header.slice(6));
      const pass = decoded.slice(decoded.indexOf(':') + 1);
      if (pass === expected) return; // authorized
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
