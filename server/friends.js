// 친구: 아이디로 신청하고, 상대가 수락하면 친구가 된다
//  - friendships 컬렉션: { _id, pair, from, to, fromName, toName, status: "pending" | "accepted", createdAt, acceptedAt }
//  - pair는 두 사람의 ID를 정렬해 이은 값이라, 누가 먼저 신청했든 두 사람 사이에는 하나만 생긴다
//  - 친구에게도 시간표 전체는 보여 주지 않고, 나와 같은 강좌(과목+분반)만 알려 준다
import crypto from "node:crypto";
import express from "express";
import { rateLimit } from "express-rate-limit";
import { requireLogin } from "./auth.js";

const MAX_FRIENDS = 100;
const MAX_PENDING = 50; // 보낸 신청을 쌓아 둘 수 있는 최대 개수

function pairOf(a, b) {
  return [a, b].sort().join("|");
}

export function friendsRouter(db) {
  const router = express.Router();

  router.use((req, res, next) => {
    if (!db) return res.status(503).json({ error: "친구 기능을 사용할 수 없습니다. (DB 미연결)" });
    next();
  });
  router.use(requireLogin);

  // 친구 신청은 아이디가 있는지 알아보는 데 쓰일 수 있어서 횟수를 제한
  const requestLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "친구 신청을 너무 많이 보냈습니다. 잠시 후 다시 시도하세요." },
  });

  // 나와 관련된 친구 관계 전부 (내가 보낸 것 + 받은 것)
  async function myLinks(userId) {
    const sent = await db.friendships.find({ from: userId }).toArray();
    const received = await db.friendships.find({ to: userId }).toArray();
    return sent.concat(received);
  }

  async function myCourseIds(userId) {
    const doc = await db.timetables.findOne({ userId: userId });
    return doc ? doc.courseIds : [];
  }

  // 친구 목록, 받은 신청, 보낸 신청 + 친구마다 나와 함께 듣는 강좌 ID
  router.get("/", async (req, res, next) => {
    try {
      const me = req.session.userId;
      const links = await myLinks(me);
      const mine = new Set(await myCourseIds(me));

      const friends = [];
      const incoming = [];
      const outgoing = [];
      for (let link of links) {
        const iSent = link.from === me;
        const otherId = iSent ? link.to : link.from;
        const otherName = iSent ? link.toName : link.fromName;

        if (link.status === "accepted") {
          const theirs = await myCourseIds(otherId);
          friends.push({
            username: otherName,
            since: link.acceptedAt,
            sharedCourseIds: theirs.filter((id) => mine.has(id)), // 겹치는 강좌만
          });
        } else if (iSent) {
          outgoing.push({ id: link._id, username: otherName, createdAt: link.createdAt });
        } else {
          incoming.push({ id: link._id, username: otherName, createdAt: link.createdAt });
        }
      }
      friends.sort((a, b) => a.username.localeCompare(b.username));
      res.json({ friends: friends, incoming: incoming, outgoing: outgoing });
    } catch (err) {
      next(err);
    }
  });

  // 친구 신청: { username }
  router.post("/requests", requestLimiter, async (req, res, next) => {
    try {
      const me = req.session.userId;
      const username = String(req.body.username || "").trim().toLowerCase();
      if (username === req.session.username) {
        return res.status(400).json({ error: "자기 자신에게는 신청할 수 없습니다." });
      }
      const target = await db.users.findOne({ username: username });
      if (!target) return res.status(404).json({ error: "그런 아이디가 없습니다." });

      const existing = await db.friendships.findOne({ pair: pairOf(me, target._id) });
      if (existing) {
        if (existing.status === "accepted") return res.status(409).json({ error: "이미 친구입니다." });
        if (existing.from === me) return res.status(409).json({ error: "이미 신청했습니다. 상대가 수락하기를 기다려 주세요." });
        // 상대가 먼저 나에게 신청해 둔 경우: 바로 친구가 된다
        await db.friendships.updateOne({ _id: existing._id }, { $set: { status: "accepted", acceptedAt: new Date() } });
        return res.json({ result: "accepted", username: target.username });
      }

      const links = await myLinks(me);
      if (links.filter((l) => l.status === "accepted").length >= MAX_FRIENDS) {
        return res.status(400).json({ error: `친구는 ${MAX_FRIENDS}명까지 등록할 수 있습니다.` });
      }
      if (links.filter((l) => l.status === "pending" && l.from === me).length >= MAX_PENDING) {
        return res.status(400).json({ error: "대기 중인 신청이 너무 많습니다. 보낸 신청을 정리해 주세요." });
      }

      try {
        await db.friendships.insertOne({
          _id: crypto.randomUUID(),
          pair: pairOf(me, target._id),
          from: me,
          to: target._id,
          fromName: req.session.username,
          toName: target.username,
          status: "pending",
          createdAt: new Date(),
        });
      } catch (err) {
        if (err.code === 11000) return res.status(409).json({ error: "이미 신청했거나 친구입니다." });
        throw err;
      }
      res.status(201).json({ result: "requested", username: target.username });
    } catch (err) {
      next(err);
    }
  });

  // 받은 신청 수락: 신청을 받은 사람만 할 수 있다
  router.post("/requests/:id/accept", async (req, res, next) => {
    try {
      const link = await db.friendships.findOne({ _id: req.params.id });
      if (!link || link.to !== req.session.userId || link.status !== "pending") {
        return res.status(404).json({ error: "신청을 찾을 수 없습니다." });
      }
      await db.friendships.updateOne({ _id: link._id }, { $set: { status: "accepted", acceptedAt: new Date() } });
      res.json({ result: "accepted", username: link.fromName });
    } catch (err) {
      next(err);
    }
  });

  // 신청 거절(받은 사람) 또는 취소(보낸 사람)
  router.delete("/requests/:id", async (req, res, next) => {
    try {
      const me = req.session.userId;
      const link = await db.friendships.findOne({ _id: req.params.id });
      if (!link || link.status !== "pending" || (link.from !== me && link.to !== me)) {
        return res.status(404).json({ error: "신청을 찾을 수 없습니다." });
      }
      await db.friendships.deleteOne({ _id: link._id });
      res.json({ result: "deleted" });
    } catch (err) {
      next(err);
    }
  });

  // 친구 삭제
  router.delete("/:username", async (req, res, next) => {
    try {
      const target = await db.users.findOne({ username: String(req.params.username).toLowerCase() });
      const link = target ? await db.friendships.findOne({ pair: pairOf(req.session.userId, target._id) }) : null;
      if (!link || link.status !== "accepted") return res.status(404).json({ error: "친구가 아닙니다." });
      await db.friendships.deleteOne({ _id: link._id });
      res.json({ result: "deleted" });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
