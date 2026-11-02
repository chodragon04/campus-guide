// [임시] 새 학식 페이지 구조 확인용. 파서 작성 후 삭제한다.
import fs from "node:fs";
import * as cheerio from "cheerio";

const PAGES = [
  "https://www.seoultech.ac.kr/life/student/food?place=2&year=2026&month=11&week=1",
  "https://www.seoultech.ac.kr/life/student/food?place=1&year=2026&month=11&week=1",
  "https://housing.seoultech.ac.kr/livng/dining/?foodtype=kb",
];

async function dump(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (campus-guide student project)" }, signal: AbortSignal.timeout(15000) });
    const html = await res.text();
    const $ = cheerio.load(html);
    const content = $("#contents, .contents, #sub, .sub_content").first();
    const tables = $("table").map((i, t) => $.html(t).replace(/\s+/g, " ").slice(0, 3000)).get();
    const selects = $("select").map((i, s) => $.html(s).replace(/\s+/g, " ").slice(0, 800)).get();
    const text = (content.length ? content.text() : $("body").text()).replace(/\s+/g, " ").slice(0, 3000);
    return { url, status: res.status, selects, tables, text };
  } catch (err) {
    return { url, error: `${err.message} ${err.cause ? err.cause.code || err.cause.message : ""}` };
  }
}

const out = [];
for (const url of PAGES) out.push(await dump(url));
fs.writeFileSync("data/debug.json", JSON.stringify(out, null, 2));
