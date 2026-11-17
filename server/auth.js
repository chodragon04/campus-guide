// 회원가입·로그인·로그아웃
//  - 비밀번호는 bcrypt로 해시해서 저장 (원래 비밀번호는 서버도 알 수 없음)
//  - 로그인 상태는 세션(쿠키에는 세션 ID만, 내용은 DB에 저장)으로 유지
//  - 같은 IP에서 짧은 시간에 너무 많이 시도하면 잠시 막음
//  - 비밀번호를 잊었을 때는 가입 때 받은 복구 코드로 재설정 (이메일 없이)
import crypto from "node:crypto";
import express from "express";
import bcrypt from "bcryptjs";
import { rateLimit } from "express-rate-limit";

const USERNAME = /^[a-z0-9_]{4,20}$/; // 영어 소문자·숫자·밑줄 4~20자
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 64;
// bcrypt는 앞 72바이트만 쓰므로(한글은 1글자 3바이트) 바이트 수도 확인: 넘는 부분이 무시되지 않게
function badPassword(p) {
  return p.length < PASSWORD_MIN || p.length > PASSWORD_MAX || Buffer.byteLength(p) > 72;
}
const WRONG = "아이디 또는 비밀번호가 맞지 않습니다.";
const NICKNAME_MAX = 12;

// 닉네임 정리: 앞뒤 공백 제거, 연속 공백은 하나로, 제어 문자 제거 → 1~12글자
// (닉네임에 <script> 같은 글자를 넣어도 화면에서는 항상 글자로만 표시한다: innerText 사용)
export function cleanNickname(value) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// 닉네임 검사: 문제가 있으면 오류 메시지, 없으면 null (이모지 같은 글자도 한 글자로 센다)
function checkNickname(nickname) {
  const length = [...nickname].length;
  if (length < 1 || length > NICKNAME_MAX) return `닉네임은 1~${NICKNAME_MAX}글자입니다.`;
  return null;
}

// 복구 코드: 헷갈리는 글자(0·O, 1·I·L)를 뺀 31글자 중 무작위 12글자 → "K7Q2-XP9M-4WTB"
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function newRecoveryCode() {
  let code = "";
  for (let i = 0; i < 12; i++) code += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8)}`;
}

// 입력한 코드 정리: 소문자·띄어쓰기·하이픈 차이는 무시
function normalizeCode(code) {
  return String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// 복구 코드도 비밀번호처럼 해시로만 저장
function hashRecoveryCode(code) {
  return bcrypt.hash(normalizeCode(code), 10);
}

// 없는 아이디로 로그인할 때도 비밀번호 비교 시간을 똑같이 써서, 응답 시간으로 아이디 존재 여부를 알 수 없게 한다
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

// 세션 확인: 로그인 뒤에 계정이 지워졌거나(DB 초기화 등) 비밀번호가 바뀌었으면 로그아웃 처리
// (다른 기기에서 비밀번호를 바꾸면 이 기기의 로그인도 끊긴다)
export function checkSession(db) {
  return async (req, res, next) => {
    try {
      if (!db || !req.session.userId) return next();
      const user = await db.users.findOne({ _id: req.session.userId });
      const changedAt = user && user.passwordChangedAt ? new Date(user.passwordChangedAt).getTime() : 0;
      if (!user || changedAt > (req.session.loginAt || 0)) {
        delete req.session.userId;
        delete req.session.username;
        delete req.session.loginAt;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

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
      req.session.loginAt = Date.now(); // 비밀번호를 바꾸면 이 시각 이전의 로그인은 무효
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

  // 복구 코드로 재설정은 코드를 하나씩 넣어 보는 공격을 막으려고 더 엄격하게
  const recoverLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "시도가 너무 많습니다. 15분 뒤에 다시 시도하세요." },
  });

  // 지금 로그인한 사람 (accounts: 회원 기능을 쓸 수 있는 서버인지)
  // user.friendRequests: 받은 친구 신청 수 (헤더 알림용)
  router.get("/me", async (req, res, next) => {
    try {
      if (!db || !req.session.userId) return res.json({ accounts: Boolean(db), user: null });
      const user = await db.users.findOne({ _id: req.session.userId });
      const received = await db.friendships.find({ to: req.session.userId, status: "pending" }).toArray();
      res.json({
        accounts: Boolean(db),
        user: { username: req.session.username, nickname: (user && user.nickname) || "", friendRequests: received.length },
      });
    } catch (err) {
      next(err);
    }
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
      if (badPassword(password)) {
        return res.status(400).json({ error: `비밀번호는 ${PASSWORD_MIN}~${PASSWORD_MAX}자입니다. (한글은 24자까지)` });
      }
      const nickname = cleanNickname(req.body.nickname);
      const nicknameError = checkNickname(nickname);
      if (nicknameError) return res.status(400).json({ error: nicknameError });

      const recoveryCode = newRecoveryCode();
      const user = {
        _id: crypto.randomUUID(),
        username: username,
        passwordHash: await bcrypt.hash(password, 10),
        nickname: nickname,
        recoveryHash: await hashRecoveryCode(recoveryCode),
        createdAt: new Date(),
      };
      try {
        await db.users.insertOne(user);
      } catch (err) {
        if (err.code === 11000) return res.status(409).json({ error: "이미 사용 중인 아이디입니다." });
        throw err;
      }
      await startSession(req, user);
      // 복구 코드는 이때 한 번만 보여 준다 (서버에는 해시만 남음)
      res.status(201).json({ user: { username: user.username, nickname: nickname }, recoveryCode: recoveryCode });
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

  // 비밀번호 변경: { currentPassword, newPassword }
  router.post("/password", limiter, requireLogin, async (req, res, next) => {
    try {
      const currentPassword = String(req.body.currentPassword || "");
      const newPassword = String(req.body.newPassword || "");
      const user = await db.users.findOne({ _id: req.session.userId });
      if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
        return res.status(401).json({ error: "현재 비밀번호가 맞지 않습니다." });
      }
      if (badPassword(newPassword)) {
        return res.status(400).json({ error: `새 비밀번호는 ${PASSWORD_MIN}~${PASSWORD_MAX}자입니다. (한글은 24자까지)` });
      }
      if (newPassword === currentPassword) {
        return res.status(400).json({ error: "새 비밀번호가 현재 비밀번호와 같습니다." });
      }

      await db.users.updateOne(
        { _id: user._id },
        { $set: { passwordHash: await bcrypt.hash(newPassword, 10), passwordChangedAt: new Date() } }
      );
      // 이 기기는 새로 로그인한 것으로 처리하고, 다른 기기의 로그인은 끊는다(checkSession)
      await startSession(req, user);
      res.json({ result: "changed" });
    } catch (err) {
      next(err);
    }
  });

  // 비밀번호 찾기: { username, recoveryCode, newPassword }
  // 성공하면 비밀번호를 바꾸고 로그인하며, 쓴 복구 코드 대신 새 코드를 발급한다
  router.post("/recover", recoverLimiter, async (req, res, next) => {
    try {
      const username = String(req.body.username || "").trim().toLowerCase();
      const newPassword = String(req.body.newPassword || "");
      const user = await db.users.findOne({ username: username });
      const ok = await bcrypt.compare(
        normalizeCode(req.body.recoveryCode),
        user && user.recoveryHash ? user.recoveryHash : DUMMY_HASH
      );
      if (!user || !user.recoveryHash || !ok) {
        return res.status(401).json({ error: "아이디 또는 복구 코드가 맞지 않습니다." });
      }
      if (badPassword(newPassword)) {
        return res.status(400).json({ error: `새 비밀번호는 ${PASSWORD_MIN}~${PASSWORD_MAX}자입니다. (한글은 24자까지)` });
      }

      const recoveryCode = newRecoveryCode();
      await db.users.updateOne(
        { _id: user._id },
        {
          $set: {
            passwordHash: await bcrypt.hash(newPassword, 10),
            recoveryHash: await hashRecoveryCode(recoveryCode),
            passwordChangedAt: new Date(), // 다른 기기 로그인은 해제
          },
        }
      );
      await startSession(req, user);
      res.json({ user: { username: user.username }, recoveryCode: recoveryCode });
    } catch (err) {
      next(err);
    }
  });

  // 복구 코드 새로 받기 (로그인 상태 + 현재 비밀번호 확인): { password }
  router.post("/recovery-code", limiter, requireLogin, async (req, res, next) => {
    try {
      const user = await db.users.findOne({ _id: req.session.userId });
      if (!user || !(await bcrypt.compare(String(req.body.password || ""), user.passwordHash))) {
        return res.status(401).json({ error: "비밀번호가 맞지 않습니다." });
      }
      const recoveryCode = newRecoveryCode();
      await db.users.updateOne({ _id: user._id }, { $set: { recoveryHash: await hashRecoveryCode(recoveryCode) } });
      res.json({ recoveryCode: recoveryCode }); // 예전 코드는 더 이상 쓸 수 없음
    } catch (err) {
      next(err);
    }
  });

  // 닉네임 바꾸기: { nickname } (1~12글자)
  router.put("/nickname", requireLogin, async (req, res, next) => {
    try {
      const nickname = cleanNickname(req.body.nickname);
      const nicknameError = checkNickname(nickname);
      if (nicknameError) return res.status(400).json({ error: nicknameError });
      await db.users.updateOne({ _id: req.session.userId }, { $set: { nickname: nickname } });
      res.json({ nickname: nickname });
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
