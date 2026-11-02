// [임시] 시간표 조회 페이지 구조 확인용. 크롤러 작성 후 삭제한다.
import fs from "node:fs";

const HOST = "https://for-s.seoultech.ac.kr";
const UA = { "User-Agent": "Mozilla/5.0 (campus-guide student project)" };
const out = {};
const err = (e) => `${e.message} ${e.cause ? e.cause.code || e.cause.message : ""}`;
let cookie = "";

async function req(path, opts = {}) {
  const res = await fetch(HOST + path, { ...opts, headers: { ...UA, Cookie: cookie, Referer: HOST + "/html/pub/schedule.jsp", ...(opts.headers || {}) }, signal: AbortSignal.timeout(60000) });
  const list = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  if (list.length) {
    out.setCookies = (out.setCookies || []).concat(list.map((c) => c.replace(/=([^;]{6})[^;]*/, "=$1…")));
    const jar = Object.fromEntries(cookie.split("; ").filter(Boolean).map((c) => c.split(/=(.*)/s).slice(0, 2)));
    for (const c of list) { const [k, v] = c.split(";")[0].split(/=(.*)/s); jar[k] = v; }
    cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
  }
  return { status: res.status, type: res.headers.get("content-type"), body: await res.text() };
}

async function grid(params) {
  const body = { fsp_action: "GridAction", fsp_cmd: "getScheduleGridData", SP_YMST: "20262", LESS_CD: "", DN_DIV: "00500001", SUBJ_NM: "", LECT_DIV: "", DOTW_CD: "", ...params };
  const r = await req("/JSONMain", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", Accept: "application/json, text/javascript, */*; q=0.01" }, body: JSON.stringify(body) });
  try {
    const j = JSON.parse(r.body);
    const rows = j.rows || [];
    return { status: r.status, keys: Object.keys(j), err: [j.ErrorCode, j.ErrorMsg], records: j.records, rowCount: rows.length, sample: rows.slice(0, 3) };
  } catch {
    return { status: r.status, type: r.type, text: r.body.slice(0, 1500) };
  }
}

try {
  await req("/html/pub/schedule.jsp");
  out.cookie = cookie ? "있음" : "없음";
  // 브라우저처럼 페이지가 불러오는 스크립트도 차례로 요청 (세션 초기화가 스크립트에서 일어날 수 있음)
  for (const p of ["/js/fsp/sz_fsp_json.js.jsp", "/js/stech/lang.js.jsp"]) await req(p);
  const nf = (await req("/js/stech/netfunnel.js")).body;
  out.netfunnelHead = nf.slice(0, 800);
  out.byName = await grid({ SUBJ_NM: "웹프로그래밍" });
  out.all = await grid({});
} catch (e) { out.error = err(e); }

fs.writeFileSync("data/debug.json", JSON.stringify(out, null, 2));
