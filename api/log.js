// 익명 선택 로그 기록 (Vercel KV / Upstash Redis REST)
// 클라이언트가 결과 화면에서 POST. 실패해도 사용자 경험엔 영향 없음.
const QIDS = {
  serious: ["위임1","위임2","서술1","서술2","분별1","분별2","책임1","책임2"],
  fun:     ["fun1","fun2","fun3","fun4","fun5","fun6","fun7","fun8","fun9","fun10"],
};

module.exports = async (req, res) => {
  // CORS (동일 도메인이지만 안전하게)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "method" }); return; }

  try {
    let b = req.body;
    if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } }
    b = b || {};
    const v = b.version === "fun" ? "fun" : "serious";
    const P = "ailvl:"; // 공유 KV 충돌 방지용 접두어

    const cmds = [["INCR", P + "total"], ["INCR", `${P}total:${v}`]];
    if (b.sector) cmds.push(["HINCRBY", `${P}dist:sector:${v}`, String(b.sector), 1]);
    if (b.level)  cmds.push(["HINCRBY", `${P}dist:level:${v}`,  String(b.level),  1]);
    if (b.mode)   cmds.push(["HINCRBY", `${P}dist:mode:${v}`,   String(b.mode),   1]);

    const ids = QIDS[v] || [];
    if (Array.isArray(b.picks)) {
      b.picks.forEach((p, i) => {
        if (ids[i] != null && p != null && p >= 0) {
          cmds.push(["HINCRBY", `${P}q:${v}:${ids[i]}`, String(p), 1]);
        }
      });
    }
    cmds.push(["LPUSH", `${P}recent`, JSON.stringify({
      t: Date.now(), v, sector: b.sector, level: b.level, mode: b.mode, overall: b.overall
    })]);
    cmds.push(["LTRIM", `${P}recent`, "0", "299"]);

    const url = process.env.KV_REST_API_URL, tok = process.env.KV_REST_API_TOKEN;
    if (!url || !tok) { res.status(200).json({ ok: false, note: "kv-not-configured" }); return; }

    await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmds),
    });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e) });
  }
};
