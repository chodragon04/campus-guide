// [임시] 새 학식 페이지 구조 확인용. 파서 작성 후 삭제한다.
import fs from "node:fs";
import * as cheerio from "cheerio";

const UA = { "User-Agent": "Mozilla/5.0 (campus-guide student project)" };
const out = {};
async function get(url) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
  return { status: res.status, $: cheerio.load(await res.text()) };
}
try {
  // 1) 작년 데이터가 있으면 표 구조를 볼 수 있다
  for (const [p, m, w] of [[2, 11, 1], [2, 10, 3], [1, 11, 1]]) {
    const { $ } = await get(`https://www.seoultech.ac.kr/life/student/food?place=${p}&year=2025&month=${m}&week=${w}`);
    const area = $(".dts_design");
    area.find("style, form").remove();
    out[`2025-${p}-${m}-${w}`] = $.html(area).replace(/\s+/g, " ").slice(0, 8000);
  }
  // 2) 페이지 안의 식단/식당 관련 링크
  const { $ } = await get("https://www.seoultech.ac.kr/life/student/food");
  out.links = $("a").map((i, a) => `${$(a).text().replace(/\s+/g, " ").trim()} | ${$(a).attr("href")}`).get()
    .filter((s) => /식단|식당|학식|food|menu|cafe|dining/i.test(s));
} catch (err) {
  out.error = `${err.message} ${err.cause ? err.cause.code || err.cause.message : ""}`;
}
fs.writeFileSync("data/debug.json", JSON.stringify(out, null, 2));
