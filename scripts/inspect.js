// [임시] 새 학식 페이지 구조 확인용. 파서 작성 후 삭제한다.
import fs from "node:fs";
import * as cheerio from "cheerio";

const UA = { "User-Agent": "Mozilla/5.0 (campus-guide student project)" };
const BASE = "https://www.seoultech.ac.kr/life/student/food";

async function load(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { ...UA, ...(opts.headers || {}) }, signal: AbortSignal.timeout(15000) });
  return { status: res.status, html: await res.text() };
}

function around(html) {
  const $ = cheerio.load(html);
  const form = $("select[name=place]").closest("form");
  const area = form.parent().parent();
  return {
    form: $.html(form).replace(/\s+/g, " ").slice(0, 1500),
    after: $.html(area).replace(/\s+/g, " ").replace(/<select[\s\S]*?<\/select>/g, "[select]").slice(0, 9000),
    siblings: form.parent().nextAll().map((i, e) => $.html(e).replace(/\s+/g, " ").slice(0, 3000)).get().slice(0, 6),
    imgs: $("#sub img, .sub img, img").map((i, e) => $(e).attr("src")).get().filter((s) => !/res\/img|logo|btn|icon/.test(s)).slice(0, 20),
    scripts: $("script").map((i, e) => $(e).attr("src") || $(e).html().replace(/\s+/g, " ").slice(0, 400)).get().filter((s) => /food|place|week|ajax|submit/i.test(s)),
  };
}

const out = [];
try {
  const a = await load(`${BASE}?place=2&year=2026&month=11&week=1`);
  out.push({ kind: "GET", status: a.status, ...around(a.html) });
  const b = await load(BASE, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "place=2&year=2026&month=11&week=1" });
  out.push({ kind: "POST", status: b.status, ...around(b.html) });
} catch (err) {
  out.push({ error: `${err.message} ${err.cause ? err.cause.code || err.cause.message : ""}` });
}
fs.writeFileSync("data/debug.json", JSON.stringify(out, null, 2));
