// [임시] 새 학식 페이지 구조 확인용. 파서 작성 후 삭제한다.
import fs from "node:fs";
import * as cheerio from "cheerio";

const UA = { "User-Agent": "Mozilla/5.0 (campus-guide student project)" };
const out = {};
try {
  const url = "https://www.seoultech.ac.kr/life/student/welfare/menu/";
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
  const $ = cheerio.load(await res.text());
  out.status = res.status;
  const area = $(".dts_design").length ? $(".dts_design") : $("#sub, #contents").first();
  area.find("style").remove();
  out.html = $.html(area).replace(/\s+/g, " ").slice(0, 20000);
  out.scripts = $("script").map((i, e) => $(e).attr("src") || $(e).html().replace(/\s+/g, " ").slice(0, 600)).get()
    .filter((s) => /menu|food|ajax|date|week/i.test(s) && !/log_ajax|swiper|jquery/i.test(s));
} catch (err) {
  out.error = `${err.message} ${err.cause ? err.cause.code || err.cause.message : ""}`;
}
fs.writeFileSync("data/debug.json", JSON.stringify(out, null, 2));
