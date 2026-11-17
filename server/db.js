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
    reviews: database.collection("reviews"),
  };

  // 같은 아이디로 두 번 가입하거나, 한 사람의 시간표가 두 개 생기지 않도록
  await db.users.createIndex({ username: 1 }, { unique: true });
  await db.timetables.createIndex({ userId: 1 }, { unique: true });
  return db;
}
