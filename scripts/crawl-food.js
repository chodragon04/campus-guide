// 학식 크롤러: 학교 홈페이지에서 식단을 가져와 data/food.json으로 저장한다.
// GitHub Actions(.github/workflows/crawl-food.yml)가 매일 실행한다.
//
// 원본: 과기대 디스코드 봇의 menucrawler.py (Python)를 JavaScript(Node.js)로 옮겨 수정함.
//  - 제2학생회관 식단 파싱 방식(주소, 선택자)과 서울테크노파크 식단 게시글 파싱 방식을 그대로 따름
//  - DB(sqlite) 대신 JSON 파일로 저장, 하루가 아니라 한 주(월~금)를 가져오도록 변경
//  - 식당 목록을 CAFETERIAS 배열로 분리해 location_code만 추가하면 다른 식당도 가져오게 함

import fs from "node:fs";
import * as cheerio from "cheerio";

const OUTPUT = "data/food.json";

// 학교 학식 페이지(life/student/food2)에서 가져올 식당 목록
// 다른 식당을 추가하려면 학식 페이지의 식당 선택 메뉴에서 location_code를 확인해 한 줄 추가한다.
const CAFETERIAS = [
  { id: "sc2", name: "제2학생회관", locationCode: 20 },
  // { id: "sc1", name: "제1학생회관", locationCode: 00 },
  // { id: "dorm", name: "생활관 식당", locationCode: 00 },
];

const FOOD_URL = "https://www.seoultech.ac.kr/life/student/food2/";
const TECHNOPARK_LIST = "https://www.seoultp.or.kr/user/nd70791.do";
const TECHNOPARK_HOST = "https://www.seoultp.or.kr";

// ---------- 날짜 (한국 시간 기준) ----------

function kstNow() {
  const now = new Date();
  return new Date(now.getTime() + 9 * 60 * 60 * 1000); // getUTC*로 읽으면 한국 시간
}

function formatDate(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 이번 주 월~금 날짜 5개 (토·일이면 다음 주)
function weekDates() {
  const today = kstNow();
  const dow = today.getUTCDay(); // 0 일 ~ 6 토
  let diff = 1 - dow; // 이번 주 월요일까지
  if (dow === 6) diff = 2; // 토 → 다음 주 월
  if (dow === 0) diff = 1; // 일 → 다음 주 월
  const monday = new Date(today.getTime() + diff * 24 * 60 * 60 * 1000);
  const dates = [];
  for (let i = 0; i < 5; i++) {
    dates.push(formatDate(new Date(monday.getTime() + i * 24 * 60 * 60 * 1000)));
  }
  return dates;
}

// ---------- 공통 ----------

async function getHtml(url) {
  let res;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (campus-guide student project)" },
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    // 네트워크 오류는 원인(cause)까지 기록해야 차단·인증서 문제를 구분할 수 있다
    const cause = err.cause ? ` (${err.cause.code || err.cause.message})` : "";
    throw new Error(`${err.message}${cause}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

function clean(text) {
  return text.replace(/[\t\r]/g, "").replace(/\n\s*\n/g, "\n").trim();
}

// ---------- 학교 학식 페이지 ----------

// [임시 디버그] 페이지 구조 요약: 식당 선택 메뉴, 표 목록
let debugInfo = null;
function describePage($, url) {
  const options = [];
  $("select option, a[href*='location_code']").each((i, el) => {
    options.push(`${clean($(el).text())} | ${$(el).attr("value") || $(el).attr("href")}`);
  });
  const tables = [];
  $("table").each((i, t) => {
    const parents = $(t).parents().slice(0, 4).map((j, p) => `${p.tagName}.${($(p).attr("class") || "").trim()}#${$(p).attr("id") || ""}`).get();
    const rows = $(t).find("tr").slice(0, 4).map((j, tr) => clean($(tr).text()).replace(/\s+/g, " ").slice(0, 120)).get();
    tables.push({ class: $(t).attr("class") || "", parents: parents, rows: rows });
  });
  const headings = $("h2, h3, h4, .tit, .title").slice(0, 20).map((i, h) => clean($(h).text()).slice(0, 60)).get();
  return { url: url, options: options.slice(0, 40), tables: tables.slice(0, 10), headings: headings };
}

// menucrawler.py의 student_cafeteria_2()와 같은 선택자 사용
// 중식: .dts_design > div:nth-child(5) > div:nth-child(2) 의 표
// 석식: .dts_design > div:nth-child(5) > div:nth-child(4) 의 표
// 각 표의 첫 행은 제목 행, 그다음 행부터 [메뉴명, 가격, 반찬]
function parseMenuTable($, selector) {
  const rows = $(selector).first().find("tr");
  const menus = [];
  rows.each((i, tr) => {
    if (i === 0) return; // 제목 행 건너뛰기
    const tds = $(tr).find("td");
    if (tds.length < 3) return;
    const name = clean($(tds[0]).text());
    if (name === "") return;
    menus.push({
      name: name,
      price: clean($(tds[1]).text()),
      side: clean($(tds[2]).text()),
    });
  });
  return menus;
}

async function crawlCafeteriaDay(cafeteria, date) {
  const url = `${FOOD_URL}?location_code=${cafeteria.locationCode}&food_date=${date}`;
  const html = await getHtml(url);
  const $ = cheerio.load(html);
  const lunch = parseMenuTable($, ".dts_design > div:nth-child(5) > div:nth-child(2) table");
  const dinner = parseMenuTable($, ".dts_design > div:nth-child(5) > div:nth-child(4) table");
  if (lunch.length === 0 && dinner.length === 0) {
    if (!debugInfo) debugInfo = describePage($, url);
    throw new Error("식단 없음 (휴무이거나 페이지 구조가 바뀜)");
  }
  return { lunch, dinner };
}

async function crawlCafeteria(cafeteria, dates) {
  const days = {};
  let success = 0;
  for (let date of dates) {
    try {
      days[date] = await crawlCafeteriaDay(cafeteria, date);
      success++;
    } catch (err) {
      days[date] = { error: err.message };
    }
  }
  return { id: cafeteria.id, name: cafeteria.name, type: "daily", success: success, days: days };
}

// ---------- 서울테크노파크 (주간 식단 이미지) ----------

// menucrawler.py의 technopark()와 같은 방식: 게시판 첫 글에서 식단 이미지 주소를 찾는다
async function crawlTechnopark() {
  const listHtml = await getHtml(TECHNOPARK_LIST);
  let $ = cheerio.load(listHtml);
  const link = $(".board-list > tbody tr").first().find("td:nth-child(2) a").first();
  if (link.length === 0) throw new Error("게시글을 찾지 못함");
  const boardNo = $.html(link).split("'")[5]; // onclick 안의 게시글 번호
  const title = clean(link.text());
  const uploaded = clean($(".board-list > tbody tr").first().find("td:nth-child(4)").text());

  const viewHtml = await getHtml(`${TECHNOPARK_LIST}?View&boardNo=${boardNo}`);
  $ = cheerio.load(viewHtml);
  const img = $(".board-write > tbody tr:nth-child(4) img").first();
  if (img.length === 0) throw new Error("식단 이미지를 찾지 못함");

  return {
    id: "technopark",
    name: "서울테크노파크",
    type: "weekly-image",
    success: 1,
    title: title,
    uploaded: uploaded,
    imageUrl: TECHNOPARK_HOST + img.attr("src"),
    link: `${TECHNOPARK_LIST}?View&boardNo=${boardNo}`,
  };
}

// ---------- 실행 ----------

function loadPrevious() {
  try {
    return JSON.parse(fs.readFileSync(OUTPUT, "utf-8"));
  } catch {
    return { cafeterias: [] };
  }
}

async function main() {
  const dates = weekDates();
  const previous = loadPrevious();
  const results = [];

  for (let cafeteria of CAFETERIAS) {
    let result;
    try {
      result = await crawlCafeteria(cafeteria, dates);
    } catch (err) {
      result = { id: cafeteria.id, name: cafeteria.name, type: "daily", success: 0, error: err.message, days: {} };
    }
    results.push(result);
    console.log(`${cafeteria.name}: ${result.success}/${dates.length}일 성공`);
  }

  try {
    results.push(await crawlTechnopark());
    console.log("서울테크노파크: 성공");
  } catch (err) {
    results.push({ id: "technopark", name: "서울테크노파크", type: "weekly-image", success: 0, error: err.message });
    console.log(`서울테크노파크: 실패 (${err.message})`);
  }

  // 한 번도 성공하지 못한 식당은 지난번 데이터를 유지하고 오류만 기록
  const cafeterias = results.map((r) => {
    if (r.success > 0) return r;
    const old = previous.cafeterias.find((c) => c.id === r.id && c.success > 0);
    if (old) return { ...old, lastError: r.error || "이번 주 식단을 가져오지 못함" };
    return r;
  });

  const data = {
    updatedAt: new Date().toISOString(),
    week: dates,
    cafeterias: cafeterias,
  };
  if (debugInfo) data.debug = debugInfo;
  fs.writeFileSync(OUTPUT, JSON.stringify(data, null, 2) + "\n");
  console.log(`${OUTPUT} 저장 완료`);
}

main();
