// 데이터 파일(data/*.json) 읽기: GitHub Actions가 갱신해 커밋하므로 파일이 바뀌었을 때만 다시 읽는다
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), ".."); // 저장소 최상위

const cache = {};

export function readData(name) {
  const file = path.join(ROOT, "data", name);
  const modified = fs.statSync(file).mtimeMs;
  if (!cache[name] || cache[name].modified !== modified) {
    cache[name] = { modified: modified, data: JSON.parse(fs.readFileSync(file, "utf-8")) };
  }
  return cache[name].data;
}

// 강좌 ID → 강좌 (시간표 저장 때 ID가 실제 강좌인지 확인하고, 불러올 때 강좌 정보로 바꾸는 데 사용)
export function courseMap() {
  const data = readData("courses.json");
  if (!cache.courseMap || cache.courseMap.source !== data) {
    cache.courseMap = { source: data, map: new Map(data.courses.map((c) => [c.id, c])) };
  }
  return cache.courseMap.map;
}
