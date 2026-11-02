// 개설 강좌 크롤러: 수강신청시스템의 시간표 조회(로그인 불필요)에서 이번 학기 강좌 목록을 받아
// data/courses.json으로 저장한다. GitHub Actions(.github/workflows/crawl-courses.yml)가 주 1회 실행한다.
//
// 시간표 조회 화면(https://for-s.seoultech.ac.kr/html/pub/schedule.jsp)은 표를 그릴 때
// /JSONMain 주소에 JSON으로 조회 조건을 보내고 JSON으로 강좌 목록을 받는다. 같은 요청을 보낸다.
//  - 먼저 조회 화면을 열어 세션 쿠키를 받아야 "need login" 오류가 나지 않는다.

import fs from "node:fs";

const HOST = "https://for-s.seoultech.ac.kr";
const PAGE = "/html/pub/schedule.jsp";
const OUTPUT = "data/courses.json";
const DAY_NIGHT = { "00500001": "주간", "00500002": "야간" };

// ---------- 세션 쿠키를 유지하며 요청 ----------

let cookie = "";

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(HOST + path, {
      ...options,
      headers: {
        "User-Agent": "Mozilla/5.0 (campus-guide student project)",
        Referer: HOST + PAGE,
        Cookie: cookie,
        ...(options.headers || {}),
      },
      signal: AbortSignal.timeout(60000),
    });
  } catch (err) {
    const cause = err.cause ? ` (${err.cause.code || err.cause.message})` : "";
    throw new Error(`${err.message}${cause}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  // 받은 쿠키를 모두 저장해 두었다가 다음 요청에 함께 보낸다 (브라우저가 하는 일)
  const jar = {};
  for (let pair of cookie.split("; ").filter((c) => c !== "")) {
    const [key, value] = pair.split(/=(.*)/s);
    jar[key] = value;
  }
  for (let setCookie of res.headers.getSetCookie()) {
    const [key, value] = setCookie.split(";")[0].split(/=(.*)/s);
    jar[key] = value;
  }
  cookie = Object.entries(jar).map(([key, value]) => `${key}=${value}`).join("; ");
  return res;
}

// ---------- 데이터 다듬기 ----------

// "수(3 ~ 4), 목(3)" → [{ day: "수", start: 3, end: 4 }, { day: "목", start: 3, end: 3 }]
// 괄호 안에 구간이 여러 개인 경우도 있다: "화(2 ~ 2, 11 ~ 13)", "화(2, 8 ~ 9)", "화(1A, 2 ~ 2)"
function parseTimes(text) {
  const slots = [];
  for (let match of (text || "").matchAll(/([월화수목금토일])\(([^)]*)\)/g)) {
    const day = match[1];
    for (let part of match[2].split(",")) {
      const numbers = part.split("~").map((n) => parseInt(n)); // "1A" → 1
      if (numbers.some((n) => isNaN(n))) continue;
      const start = numbers[0];
      const end = numbers[numbers.length - 1];
      // 같은 구간이 반복해서 적힌 경우("5A ~ 5A, 5A ~ 5A") 한 번만
      if (!slots.some((s) => s.day === day && s.start === start && s.end === end)) {
        slots.push({ day: day, start: start, end: end });
      }
    }
  }
  return slots;
}

// "다산관-316 다산관-316 " → "다산관-316" (같은 강의실이 반복되면 한 번만)
function cleanRoom(text) {
  const rooms = (text || "").trim().split(/\s+/).filter((r) => r !== "");
  return [...new Set(rooms)].join(", ");
}

function toCourse(row) {
  return {
    id: `${row.SUBJ_CD}-${row.LECT_NUMB}`,
    name: row.SUBJ_KNM,
    dept: row.MNG_LESS_NM,
    type: row.CMPT_DIV_NM, // 전필, 전선, 교필 ...
    credit: Number(row.UNIT),
    prof: row.PROF_NM || "",
    time: row.LSTM_LIST || "",
    slots: parseTimes(row.LSTM_LIST),
    room: cleanRoom(row.BLDG_COUM),
    dayNight: row.DN_DIV_NM,
  };
}

// ---------- 실행 ----------

async function main() {
  // 1) 조회 화면 열기: 세션 쿠키 받기 + 현재 조회 가능한 학기(maxYmst) 읽기
  const pageHtml = await (await request(PAGE)).text();
  for (let script of ["/js/fsp/sz_fsp_json.js.jsp", "/js/stech/lang.js.jsp"]) await request(script);
  const found = pageHtml.match(/maxYmst\s*=\s*'(\d{5})'/);
  if (!found) throw new Error("조회 가능한 학기를 찾지 못함");
  const ymst = found[1]; // "20262" → 2026년 2학기

  // 2) 주간·야간 전체 강좌 조회
  const courses = [];
  for (let code in DAY_NIGHT) {
    const res = await request("/JSONMain", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
      body: JSON.stringify({
        fsp_action: "GridAction",
        fsp_cmd: "getScheduleGridData",
        SP_YMST: ymst,
        LESS_CD: "", // 전체 학과
        DN_DIV: code,
        SUBJ_NM: "",
        LECT_DIV: "",
        DOTW_CD: "",
      }),
    });
    const data = await res.json();
    if (String(data.ErrorCode) !== "0") throw new Error(`${DAY_NIGHT[code]} 조회 실패: ${data.ErrorMsg}`);
    for (let row of data.rows || []) courses.push(toCourse(row));
    console.log(`${DAY_NIGHT[code]}: ${(data.rows || []).length}개`);
  }
  if (courses.length === 0) throw new Error("강좌가 하나도 없음");

  courses.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const result = {
    updatedAt: new Date().toISOString(),
    semester: `${ymst.slice(0, 4)}-${ymst.slice(4)}`, // "2026-2"
    count: courses.length,
    courses: courses,
  };
  fs.writeFileSync(OUTPUT, JSON.stringify(result) + "\n"); // 파일이 커서 줄바꿈 없이 저장
  console.log(`${OUTPUT} 저장 완료 (${courses.length}개)`);
}

main().catch((err) => {
  // 실패하면 기존 파일을 그대로 두고 Actions에 실패로 표시
  console.error(`강좌 수집 실패: ${err.message}`);
  process.exit(1);
});
