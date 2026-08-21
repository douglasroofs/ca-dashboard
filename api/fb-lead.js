// api/fb-lead.js - inbound Facebook lead -> Leap prospect + Quo text.
//
// WHY THIS EXISTS (2026-08-20):
// Facebook lead-form leads used to reach the CRM through Zaps built by the old
// marketing company (Lutom). Those Zaps were deleted, and nothing replaced
// them. 68 paid leads piled up in Meta's Leads Center between 2026-05-24 and
// 2026-08-18 with zero follow-up - nobody was told they existed.
//
// Zapier now catches the Meta lead and POSTs it here. Everything that matters
// happens in this file, in this repo, so if Zapier is ever swapped out the
// logic survives. Zapier is transport, not brains.
//
//   Zapier (Meta Lead Ads trigger)
//        -> POST /api/fb-lead
//             -> Leap  : create prospect
//             -> Quo   : text the on-call numbers
//
// DESIGN RULE, learned the hard way from the /g form: a lead must never be
// lost silently. If Leap fails we STILL send the text, and the text says Leap
// failed. A human finding out beats a clean-looking 200 that dropped someone.
//
// Query params:
//   ?dry=1    build both payloads and return them, write nothing
//
// Env:
//   FB_LEAD_SECRET     shared secret Zapier must send (header or ?key=)
//   LEAP_ACCESS_TOKEN  Leap v3 developer token (Bearer)
//   QUO_API_KEY        Quo API key (sent raw, NOT as Bearer)
//   QUO_FROM           Quo workspace number in E.164, e.g. +15715551234
//   LEAD_NOTIFY_PHONES comma-separated E.164 numbers to text

const LEAP_V3 = 'https://api.jobprogress.com/api/v3';
const QUO_API = 'https://api.quo.com/v1/messages';

const s = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();

// Zapier field names vary by how the Zap is mapped, so accept several spellings
// rather than forcing whoever builds the Zap to match one exactly.
function pick(body, names) {
  for (const n of names) {
    for (const k of Object.keys(body || {})) {
      if (k.toLowerCase().replace(/[^a-z]/g, '') === n) {
        const v = s(body[k]);
        if (v) return v;
      }
    }
  }
  return '';
}

// Meta hands back "+1 (240) 487-8016", "2404878016", "+12404878016" - all the
// same person. Normalise to E.164 so Quo accepts it and Leap stays consistent.
function e164(raw) {
  const d = String(raw || '').replace(/[^\d]/g, '');
  if (!d) return '';
  if (d.length === 10) return '+1' + d;
  if (d.length === 11 && d[0] === '1') return '+' + d;
  return '+' + d;
}

function splitName(full, first, last) {
  if (first || last) return { first: first || '(no first name)', last: last || '(no last name)' };
  const parts = s(full).split(' ').filter(Boolean);
  if (!parts.length) return { first: 'Facebook', last: 'Lead' };
  if (parts.length === 1) return { first: parts[0], last: '(no last name)' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

function normalise(body) {
  const first = pick(body, ['firstname', 'fname']);
  const last = pick(body, ['lastname', 'lname']);
  const full = pick(body, ['fullname', 'name']);
  const nm = splitName(full, first, last);
  return {
    first_name: nm.first,
    last_name: nm.last,
    email: pick(body, ['email', 'emailaddress']),
    phone: e164(pick(body, ['phonenumber', 'phone', 'mobile', 'mobilenumber'])),
    address: pick(body, ['streetaddress', 'address', 'address1', 'street']),
    city: pick(body, ['city', 'town']),
    state: pick(body, ['state', 'province', 'region']),
    zip: pick(body, ['zipcode', 'zip', 'postalcode', 'postcode']),
    homeowner: pick(body, ['areyouthehomeowner', 'homeowner']),
    wants: pick(body, ['wouldyoulikearoofinspections', 'wouldyoulikearoofinspection', 'roofinspection']),
    roof_age: pick(body, ['howoldisyourroof', 'roofage']),
    form: pick(body, ['formname', 'form', 'leadformid', 'formid']),
    campaign: pick(body, ['campaignname', 'campaign', 'adname', 'ad']),
    created: pick(body, ['createdtime', 'created', 'submittedon', 'time']),
  };
}

function noteFrom(L) {
  const bits = [
    'Source: Facebook lead form (auto-imported).',
    L.homeowner ? 'Homeowner: ' + L.homeowner : '',
    L.wants ? 'Wants roof inspection: ' + L.wants : '',
    L.roof_age ? 'Roof age: ' + L.roof_age : '',
    L.campaign ? 'Campaign: ' + L.campaign : '',
    L.form ? 'Form: ' + L.form : '',
    L.created ? 'Submitted: ' + L.created : '',
  ].filter(Boolean);
  return bits.join('\n');
}

function leapPayload(L) {
  // Confirmed working shape: POST /api/v3/prospects with a Bearer token and
  // first_name / last_name / email. The address and phone fields below are the
  // conventional Leap names; if Leap ignores any of them the prospect is still
  // created and the note carries everything, so nothing is lost.
  const p = {
    first_name: L.first_name,
    last_name: L.last_name,
    email: L.email,
    note: noteFrom(L),
    lead_source: 'Facebook Lead Ad',
  };
    if (L.phone) {
    // Leap validates phones.N.number as 8-12 DIGITS, so E.164 fails on the "+".
    // Strip to digits and drop the US country code: "+15550131234" -> "5550131234".
    // Quo still receives the E.164 form; this shape is only for Leap.
    const d = String(L.phone).replace(/[^\d]/g, '').replace(/^1(?=\d{10}$)/, '');
    if (d.length >= 8 && d.length <= 12) {
      p.phone = d;
      // Leap's label whitelist is capitalised - lowercase "mobile" is rejected.
      p.phones = [{ number: d, label: 'Mobile' }];
    }
  }
  if (L.address || L.city || L.zip) {
    p.address = L.address;
    p.city = L.city;
    p.state = L.state;
    p.zip = L.zip;
    p.addresses = [{ address: L.address, city: L.city, state: L.state, zip: L.zip }];
  }
  return p;
}

function smsFrom(L, leapOk, leapErr) {
  const lines = ['NEW FACEBOOK LEAD'];
  lines.push(L.first_name + ' ' + L.last_name);
  if (L.phone) lines.push(L.phone);
  const where = [L.address, L.city, L.zip].filter(Boolean).join(', ');
  if (where) lines.push(where);
  if (L.roof_age) lines.push('Roof age: ' + L.roof_age);
  if (L.homeowner) lines.push('Homeowner: ' + L.homeowner);
  lines.push(leapOk ? 'Added to Leap.' : 'NOT IN LEAP - add manually. (' + (leapErr || 'unknown error') + ')');
  return lines.join('\n');
}

// Leap rejects phone shapes we cannot predict: it refused E.164 ("must be
// between 8 and 12 digits"), then refused label 'mobile', then refused label
// 'Mobile'. Rather than keep guessing one shape at a time and burning a deploy
// per guess, try a LADDER of shapes and stop at the first Leap accepts.
//
// The last rung has no phone at all and carries the number in the note. That
// rung cannot fail on phone validation, so a real customer is never lost to a
// formatting quibble - which is the only outcome that actually matters here.
//
// Every attempt is reported back, so when something fails we can see WHY
// instead of only seeing the first error (the previous version hid the retry's
// own failure behind the original error, which is why it looked like the retry
// never ran).
function phoneVariants(payload) {
  const num = payload.phone || (payload.phones && payload.phones[0] && payload.phones[0].number) || '';
  const base = Object.assign({}, payload);
  delete base.phones; delete base.phone;
  if (!num) return [{ label: 'no phone on lead', body: base }];
  const withNote = Object.assign({}, base);
  withNote.note = (base.note ? base.note + '\n' : '') + 'Phone (Leap rejected the phone field): ' + num;
  return [
    { label: 'phones[] with no label', body: Object.assign({}, base, { phone: num, phones: [{ number: num }] }) },
    { label: "phones[] label 'Cell'", body: Object.assign({}, base, { phone: num, phones: [{ number: num, label: 'Cell' }] }) },
    { label: "phones[] label 'Home'", body: Object.assign({}, base, { phone: num, phones: [{ number: num, label: 'Home' }] }) },
    { label: 'flat phone only', body: Object.assign({}, base, { phone: num }) },
    { label: 'no phone, number in note', body: withNote },
  ];
}

async function createLeapProspect(payload) {
  const token = process.env.LEAP_ACCESS_TOKEN || process.env.LEAP_API_TOKEN;
  if (!token) return { ok: false, error: 'LEAP_ACCESS_TOKEN not set in Vercel' };
  const attempts = [];
  try {
    for (const variant of phoneVariants(payload)) {
      const r = await fetch(LEAP_V3 + '/prospects', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(variant.body),
      });
      const text = await r.text();
      let json = null;
      try { json = JSON.parse(text); } catch (e) { /* Leap sometimes returns HTML on error */ }
      if (r.ok) {
        const id = json && (json.id || (json.data && json.data.id));
        return {
          ok: true,
          id: id || null,
          shape: variant.label,
          degraded: variant.label.indexOf('note') > -1 ? 'phone is in the note, not the phone field' : undefined,
          attempts,
        };
      }
      attempts.push({ shape: variant.label, status: r.status, detail: text.slice(0, 220) });
      // Only a 412 means "this shape is wrong, try another". Anything else -
      // auth, server error, rate limit - will fail identically for every shape,
      // so stop rather than hammer Leap six times.
      if (r.status !== 412) break;
    }
    return { ok: false, error: 'Leap rejected every shape', attempts };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e), attempts };
  }
}

async function sendQuo(content) {
  const key = process.env.QUO_API_KEY;
  const from = process.env.QUO_FROM;
  const to = String(process.env.LEAD_NOTIFY_PHONES || '')
    .split(',').map((x) => e164(x)).filter(Boolean).slice(0, 10);
  if (!key) return { ok: false, error: 'QUO_API_KEY not set in Vercel' };
  if (!from) return { ok: false, error: 'QUO_FROM not set in Vercel' };
  if (!to.length) return { ok: false, error: 'LEAD_NOTIFY_PHONES not set in Vercel' };
  const results = [];
  // One request per recipient. A group message would let all of them reply into
  // a single thread, which is not what we want for a lead alert.
  for (const num of to) {
    try {
      const r = await fetch(QUO_API, {
        method: 'POST',
        // Quo does NOT use a Bearer prefix - the raw key goes in Authorization.
        headers: { Authorization: key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, from, to: [num] }),
      });
      const t = await r.text();
      results.push({ to: num, ok: r.ok, status: r.status, detail: r.ok ? undefined : t.slice(0, 200) });
    } catch (e) {
      results.push({ to: num, ok: false, error: String((e && e.message) || e) });
    }
  }
  return { ok: results.some((x) => x.ok), results };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const url = new URL(req.url, 'http://localhost');
  const dry = url.searchParams.get('dry') === '1';

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'POST only' });
    return;
  }

  // Shared secret. This endpoint creates records and sends texts, so it must
  // not be callable by anyone who finds the URL.
  const want = process.env.FB_LEAD_SECRET;
  const got = req.headers['x-webhook-secret'] || url.searchParams.get('key');
  if (!want) { res.status(500).json({ ok: false, error: 'FB_LEAD_SECRET not set in Vercel' }); return; }
  if (got !== want) { res.status(401).json({ ok: false, error: 'bad or missing secret' }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  if (!body || typeof body !== 'object') body = {};

  const L = normalise(body);
  const payload = leapPayload(L);

  if (dry) {
    res.status(200).json({
      ok: true, dry: true, parsed: L, leapPayload: payload,
      smsPreview: smsFrom(L, true, ''),
      notifying: String(process.env.LEAD_NOTIFY_PHONES || '(unset)'),
      receivedKeys: Object.keys(body),
    });
    return;
  }

  const leap = await createLeapProspect(payload);
  // The text goes out either way - see the design rule at the top of this file.
  const sms = await sendQuo(smsFrom(L, leap.ok, leap.error));

  res.status(200).json({
    ok: true,
    lead: L.first_name + ' ' + L.last_name,
    leap,
    sms,
    at: new Date().toISOString(),
  });
};

module.exports.config = { maxDuration: 30 };
