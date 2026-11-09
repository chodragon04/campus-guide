// [임시] 캠퍼스맵 페이지 구조 확인용. 건물 데이터 작성 후 삭제한다.
import fs from "node:fs";
import * as cheerio from "cheerio";

const out = {};
try {
  const res = await fetch("https://www.seoultech.ac.kr/intro/map", { headers: { "User-Agent": "Mozilla/5.0 (campus-guide student project)" }, signal: AbortSignal.timeout(20000) });
  const html = await res.text();
  const $ = cheerio.load(html);
  out.status = res.status;
  out.areas = $("area").map((i, a) => `${$(a).attr("alt") || ""} | ${$(a).attr("href") || ""} | ${$(a).attr("onclick") || ""} | ${$(a).attr("coords") || ""}`).get();
  out.links = $("a").map((i, a) => `${$(a).text().replace(/\s+/g, " ").trim()} | ${$(a).attr("href") || ""} | ${$(a).attr("onclick") || ""}`).get()
    .filter((s) => /map|pdf|down|건물|관|bldg|build/i.test(s)).slice(0, 120);
  const area = $(".dts_design").length ? $(".dts_design") : $("#sub, #contents").first();
  area.find("style").remove();
  out.html = $.html(area).replace(/\s+/g, " ").slice(0, 30000);
  out.scripts = $("script").map((i, e) => $(e).attr("src") || $(e).html().replace(/\s+/g, " ").slice(0, 2000)).get()
    .filter((s) => /map|build|bldg|lat|lng|marker/i.test(s));
} catch (err) {
  out.error = `${err.message} ${err.cause ? err.cause.code || err.cause.message : ""}`;
}
fs.writeFileSync("data/debug.json", JSON.stringify(out, null, 2));
