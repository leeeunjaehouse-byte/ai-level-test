// 어드민 집계 조회 (키 필요). 데이터는 익명 — PII 없음.
const ADMIN_KEY = "ej-admin-2026"; // 변경 원하면 이 값을 바꾸고 재배포

const QIDS = {
  serious: ["위임1","위임2","서술1","서술2","분별1","분별2","책임1","책임2"],
  fun:     ["fun1","fun2","fun3","fun4","fun5","fun6","fun7","fun8","fun9","fun10"],
};

function toHash(arr) {
  const o = {};
  if (Array.isArray(arr)) for (let i = 0; i < arr.length; i += 2) o[arr[i]] = +arr[i + 1] || 0;
  else if (arr && typeof arr === "object") for (const k in arr) o[k] = +arr[k] || 0;
  return o;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const key = (req.query && req.query.key) || "";
    if (key !== ADMIN_KEY) { res.status(401).json({ error: "unauthorized" }); return; }

    const url = process.env.KV_REST_API_URL, tok = process.env.KV_REST_API_TOKEN;
    if (!url || !tok) { res.status(200).json({ configured: false }); return; }

    const P = "ailvl:";
    const cmds = [
      ["GET", P + "total"], ["GET", P + "total:serious"], ["GET", P + "total:fun"],
      ["HGETALL", P + "dist:sector:serious"], ["HGETALL", P + "dist:level:serious"], ["HGETALL", P + "dist:mode:serious"],
      ["HGETALL", P + "dist:sector:fun"], ["HGETALL", P + "dist:level:fun"],
      ["LRANGE", P + "recent", "0", "49"],
    ];
    QIDS.serious.forEach(q => cmds.push(["HGETALL", `${P}q:serious:${q}`]));
    QIDS.fun.forEach(q => cmds.push(["HGETALL", `${P}q:fun:${q}`]));

    const r = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmds),
    });
    const data = await r.json();
    const g = i => (data[i] && (data[i].result !== undefined ? data[i].result : data[i]));

    const out = {
      configured: true,
      total: +g(0) || 0, total_serious: +g(1) || 0, total_fun: +g(2) || 0,
      sector_s: toHash(g(3)), level_s: toHash(g(4)), mode_s: toHash(g(5)),
      sector_f: toHash(g(6)), level_f: toHash(g(7)),
      recent: (g(8) || []).map(s => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean),
      q_serious: {}, q_fun: {},
    };
    let idx = 9;
    QIDS.serious.forEach(q => { out.q_serious[q] = toHash(g(idx++)); });
    QIDS.fun.forEach(q => { out.q_fun[q] = toHash(g(idx++)); });

    res.status(200).json(out);
  } catch (e) {
    res.status(200).json({ error: String(e) });
  }
};
