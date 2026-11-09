// [임시] 캠퍼스맵 페이지 구조 확인용. 건물 데이터 작성 후 삭제한다.
import fs from "node:fs";

const out = {};
try {
  const res = await fetch("https://www.seoultech.ac.kr/site/www/intro/map/map_ajax.jsp", {
    method: "POST",
    headers: { "User-Agent": "Mozilla/5.0 (campus-guide student project)", "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest" },
    body: new URLSearchParams({ building: "건물별" }),
    signal: AbortSignal.timeout(20000),
  });
  out.status = res.status;
  out.html = (await res.text()).replace(/\s+/g, " ");
} catch (err) {
  out.error = `${err.message} ${err.cause ? err.cause.code || err.cause.message : ""}`;
}
fs.writeFileSync("data/debug.json", JSON.stringify(out, null, 2));
