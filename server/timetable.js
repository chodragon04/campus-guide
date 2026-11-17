// 내 시간표 저장: 로그인한 사람마다 강좌 ID 목록만 DB에 저장하고,
// 불러올 때 data/courses.json에서 강좌 정보로 바꿔 보낸다
import express from "express";
import { requireLogin } from "./auth.js";
import { courseMap } from "./data.js";

const MAX_COURSES = 40;

export function timetableRouter(db) {
  const router = express.Router();

  router.use((req, res, next) => {
    if (!db) return res.status(503).json({ error: "시간표 저장을 사용할 수 없습니다. (DB 미연결)" });
    next();
  });
  router.use(requireLogin);

  function toCourses(ids) {
    const map = courseMap();
    return ids.map((id) => map.get(id)).filter(Boolean); // 학기가 바뀌어 없어진 강좌는 빼고
  }

  router.get("/", async (req, res, next) => {
    try {
      const doc = await db.timetables.findOne({ userId: req.session.userId });
      res.json({ courses: toCourses(doc ? doc.courseIds : []), updatedAt: doc ? doc.updatedAt : null });
    } catch (err) {
      next(err);
    }
  });

  // 시간표 전체 저장: { courseIds: ["123456-01", ...] }
  router.put("/", async (req, res, next) => {
    try {
      const ids = req.body.courseIds;
      if (!Array.isArray(ids) || ids.length > MAX_COURSES || !ids.every((id) => typeof id === "string")) {
        return res.status(400).json({ error: `강좌 목록이 올바르지 않습니다. (최대 ${MAX_COURSES}개)` });
      }
      const unique = [...new Set(ids)];
      const map = courseMap();
      if (!unique.every((id) => map.has(id))) {
        return res.status(400).json({ error: "없는 강좌가 포함되어 있습니다." });
      }

      const updatedAt = new Date();
      await db.timetables.updateOne(
        { userId: req.session.userId },
        { $set: { courseIds: unique, updatedAt: updatedAt } },
        { upsert: true }
      );
      res.json({ courses: toCourses(unique), updatedAt: updatedAt });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
