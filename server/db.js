// MongoDB 연결: 접속 주소는 코드에 넣지 않고 환경 변수 MONGODB_URI로 받는다
import { MongoClient } from "mongodb";

export async function connectDb(uri) {
  const client = new MongoClient(uri);
  await client.connect();
  const database = client.db(); // 접속 주소에 적은 DB 이름 (campus-guide)

  const db = {
    client: client,
    users: database.collection("users"), // { _id, username, passwordHash, createdAt }
    timetables: database.collection("timetables"), // { userId, courseIds, updatedAt }
    reviews: database.collection("reviews"), // { target, userId, rating, text, createdAt, updatedAt }
    friendships: database.collection("friendships"), // { pair, from, to, status, ... }
  };

  // 같은 아이디로 두 번 가입하거나, 한 사람의 시간표가 두 개 생기지 않도록
  await db.users.createIndex({ username: 1 }, { unique: true });
  await db.timetables.createIndex({ userId: 1 }, { unique: true });
  // 두 사람 사이의 친구 관계(신청 포함)는 하나만, 보낸·받은 신청을 빨리 찾도록
  await db.friendships.createIndex({ pair: 1 }, { unique: true });
  await db.friendships.createIndex({ from: 1 });
  await db.friendships.createIndex({ to: 1 });
  // 한 사람은 한 대상에 한줄평 하나
  await db.reviews.createIndex({ target: 1, userId: 1 }, { unique: true });
  return db;
}
