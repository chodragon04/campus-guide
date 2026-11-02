// 학식 크롤러: 학교·생활관·테크노파크 식단을 모아 data/food.json으로 저장한다.
// GitHub Actions(.github/workflows/crawl-food.yml)가 매일 아침 실행한다.
//
// 출처별 수집 방법
//  1) 생활관 식당(KB학사·성림학사·수림학사): housing.seoultech.ac.kr 식당이용안내 페이지의 주간 식단 표(table.chang)
//  2) 학생식당(ST:Table, ST:Dining): 학교 식단 페이지가 연결해 둔 노션 메뉴판(공개 페이지)의 데이터베이스
//  3) 서울테크노파크: 식단 게시판의 최신 글에 올라온 주간 식단 이미지
//
// 학교 홈페이지의 옛 학식 페이지(life/student/food)는 더 이상 식단이 올라오지 않아서,
// 학교가 현재 안내하는 출처(생활관 페이지, 노션 메뉴판, 테크노파크 게시판)를 직접 분석해 작성했다.

import fs from "node:fs";
import * as cheerio from "cheerio";

const OUTPUT = "data/food.json";
const USER_AGENT = "Mozilla/5.0 (campus-guide student project)";

// 생활관 식당: foodtype 값은 식당이용안내 페이지의 학사별 탭 주소에서 확인
const DORM_URL = "https://housing.seoultech.ac.kr/livng/dining/";
const DORMS = [
  { id: "dorm-kb", name: "KB학사", foodtype: "kb" },
  { id: "dorm-sunglim", name: "성림학사", foodtype: "sunglim" },
  { id: "dorm-surim", name: "수림학사", foodtype: "surim" },
];

// 학생식당 노션 메뉴판 (학교 홈페이지 > 대학생활 > 편의/복지 > 식단 의 "식단 바로가기")
const NOTION_HOST = "https://fern-magic-bde.notion.site";
const NOTION_PAGE_ID = "21e45244-ac0a-80fd-b02a-d064ce75d674";

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

// 이번 주 월~일 날짜 7개 (생활관은 주말에도 운영)
function weekDates() {
  const today = kstNow();
  const dow = today.getUTCDay(); // 0 일 ~ 6 토
  const diff = dow === 0 ? -6 : 1 - dow; // 이번 주 월요일까지
  const monday = new Date(today.getTime() + diff * 24 * 60 * 60 * 1000);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    dates.push(formatDate(new Date(monday.getTime() + i * 24 * 60 * 60 * 1000)));
  }
  return dates;
}

// ---------- 공통 ----------

async function request(url, options = {}) {
  let res;
  try {
    res = await fetch(url, {
      ...options,
      headers: { "User-Agent": USER_AGENT, ...(options.headers || {}) },
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    // 네트워크 오류는 원인(cause)까지 기록해야 차단·인증서 문제를 구분할 수 있다
    const cause = err.cause ? ` (${err.cause.code || err.cause.message})` : "";
    throw new Error(`${err.message}${cause}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

async function getHtml(url) {
  const res = await request(url);
  return await res.text();
}

function clean(text) {
  return text.replace(/ /g, " ").replace(/[\t\r]/g, "").replace(/\n\s*\n/g, "\n").trim();
}

// ---------- 1) 생활관 식당 ----------

// 표의 한 칸: "아침 : 메뉴, 메뉴, ... 선택식 - 빵/우유 점심 : ... 저녁 : ..."
const MEAL_NAMES = { 아침: "조식", 점심: "중식", 저녁: "석식" };

function parseDormCell($, td) {
  $(td).find("br").replaceWith("\n");
  const parts = $(td).text().split(/(아침|점심|저녁)\s*:/); // ["", "아침", " 메뉴...", "점심", ...]
  const meals = [];
  for (let i = 1; i < parts.length; i += 2) {
    const items = [];
    for (let line of clean(parts[i + 1]).split("\n")) {
      line = line.trim();
      if (line.startsWith("선택식")) {
        items.push(line); // "선택식 - 빵/요플레/씨리얼/우유"는 한 줄 그대로
      } else {
        items.push(...line.split(",").map((s) => s.trim()).filter((s) => s !== ""));
      }
    }
    if (items.length > 0) meals.push({ name: MEAL_NAMES[parts[i]], items: items });
  }
  return meals;
}

async function crawlDorm(dorm, dates) {
  const html = await getHtml(`${DORM_URL}?foodtype=${dorm.foodtype}`);
  const $ = cheerio.load(html);
  const days = {};
  let success = 0;
  $("table.chang tr").each((i, tr) => {
    const dayOfMonth = parseInt($(tr).find("th").first().text()); // "2일" → 2
    const date = dates.find((d) => Number(d.slice(8)) === dayOfMonth);
    if (!date) return; // 이번 주가 아닌 줄
    const meals = parseDormCell($, $(tr).find("td").first());
    if (meals.length === 0) return;
    days[date] = { meals: meals };
    success++;
  });
  if (success === 0) throw new Error("이번 주 식단 표를 찾지 못함");
  return { id: dorm.id, name: dorm.name, group: "생활관", type: "daily", success: success, days: days };
}

// ---------- 2) 학생식당 (노션 메뉴판) ----------

// 노션 공개 페이지는 화면을 자바스크립트로 그리기 때문에 HTML에는 메뉴가 없다.
// 대신 노션 페이지가 내부적으로 쓰는 API(/api/v3)에 같은 요청을 보내 데이터를 받는다.
async function notion(path, body) {
  const res = await request(`${NOTION_HOST}/api/v3/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return await res.json();
}

// 노션 응답의 레코드는 { value: {...} } 또는 { value: { value: {...} } } 모양
function recordValue(record) {
  if (!record) return {};
  return record.value?.value || record.value || {};
}

function propText(prop) {
  return (prop || []).map((piece) => piece[0]).join("").trim();
}

// 페이지 구성: [안내 상자(제목 "ST: Table 메뉴판")] [메뉴 데이터베이스] [안내 상자(ST: Dining)] [데이터베이스]
async function findNotionMenus() {
  const chunk = await notion("loadPageChunk", {
    pageId: NOTION_PAGE_ID, limit: 100, cursor: { stack: [] }, chunkNumber: 0, verticalColumns: false,
  });
  const blocks = chunk.recordMap.block;
  const page = recordValue(blocks[NOTION_PAGE_ID]);
  const menus = [];
  let title = null;
  for (let id of page.content || []) {
    const block = recordValue(blocks[id]);
    if (block.type === "callout") {
      for (let childId of block.content || []) {
        const text = propText(recordValue(blocks[childId]).properties?.title);
        if (text !== "") title = text.replace("메뉴판", "").trim(); // "ST: Table"
      }
    } else if (block.type === "collection_view" && title) {
      menus.push({ name: title, collectionId: block.collection_id, viewId: block.view_ids[0], spaceId: block.space_id });
      title = null;
    }
  }
  if (menus.length === 0) throw new Error("노션 메뉴판에서 데이터베이스를 찾지 못함");
  return menus;
}

async function queryNotionMenu(menu) {
  const loader = {
    type: "reducer",
    reducers: { collection_group_results: { type: "results", limit: 300 } },
    searchQuery: "",
    userTimeZone: "Asia/Seoul",
  };
  const view = { id: menu.viewId, spaceId: menu.spaceId };
  const target = { id: menu.collectionId, spaceId: menu.spaceId };
  let data;
  try {
    data = await notion("queryCollection", { collection: target, collectionView: view, loader: loader });
  } catch {
    // 노션 API 형식이 바뀐 경우를 대비한 두 번째 형식
    data = await notion("queryCollection", { source: { type: "collection", ...target }, collectionView: view, loader: loader });
  }

  // 열 이름(브랜드, 가격)으로 속성 키 찾기
  const collection = recordValue(data.recordMap.collection?.[menu.collectionId]);
  const schema = collection.schema || {};
  let brandKey = null;
  let priceKey = null;
  for (let key in schema) {
    if (schema[key].name === "브랜드") brandKey = key;
    if (schema[key].name === "가격") priceKey = key;
  }

  const ids = data.result?.reducerResults?.collection_group_results?.blockIds || [];
  const brands = [];
  for (let id of ids) {
    const props = recordValue(data.recordMap.block[id]).properties || {};
    const name = propText(props.title);
    if (name === "") continue;
    const brandName = propText(props[brandKey]) || "기타";
    const price = Number(propText(props[priceKey])) || null;
    let brand = brands.find((b) => b.brand === brandName);
    if (!brand) {
      brand = { brand: brandName, menus: [] };
      brands.push(brand);
    }
    brand.menus.push({ name: name, price: price });
  }
  if (brands.length === 0) throw new Error("메뉴가 비어 있음");

  const id = "st-" + menu.name.split(":").pop().trim().toLowerCase(); // "ST: Table" → "st-table"
  const count = brands.reduce((sum, b) => sum + b.menus.length, 0);
  return { id: id, name: menu.name.replace(": ", ":"), group: "학생식당", type: "fixed", success: count, brands: brands };
}

// ---------- 3) 서울테크노파크 (주간 식단 이미지) ----------

// 게시판 목록에서 제목에 "식단"이 들어간 가장 최근 글을 찾고, 글 본문의 첨부 이미지 주소를 가져온다.
async function crawlTechnopark() {
  let $ = cheerio.load(await getHtml(TECHNOPARK_LIST));

  let post = null;
  $("tbody tr").each((i, tr) => {
    if (post) return; // 이미 찾았으면 건너뛰기 (목록은 최신 글이 위)
    const a = $(tr).find("a").filter((j, el) => $(el).text().includes("식단")).first();
    if (a.length === 0) return;
    // 글 번호는 링크의 onclick 속성 안에 숫자로 들어 있다: fn_view('...', '...', '12345')
    const numbers = (a.attr("onclick") || a.attr("href") || "").match(/\d+/g);
    if (!numbers) return;
    const date = $(tr).text().match(/\d{4}[.-]\d{2}[.-]\d{2}/); // 작성일
    post = {
      boardNo: numbers[numbers.length - 1],
      title: clean(a.text()),
      uploaded: date ? date[0] : "",
    };
  });
  if (!post) throw new Error("식단 게시글을 찾지 못함");

  const link = `${TECHNOPARK_LIST}?View&boardNo=${post.boardNo}`;
  $ = cheerio.load(await getHtml(link));
  const img = $("img").filter((i, el) => ($(el).attr("src") || "").includes("attachfile")).first();
  if (img.length === 0) throw new Error("식단 이미지를 찾지 못함");

  return {
    id: "technopark",
    name: "서울테크노파크",
    group: "테크노파크",
    type: "weekly-image",
    success: 1,
    title: post.title,
    uploaded: post.uploaded,
    imageUrl: new URL(img.attr("src"), TECHNOPARK_HOST).href,
    link: link,
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

// 실패해도 다른 식당은 계속 수집하도록 하나씩 감싼다
async function attempt(info, job) {
  try {
    const result = await job();
    console.log(`${info.name}: 성공 (${result.success})`);
    return result;
  } catch (err) {
    console.log(`${info.name}: 실패 (${err.message})`);
    return { ...info, success: 0, error: err.message };
  }
}

async function main() {
  const dates = weekDates();
  const previous = loadPrevious();
  const results = [];

  for (let dorm of DORMS) {
    const info = { id: dorm.id, name: dorm.name, group: "생활관", type: "daily", days: {} };
    results.push(await attempt(info, () => crawlDorm(dorm, dates)));
  }

  let notionMenus = [];
  try {
    notionMenus = await findNotionMenus();
  } catch (err) {
    console.log(`노션 메뉴판: 실패 (${err.message})`);
    // 페이지를 못 읽으면 지난번에 저장한 학생식당 데이터를 아래에서 그대로 유지한다
    for (let old of previous.cafeterias.filter((c) => c.type === "fixed")) {
      results.push({ id: old.id, name: old.name, group: "학생식당", type: "fixed", success: 0, error: err.message });
    }
  }
  for (let menu of notionMenus) {
    const info = { id: "st-" + menu.name.split(":").pop().trim().toLowerCase(), name: menu.name, group: "학생식당", type: "fixed" };
    results.push(await attempt(info, () => queryNotionMenu(menu)));
  }

  const technoInfo = { id: "technopark", name: "서울테크노파크", group: "테크노파크", type: "weekly-image" };
  results.push(await attempt(technoInfo, crawlTechnopark));

  // 실패한 식당은 지난번 데이터를 유지하고 오류만 기록
  const cafeterias = results.map((r) => {
    if (r.success > 0) return r;
    const old = previous.cafeterias.find((c) => c.id === r.id && c.success > 0);
    if (old) return { ...old, lastError: r.error };
    return r;
  });

  const data = {
    updatedAt: new Date().toISOString(),
    week: dates,
    cafeterias: cafeterias,
  };
  fs.writeFileSync(OUTPUT, JSON.stringify(data, null, 2) + "\n");
  console.log(`${OUTPUT} 저장 완료`);
}

main();
