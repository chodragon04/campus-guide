// Express 앱 만들기: API와 사이트 파일 제공
// (server.js가 DB에 연결한 뒤 이 함수로 앱을 만든다. 시험할 때는 가짜 DB를 넣어 만들 수 있다)
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import { ROOT, readData } from "./data.js";
import { authRouter } from "./auth.js";
import { timetableRouter } from "./timetable.js";

export function createApp({ db = null, sessionSecret, sessionStore } = {}) {
  const app = express();

  // Render는 앞단 프록시가 HTTPS를 처리하므로, 프록시가 알려 주는 접속 정보를 믿도록 설정
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "20kb" }));

  // ---------- 세션 (로그인 상태) ----------
  if (!sessionSecret) {
    sessionSecret = crypto.randomBytes(32).toString("hex");
    console.warn("SESSION_SECRET 환경 변수가 없어 임시 값을 씁니다. 서버가 다시 시작되면 모두 로그아웃됩니다.");
  }
  app.use(
    session({
      name: "cg.sid",
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false, // 로그인하지 않은 방문자에게는 세션을 만들지 않음
      // 세션 내용은 DB에 저장 (무료 서버가 잠들었다 깨어나도 로그인 유지)
      store: sessionStore || (db && db.client ? MongoStore.create({ client: db.client, ttl: 30 * 24 * 60 * 60 }) : undefined),
      cookie: {
        httpOnly: true, // 자바스크립트로 쿠키를 읽을 수 없게
        sameSite: "lax", // 다른 사이트에서 보낸 요청에는 쿠키를 붙이지 않게
        secure: "auto", // HTTPS 접속이면 HTTPS에서만 쿠키 전송
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30일
      },
    })
  );

  // 데이터를 바꾸는 요청(POST·PUT·DELETE)은 JSON만 받는다
  // (다른 사이트의 form이 몰래 요청을 보내는 것을 막는 데 도움)
  app.use("/api", (req, res, next) => {
    if (req.method !== "GET" && !req.is("application/json")) {
      return res.status(415).json({ error: "JSON으로 요청하세요." });
    }
    next();
  });

  // ---------- 데이터 API ----------

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

  // ---------- 회원·시간표 API ----------
  app.use("/api/auth", authRouter(db));
  app.use("/api/timetable", timetableRouter(db));

  // 없는 API 주소
  app.use("/api", (req, res) => {
    res.status(404).json({ error: "없는 API입니다." });
  });

  // ---------- 사이트 파일 ----------

  // 저장소에는 크롤러(scripts/), 서버 코드, 설정 파일 등도 있으므로 사이트에 필요한 폴더와 html 파일만 공개한다
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

  // 처리 중 오류: 자세한 내용은 서버 로그에만 남기고 사용자에게는 짧게
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: "서버 오류가 발생했습니다. 잠시 후 다시 시도하세요." });
  });

  return app;
}
