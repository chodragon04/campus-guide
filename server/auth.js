// 회원가입·로그인·로그아웃
//  - 비밀번호는 bcrypt로 해시해서 저장 (원래 비밀번호는 서버도 알 수 없음)
//  - 로그인 상태는 세션(쿠키에는 세션 ID만, 내용은 DB에 저장)으로 유지
//  - 같은 IP에서 짧은 시간에 너무 많이 시도하면 잠시 막음
import crypto from "node:crypto";
import express from "express";
import bcrypt from "bcryptjs";
import { rateLimit } from "express-rate-limit";

const USERNAME = /^[a-z0-9_]{4,20}$/; // 영어 소문자·숫자·밑줄 4~20자
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 64; // bcrypt는 72바이트까지만 쓰므로 넉넉히 제한
const WRONG = "아이디 또는 비밀번호가 맞지 않습니다.";

// 없는 아이디로 로그인할 때도 비밀번호 비교 시간을 똑같이 써서, 응답 시간으로 아이디 존재 여부를 알 수 없게 한다
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

// 로그인한 사람만 쓸 수 있는 API 앞에 붙이는 검사
export function requireLogin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "로그인이 필요합니다." });
  next();
}

// 로그인 성공: 세션 ID를 새로 만들어(세션 고정 공격 방지) 사용자 정보를 담는다
function startSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = user._id;
      req.session.username = user.username;
      resolve();
    });
  });
}

export function authRouter(db) {
  const router = express.Router();

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분 동안
    limit: 20, // 20번까지
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "시도가 너무 많습니다. 15분 뒤에 다시 시도하세요." },
  });

  // 지금 로그인한 사람 (accounts: 회원 기능을 쓸 수 있는 서버인지)
  router.get("/me", (req, res) => {
    const user = req.session.userId ? { username: req.session.username } : null;
    res.json({ accounts: Boolean(db), user: user });
  });

  // DB가 없으면(접속 주소 미설정) 아래 기능은 쓸 수 없음
  router.use((req, res, next) => {
    if (!db) return res.status(503).json({ error: "회원 기능을 사용할 수 없습니다. (DB 미연결)" });
    next();
  });

  router.post("/signup", limiter, async (req, res, next) => {
    try {
      const username = String(req.body.username || "").trim().toLowerCase();
      const password = String(req.body.password || "");
      if (!USERNAME.test(username)) {
        return res.status(400).json({ error: "아이디는 영어 소문자, 숫자, 밑줄(_)로 4~20자입니다." });
      }
      if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
        return res.status(400).json({ error: `비밀번호는 ${PASSWORD_MIN}~${PASSWORD_MAX}자입니다.` });
      }

      const user = {
        _id: crypto.randomUUID(),
        username: username,
        passwordHash: await bcrypt.hash(password, 10),
        createdAt: new Date(),
      };
      try {
        await db.users.insertOne(user);
      } catch (err) {
        if (err.code === 11000) return res.status(409).json({ error: "이미 사용 중인 아이디입니다." });
        throw err;
      }
      await startSession(req, user);
      res.status(201).json({ user: { username: user.username } });
    } catch (err) {
      next(err);
    }
  });

  router.post("/login", limiter, async (req, res, next) => {
    try {
      const username = String(req.body.username || "").trim().toLowerCase();
      const password = String(req.body.password || "");
      const user = await db.users.findOne({ username: username });
      const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
      if (!user || !ok) return res.status(401).json({ error: WRONG });

      await startSession(req, user);
      res.json({ user: { username: user.username } });
    } catch (err) {
      next(err);
    }
  });

  router.post("/logout", (req, res, next) => {
    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie("cg.sid");
      res.json({ user: null });
    });
  });

  return router;
}
