// [임시] 캠퍼스맵 페이지 구조 확인용. 건물 데이터 작성 후 삭제한다.
import fs from "node:fs";
import * as cheerio from "cheerio";

const HOST = "https://www.seoultech.ac.kr";
const UA = "Mozilla/5.0 (campus-guide student project)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { categories: {}, info: {} };

async function list(category) {
  const res = await fetch(HOST + "/site/www/intro/map/map_ajax.jsp", {
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body: new URLSearchParams({ building: category }),
    signal: AbortSignal.timeout(20000),
  });
  const $ = cheerio.load(await res.text());
  const d2 = $(".list .d2");
  d2.find("script, style").remove();
  return d2.html().replace(/\s+/g, " ");
}

try {
  for (const c of ["대학", "대학원", "복지시설", "행정지원"]) {
    out.categories[c] = await list(c);
    await sleep(500);
  }
  const ids = ["001","002","003","004","005","006","007","008","010","011","013","014","030","031","032","033","034","035","037","038","039","040","041","042","043","044","045","046","047","051","052","053","054","055","056","571","057","058","059","060","075","062","063"];
  for (const id of ids) {
    const res = await fetch(`${HOST}/site/www/intro/map/building_info.jsp?id=${id}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
    const $ = cheerio.load(await res.text());
    $("script, style").remove();
    out.info[id] = { text: $("body").text().replace(/\s+/g, " ").trim(), html: $("body").html().replace(/\s+/g, " ").slice(0, 3000) };
    await sleep(400);
  }
} catch (err) {
  out.error = `${err.message} ${err.cause ? err.cause.code || err.cause.message : ""}`;
}
fs.writeFileSync("data/debug.json", JSON.stringify(out, null, 2));
