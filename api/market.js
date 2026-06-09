export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const k = process.env.ALPACA_API_KEY, s = process.env.ALPACA_API_SECRET;
  if (!k || !s) return res.status(500).json({ ok: false, error: 'Alpaca keys not set' });
  const syms = (req.query.symbols || 'SPY,NVDA,QQQ,VIXY').split(',');
  const headers = { 'APCA-API-KEY-ID': k, 'APCA-API-SECRET-KEY': s, 'Accept': 'application/json' };
  try {
    let r = await fetch(`https://data.alpaca.markets/v2/stocks/snapshots?symbols=${syms.join(',')}&feed=iex`, { headers });
    if (!r.ok) r = await fetch(`https://data.alpaca.markets/v2/stocks/snapshots?symbols=${syms.join(',')}&feed=sip`, { headers });
    if (!r.ok) return res.status(500).json({ ok: false, error: `Alpaca ${r.status}` });
    const snaps = await r.json();
    const out = {};
    for (const sym of syms) {
      const sn = snaps[sym]; if (!sn) continue;
      const price = sn.latestTrade?.p || sn.latestQuote?.ap || sn.dailyBar?.c || 0;
      const prev = sn.prevDailyBar?.c || price;
      const chg = price - prev, pct = prev > 0 ? (chg / prev) * 100 : 0;
      out[sym === 'VIXY' ? 'VIX' : sym] = {
        price: price.toFixed(2),
        change: chg >= 0 ? `+${chg.toFixed(2)}` : chg.toFixed(2),
        changePct: pct >= 0 ? `+${pct.toFixed(2)}%` : `${pct.toFixed(2)}%`,
        direction: chg >= 0 ? 'up' : 'down'
      };
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, data: out });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
