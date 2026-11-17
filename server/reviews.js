// 학식 한줄평·별점
//  - 대상(target)은 "식당ID|항목|세부" 형식
//      생활관 식사: "dorm-kb|2026-11-17|중식"  (그 주 식단에 있는 날짜·식사만)
//      학생식당 메뉴: "st-table|바비든든|치킨마요덮밥"  (메뉴판에 있는 메뉴만)
//  - 한 사람은 한 대상에 한줄평 하나 (다시 쓰면 수정)
//  - 누구나 볼 수 있고, 쓰기·지우기는 로그인한 사람만
//  - 작성자는 닉네임으로만 보여 준다 (아이디는 공개하지 않음)
import crypto from "node:crypto";
import express from "express";
import { rateLimit } from "express-rate-limit";
import { requireLogin, cleanNickname } from "./auth.js";
import { readData } from "./data.js";

const TEXT_MAX = 100;
const LIST_MAX = 50;

// 대상이 실제 식단·메뉴에 있는지 확인
function isValidTarget(target) {
  const parts = String(target || "").split("|");
  if (parts.length !== 3) return false;
  const [cafeteriaId, a, b] = parts;
  const cafeteria = readData("food.json").cafeterias.find((c) => c.id === cafeteriaId);
  if (!cafeteria) return false;

  if (cafeteria.type === "daily") {
    const day = cafeteria.days && cafeteria.days[a];
    return Boolean(day && day.meals && day.meals.some((meal) => meal.name === b));
  }
  if (cafeteria.type === "fixed") {
    const brand = (cafeteria.brands || []).find((x) => x.brand === a);
    return Boolean(brand && brand.menus.some((menu) => menu.name === b));
  }
  return false;
}

function summarize(reviews) {
  if (reviews.length === 0) return { avg: 0, count: 0 };
  const sum = reviews.reduce((total, r) => total + r.rating, 0);
  return { avg: Math.round((sum / reviews.length) * 10) / 10, count: reviews.length };
}

export function reviewsRouter(db) {
  const router = express.Router();

  router.use((req, res, next) => {
    if (!db) return res.status(503).json({ error: "한줄평 기능을 사용할 수 없습니다. (DB 미연결)" });
    next();
  });

  const writeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "한줄평을 너무 자주 남겼습니다. 잠시 후 다시 시도하세요." },
  });

  // 대상별 평균 별점·개수: { "dorm-kb|2026-11-17|중식": { avg: 4.2, count: 3 }, ... }
  router.get("/summary", async (req, res, next) => {
    try {
      // 로그인 없이 누구나 부르는 API라, 한줄평 전체를 서버로 가져오지 않고 DB에서 대상별로 계산한다
      const groups = await db.reviews
        .aggregate([{ $group: { _id: "$target", avg: { $avg: "$rating" }, count: { $sum: 1 } } }])
        .toArray();
      const summary = {};
      for (let g of groups) summary[g._id] = { avg: Math.round(g.avg * 10) / 10, count: g.count };
      res.json(summary);
    } catch (err) {
      next(err);
    }
  });

  // 한 대상의 한줄평 목록 (최신순)
  router.get("/", async (req, res, next) => {
    try {
      const target = String(req.query.target || "");
      if (!isValidTarget(target)) return res.status(404).json({ error: "없는 식단이나 메뉴입니다." });

      const reviews = await db.reviews.find({ target: target }).toArray();
      reviews.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      const me = req.session.userId;
      const list = [];
      for (let review of reviews.slice(0, LIST_MAX)) {
        const writer = await db.users.findOne({ _id: review.userId });
        list.push({
          // 닉네임이 없는 옛 계정이어도 아이디(로그인에 쓰는 값)는 공개하지 않는다
          nickname: writer ? writer.nickname || "이름 없음" : "탈퇴한 사용자",
          rating: review.rating,
          text: review.text,
          updatedAt: review.updatedAt,
          mine: review.userId === me,
        });
      }
      const mine = reviews.find((r) => r.userId === me);
      res.json({
        target: target,
        ...summarize(reviews),
        reviews: list,
        myReview: mine ? { rating: mine.rating, text: mine.text } : null,
      });
    } catch (err) {
      next(err);
    }
  });

  // 한줄평 남기기·고치기: { target, rating: 1~5, text: 100자 이하(없어도 됨) }
  router.put("/", requireLogin, writeLimiter, async (req, res, next) => {
    try {
      const target = String(req.body.target || "");
      const rating = Number(req.body.rating);
      const text = cleanNickname(req.body.text); // 공백 정리·제어 문자 제거 (닉네임과 같은 규칙)

      if (!isValidTarget(target)) return res.status(404).json({ error: "없는 식단이나 메뉴입니다." });
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "별점은 1~5점입니다." });
      }
      if ([...text].length > TEXT_MAX) return res.status(400).json({ error: `한줄평은 ${TEXT_MAX}자까지입니다.` });

      const now = new Date();
      await db.reviews.updateOne(
        { target: target, userId: req.session.userId },
        {
          $set: { rating: rating, text: text, updatedAt: now },
          $setOnInsert: { _id: crypto.randomUUID(), createdAt: now },
        },
        { upsert: true }
      );
      res.json({ result: "saved" });
    } catch (err) {
      next(err);
    }
  });

  // 내 한줄평 지우기: /api/reviews?target=...
  router.delete("/", requireLogin, async (req, res, next) => {
    try {
      const target = String(req.query.target || "");
      const result = await db.reviews.deleteOne({ target: target, userId: req.session.userId });
      if (!result.deletedCount) return res.status(404).json({ error: "남긴 한줄평이 없습니다." });
      res.json({ result: "deleted" });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
