// [임시] 시간표 조회 페이지 구조 확인용. 크롤러 작성 후 삭제한다.
import fs from "node:fs";

const HOST = "https://for-s.seoultech.ac.kr";
const UA = { "User-Agent": "Mozilla/5.0 (campus-guide student project)" };
const out = {};
const err = (e) => `${e.message} ${e.cause ? e.cause.code || e.cause.message : ""}`;
let cookie = "";

async function req(path, opts = {}) {
  const res = await fetch(HOST + path, { ...opts, headers: { ...UA, Cookie: cookie, Referer: HOST + "/html/pub/schedule.jsp", ...(opts.headers || {}) }, signal: AbortSignal.timeout(60000) });
  const sc = res.headers.get("set-cookie");
  if (sc && !cookie) cookie = sc.split(";")[0];
  return { status: res.status, type: res.headers.get("content-type"), body: await res.text() };
}

async function grid(params) {
  const body = { fsp_action: "GridAction", fsp_cmd: "getScheduleGridData", SP_YMST: "20262", LESS_CD: "", DN_DIV: "00500001", SUBJ_NM: "", LECT_DIV: "", DOTW_CD: "", ...params };
  const r = await req("/JSONMain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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
  const g = (await req("/js/stech/grid.js")).body;
  out.reloadGrid = g.slice(g.indexOf("reloadGrid = function"), g.indexOf("reloadGrid = function") + 1500);
  out.gridDefaults = g.slice(0, 2500);
  const f = (await req("/js/fsp/sz_fsp_json.js.jsp")).body;
  const i = f.indexOf("callService");
  out.callService = f.slice(i, i + 3000);
  out.fspHead = f.slice(0, 2500);
  out.byName = await grid({ SUBJ_NM: "웹프로그래밍" });
  out.all = await grid({});
} catch (e) { out.error = err(e); }

fs.writeFileSync("data/debug.json", JSON.stringify(out, null, 2));
