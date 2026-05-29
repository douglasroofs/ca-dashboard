// Vercel serverless function - CA COUNT data from Google Sheets
// Proper CSV parser handles quoted fields with commas (fixes rep column).

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1ex7edGkVAC_mHKbO4V4a3UBCyNBOxW3ApQF1-bCmS-M/export?format=csv&gid=1499400196';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const response = await fetch(SHEET_URL + '&cb=' + Date.now());
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const rows = parseCSV(await response.text());
    return res.status(200).json({ success: true, rows, count: rows.length, timestamp: new Date().toISOString() });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

function parseCSVLine(line) {
  var res=[], cur='', inQ=false;
  for (var i=0; i<line.length; i++) {
    var ch=line[i];
    if (ch==='"') { if (inQ&&line[i+1]==='"'){cur+='"';i++;} else {inQ=!inQ;} }
    else if (ch===','&&!inQ) { res.push(cur.trim()); cur=''; }
    else { cur+=ch; }
  }
  res.push(cur.trim());
  return res;
}

function parseCSV(csv) {
  var NL=String.fromCharCode(10), CR=String.fromCharCode(13);
  return csv.trim().split(NL).slice(2).map(function(line) {
    var c=parseCSVLine(line);
    return { docName:c[0]||'', jobId:c[1]||'', customer:c[2]||'', address:c[3]||'', rep:c[4]||'', status:(c[5]||'').split(CR).join('') };
  }).filter(function(r){ return r.jobId; });
}