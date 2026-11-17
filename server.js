// 캠퍼스 가이드 서버 (Node.js + Express)
//  - 사이트 파일(html, css, js, data) 제공
//  - API: 강좌 검색, 학식 조회, 회원가입·로그인, 내 시간표 저장
// 실행: npm start → http://localhost:3000
//
// 환경 변수 (Render의 Environment 메뉴에서 설정, 저장소에는 넣지 않음)
//  - MONGODB_URI: MongoDB 접속 주소. 없으면 회원 기능 없이 실행
//  - SESSION_SECRET: 로그인 쿠키 서명용 비밀값 (긴 무작위 문자열)
//  - PORT: Render가 알려 주는 포트

import { connectDb } from "./server/db.js";
import { createApp } from "./server/app.js";

const PORT = process.env.PORT || 3000;

let db = null;
if (process.env.MONGODB_URI) {
  try {
    db = await connectDb(process.env.MONGODB_URI);
    console.log("MongoDB 연결됨");
  } catch (err) {
    console.error(`MongoDB 연결 실패: ${err.message} (회원 기능 없이 실행)`);
  }
} else {
  console.warn("MONGODB_URI가 없어 회원 기능 없이 실행합니다.");
}

const app = createApp({ db: db, sessionSecret: process.env.SESSION_SECRET });

app.listen(PORT, () => {
  console.log(`캠퍼스 가이드 서버 실행 중: http://localhost:${PORT}`);
});
