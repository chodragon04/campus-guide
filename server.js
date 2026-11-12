// 캠퍼스 가이드 서버 (Node.js + Express)
//  - 사이트 파일(html, css, js, data)을 그대로 제공
//  - API: 강좌 검색, 학식 조회 (요청마다 서버가 필요한 부분만 골라서 응답)
// 실행: npm start → http://localhost:3000

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

const app = express();
const PORT = process.env.PORT || 3000; // Render는 PORT 환경 변수로 포트를 알려준다
const ROOT = path.dirname(fileURLToPath(import.meta.url)); // 이 파일이 있는 폴더 (저장소 최상위)

// ---------- 데이터 ----------

// data/*.json은 GitHub Actions가 갱신해 커밋한다. 파일이 바뀌었을 때만 다시 읽는다.
const cache = {};

function readData(name) {
  const file = path.join(ROOT, "data", name);
  const modified = fs.statSync(file).mtimeMs;
  if (!cache[name] || cache[name].modified !== modified) {
    cache[name] = { modified: modified, data: JSON.parse(fs.readFileSync(file, "utf-8")) };
  }
  return cache[name].data;
}

// ---------- API ----------

// 강좌 검색: /api/courses?q=웹프로그래밍&limit=30
// 과목명·교수명에 검색어가 들어간 강좌를 찾고, 검색어로 시작하는 과목을 앞에 둔다
app.get("/api/courses", (req, res) => {
  const keyword = String(req.query.q || "").trim().toLowerCase();
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const data = readData("courses.json");

  if (keyword.length < 2) {
    return res.status(400).json({ error: "검색어는 2글자 이상 입력하세요." });
  }

  const found = data.courses.filter(
    (c) => c.name.toLowerCase().includes(keyword) || c.prof.toLowerCase().includes(keyword)
  );
  const startsWith = (c) => Number(c.name.toLowerCase().startsWith(keyword));
  found.sort((a, b) => startsWith(b) - startsWith(a));

  res.json({
    semester: data.semester,
    total: found.length, // 전체 검색 결과 수
    courses: found.slice(0, limit), // 그중 보내는 강좌
  });
});

// 강좌 목록 정보(학기, 전체 강좌 수): /api/courses/info
app.get("/api/courses/info", (req, res) => {
  const data = readData("courses.json");
  res.json({ semester: data.semester, count: data.count, updatedAt: data.updatedAt });
});

// 학식: /api/food (이번 주 전체) 또는 /api/food?date=2026-11-11 (그날 식단만)
app.get("/api/food", (req, res) => {
  const data = readData("food.json");
  const date = req.query.date;
  if (!date) return res.json(data);

  if (!data.week.includes(date)) {
    return res.status(404).json({ error: `${date}는 이번 주 식단에 없습니다.`, week: data.week });
  }
  // 날짜별 식단(생활관)은 그날 것만 남기고, 고정 메뉴·주간 이미지는 그대로
  const cafeterias = data.cafeterias.map((c) => {
    if (c.type !== "daily") return c;
    return { ...c, days: { [date]: c.days[date] || null } };
  });
  res.json({ updatedAt: data.updatedAt, date: date, cafeterias: cafeterias });
});

// 없는 API 주소
app.use("/api", (req, res) => {
  res.status(404).json({ error: "없는 API입니다." });
});

// ---------- 사이트 파일 ----------

// 저장소에는 크롤러(scripts/), 설정 파일 등도 있으므로 사이트에 필요한 폴더와 html 파일만 공개한다
// (폴더마다 따로 연결해서 "/css/../server.js" 같은 주소로 다른 파일에 접근할 수 없게 한다)
for (let folder of ["css", "js", "data"]) {
  app.use(`/${folder}`, express.static(path.join(ROOT, folder)));
}

const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));
app.get("/", (req, res) => res.sendFile(path.join(ROOT, "index.html")));
app.get("/:page", (req, res, next) => {
  if (!pages.includes(req.params.page)) return next();
  res.sendFile(path.join(ROOT, req.params.page));
});

app.use((req, res) => {
  res.status(404).send("페이지를 찾을 수 없습니다.");
});

app.listen(PORT, () => {
  console.log(`캠퍼스 가이드 서버 실행 중: http://localhost:${PORT}`);
});
