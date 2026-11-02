// [임시] 시간표 조회 페이지 구조 확인용. 크롤러 작성 후 삭제한다.
import fs from "node:fs";

const HOST = "https://for-s.seoultech.ac.kr";
const UA = { "User-Agent": "Mozilla/5.0 (campus-guide student project)" };
const out = {};
const err = (e) => `${e.message} ${e.cause ? e.cause.code || e.cause.message : ""}`;

async function text(path, opts = {}) {
  const res = await fetch(HOST + path, { ...opts, headers: { ...UA, ...(opts.headers || {}) }, signal: AbortSignal.timeout(30000) });
  return { status: res.status, type: res.headers.get("content-type"), body: await res.text(), cookie: res.headers.get("set-cookie") };
}

try {
  for (const p of ["/js/fsp/sz_fsp_json.js.jsp", "/js/stech/const.js", "/js/stech/grid.js"]) {
    const r = await text(p);
    const lines = r.body.split("\n").filter((l) => /serverUrl|CONTEXT_PATH|reloadGrid|url\s*:|\.jsp|\.do|gridheader|scheduleList/.test(l)).slice(0, 40);
    out[p] = { status: r.status, lines };
  }
} catch (e) { out.jsError = err(e); }

try {
  const r = await text("/json/combo/20262/less/less.json");
  out.less = { status: r.status, type: r.type, sample: r.body.slice(0, 3000) };
} catch (e) { out.lessError = err(e); }

fs.writeFileSync("data/debug.json", JSON.stringify(out, null, 2));
