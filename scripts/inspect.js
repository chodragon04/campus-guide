// [임시] 시간표 조회 페이지 구조 확인용. 크롤러 작성 후 삭제한다.
import fs from "node:fs";
import * as cheerio from "cheerio";

const URL_ = "https://for-s.seoultech.ac.kr/html/pub/schedule.jsp";
const out = {};
try {
  const res = await fetch(URL_, { headers: { "User-Agent": "Mozilla/5.0 (campus-guide student project)" }, signal: AbortSignal.timeout(20000) });
  const html = await res.text();
  out.status = res.status;
  out.headers = Object.fromEntries(res.headers);
  const $ = cheerio.load(html);
  out.forms = $("form").map((i, f) => ({
    name: $(f).attr("name"), id: $(f).attr("id"), action: $(f).attr("action"), method: $(f).attr("method"),
    inputs: $(f).find("input, select, textarea").map((j, e) => ({
      tag: e.tagName, name: $(e).attr("name"), id: $(e).attr("id"), type: $(e).attr("type"), value: $(e).attr("value"),
      onchange: $(e).attr("onchange"), onclick: $(e).attr("onclick"),
      options: $(e).find("option").map((k, o) => `${$(o).attr("value")}=${$(o).text().trim()}`).get().slice(0, 15),
      optionCount: $(e).find("option").length,
    })).get(),
  })).get();
  out.buttons = $("button, input[type=button], a[onclick], a[href^='javascript']").map((i, e) => `${$(e).text().trim()} | ${$(e).attr("onclick") || $(e).attr("href")}`).get();
  out.scripts = $("script").map((i, e) => $(e).attr("src") || $(e).html()).get();
  out.iframes = $("iframe, frame").map((i, e) => $(e).attr("src")).get();
  out.length = html.length;
  out.raw = html.slice(0, 15000);
} catch (err) {
  out.error = `${err.message} ${err.cause ? err.cause.code || err.cause.message : ""}`;
}
fs.writeFileSync("data/debug.json", JSON.stringify(out, null, 2));
