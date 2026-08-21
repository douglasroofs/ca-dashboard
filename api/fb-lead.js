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

// Leap's POST /prospects is application/x-www-form-urlencoded with BRACKETED
// key names - phones[0][number], address[address], job[description] - not the
// flat JSON we were sending. JSON got the required fields validated but
// silently dropped the address, and every phone label we guessed was refused.
//
// The published spec lists the only allowed labels: home, cell, phone, office,
// fax, other - all lowercase. That is why 'Mobile', 'mobile', 'Cell' and 'Home'
// were each rejected as "invalid". phones is also MANDATORY, so the old idea of
// falling back to a prospect with the number in a note was never going to work:
// Leap will not create a prospect without a phone at all.
//
// Spec: https://docs.api.jobprogress.com/api/prospect.json
function leapDigits(phone) {
  // Leap wants 8-12 DIGITS, so E.164 fails on the "+". Drop the US country
  // code: "+15550131234" -> "5550131234". Quo still gets the E.164 form.
  const d = String(phone || '').replace(/[^\d]/g, '').replace(/^1(?=\d{10}$)/, '');
  return (d.length >= 8 && d.length <= 12) ? d : '';
}

function leapPayload(L) {
  const p = { first_name: L.first_name, last_name: L.last_name };
  if (L.email) p.email = L.email;
  const d = leapDigits(L.phone);
  if (d) p['phones[0][number]'] = d;
  // address[city] and address[state] are not in the published property list,
  // but unknown form keys are ignored rather than rejected, and if Leap ever
  // starts honouring them the city lands in the right place instead of nowhere.
  if (L.address) p['address[address]'] = L.address;
  if (L.city) p['address[city]'] = L.city;
  if (L.state) p['address[state]'] = L.state;
  if (L.zip) p['address[zip]'] = L.zip;
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

// A trade id is required whenever a job is attached, and we DO want a job:
// job[description] is the only free-text field on this endpoint, so it is the
// only place the roof age, the homeowner answer and the campaign can land where
// a salesperson will actually read them. Look the id up once per warm function.
let tradeIdPromise = null;
function roofingTradeId(token) {
  if (!tradeIdPromise) {
    tradeIdPromise = fetch(LEAP_V3 + '/company/trades', {
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const rows = (j && (j.data || j)) || [];
        if (!Array.isArray(rows) || !rows.length) return null;
        const roof = rows.find((t) => /roof/i.test(String((t && (t.name || t.trade_name)) || '')));
        return ((roof || rows[0]) || {}).id || null;
      })
      .catch(() => null);
  }
  return tradeIdPromise;
}

function formBody(obj) {
  const u = new URLSearchParams();
  Object.keys(obj).forEach((k) => {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== '') u.append(k, String(v));
  });
  return u.toString();
}

// Try the richest shape first and fall back, so a lead Leap will not take in
// full still lands as a bare customer instead of vanishing. Rung 1 is the one
// the spec says should work; the rest exist because the spec has already been
// wrong once about this endpoint.
function leapVariants(payload, tradeId, note) {
  const cell = Object.assign({}, payload, { 'phones[0][label]': 'cell' });
  const out = [];
  if (tradeId && note) {
    out.push({
      shape: 'customer + job, label cell',
      body: Object.assign({}, cell, {
        'job[trades][]': tradeId,
        'job[description]': note,
        'job[same_as_customer_address]': 1,
      }),
    });
  }
  out.push({ shape: 'customer only, label cell', body: cell });
  ['phone', 'other'].forEach((lab) => {
    out.push({ shape: 'customer only, label ' + lab, body: Object.assign({}, payload, { 'phones[0][label]': lab }) });
  });
  return out;
}

async function createLeapProspect(payload, note) {
  const token = process.env.LEAP_ACCESS_TOKEN || process.env.LEAP_API_TOKEN;
  if (!token) return { ok: false, error: 'LEAP_ACCESS_TOKEN not set in Vercel' };
  const attempts = [];
  let tradeId = null;
  try {
    tradeId = await roofingTradeId(token);
    for (const variant of leapVariants(payload, tradeId, note)) {
      const r = await fetch(LEAP_V3 + '/prospects', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: formBody(variant.body),
      });
      const text = await r.text();
      let json = null;
      try { json = JSON.parse(text); } catch (e) { /* Leap sometimes returns HTML on error */ }
      if (r.ok) {
        const id = json && (json.id || (json.data && json.data.id));
        return { ok: true, id: id || null, shape: variant.shape, tradeId: tradeId, attempts };
      }
      attempts.push({ shape: variant.shape, status: r.status, detail: text.slice(0, 220) });
      // Only a 412 means "this shape is wrong, try another". Auth, server and
      // rate-limit errors fail identically for every shape, so stop rather than
      // hammer Leap four times over.
      if (r.status !== 412) break;
    }
    return { ok: false, error: 'Leap rejected every shape', tradeId: tradeId, attempts };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e), tradeId: tradeId, attempts };
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

  const leap = await createLeapProspect(payload, noteFrom(L));
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
