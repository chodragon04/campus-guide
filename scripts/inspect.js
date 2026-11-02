// [임시] 새 학식 페이지 구조 확인용. 파서 작성 후 삭제한다.
import fs from "node:fs";
import * as cheerio from "cheerio";

const BASE = "https://www.seoultech.ac.kr/life/student/food";
const out = { summary: [], samples: {} };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const place of [1, 2, 3, 4]) {
  for (const [month, week] of [[11, 1], [11, 2], [10, 4], [10, 5], [10, 3], [9, 3]]) {
    const url = `${BASE}?place=${place}&year=2026&month=${month}&week=${week}`;
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (campus-guide student project)" }, signal: AbortSignal.timeout(15000) });
      const $ = cheerio.load(await res.text());
      const area = $(".dts_design");
      const empty = area.find(".info_msg").text().trim();
      out.summary.push(`${place} ${month}월 ${week}주: ${empty || "표 있음 (" + area.find("table").length + ")"}`);
      if (!empty && !out.samples[place]) {
        area.find("style, form, select").remove();
        out.samples[place] = { url, html: $.html(area).replace(/\s+/g, " ").slice(0, 12000) };
      }
    } catch (err) {
      out.summary.push(`${place} ${month}월 ${week}주: 오류 ${err.message}`);
    }
    await sleep(500);
    if (out.samples[place]) break;
  }
}
fs.writeFileSync("data/debug.json", JSON.stringify(out, null, 2));
