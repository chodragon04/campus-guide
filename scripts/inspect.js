// [임시] 새 학식 페이지 구조 확인용. 파서 작성 후 삭제한다.
import fs from "node:fs";
import * as cheerio from "cheerio";

const PAGES = [
  "https://www.seoultech.ac.kr/life/student/food",
  "https://housing.seoultech.ac.kr/livng/dining",
];

const clean = (t) => t.replace(/\s+/g, " ").trim();

async function describe(url) {
  let res;
  try {
    res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (campus-guide student project)" }, signal: AbortSignal.timeout(15000) });
  } catch (err) {
    return { url, error: `${err.message} ${err.cause ? err.cause.code || err.cause.message : ""}` };
  }
  const html = await res.text();
  const $ = cheerio.load(html);
  const links = [];
  $("a[href], option, button[onclick], li[onclick]").each((i, el) => {
    const href = $(el).attr("href") || $(el).attr("value") || $(el).attr("onclick") || "";
    const text = clean($(el).text()).slice(0, 40);
    if (/food|dining|loc|date|week|식|당|관|조식|중식|석식|주/.test(href + text)) links.push(`${text} | ${href}`);
  });
  const forms = $("form").map((i, f) => ({
    action: $(f).attr("action") || "",
    inputs: $(f).find("input, select").map((j, inp) => `${inp.tagName}[name=${$(inp).attr("name")}] value=${$(inp).attr("value") || ""} type=${$(inp).attr("type") || ""}`).get(),
  })).get();
  const tables = $("table").slice(0, 8).map((i, t) => ({
    class: $(t).attr("class") || "",
    parents: $(t).parents().slice(0, 5).map((j, p) => `${p.tagName}.${($(p).attr("class") || "").trim()}#${$(p).attr("id") || ""}`).get(),
    rows: $(t).find("tr").slice(0, 6).map((j, tr) => $(tr).children().map((k, c) => `${c.tagName}:${clean($(c).text()).slice(0, 50)}`).get().join(" || ")).get(),
  })).get();
  const iframes = $("iframe").map((i, f) => $(f).attr("src")).get();
  const scripts = $("script").map((i, s) => $(s).attr("src") || clean($(s).html() || "").slice(0, 200)).get().filter((s) => /ajax|food|dining|menu|json|url/i.test(s)).slice(0, 10);
  const idx = html.search(/중식|석식|조식/);
  const snippet = idx >= 0 ? html.slice(Math.max(0, idx - 1500), idx + 1500) : "";
  return { url, status: res.status, finalUrl: res.url, title: clean($("title").text()), links: links.slice(0, 60), forms, tables, iframes, scripts, snippet };
}

const out = [];
for (const url of PAGES) out.push(await describe(url));
fs.writeFileSync("data/debug.json", JSON.stringify(out, null, 2));
console.log("data/debug.json 저장");
