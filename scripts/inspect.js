// [임시] 학교 식단(노션 페이지) 구조 확인용. 파서 작성 후 삭제한다.
import fs from "node:fs";

const PAGE_ID = "21e45244-ac0a-80fd-b02a-d064ce75d674";
const out = {};

async function post(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (campus-guide student project)" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  return { status: res.status, text };
}

function summarize(json) {
  const blocks = json.recordMap?.block || {};
  return Object.entries(blocks).map(([id, b]) => {
    const v = b.value?.value || b.value || {};
    const title = (v.properties?.title || []).map((t) => t[0]).join("");
    return { id, type: v.type, title: title.slice(0, 300), parent: v.parent_id, children: (v.content || []).length, props: Object.keys(v.properties || {}), source: v.properties?.source?.[0]?.[0], format: v.format ? JSON.stringify(v.format).slice(0, 300) : undefined, collection: v.collection_id, views: v.view_ids };
  });
}

for (const host of ["https://fern-magic-bde.notion.site", "https://www.notion.so"]) {
  try {
    const r = await post(`${host}/api/v3/loadPageChunk`, { pageId: PAGE_ID, limit: 100, cursor: { stack: [] }, chunkNumber: 0, verticalColumns: false });
    out[host] = { status: r.status };
    try {
      const json = JSON.parse(r.text);
      out[host].blocks = summarize(json);
      out[host].collections = Object.entries(json.recordMap?.collection || {}).map(([id, c]) => ({ id, schema: JSON.stringify((c.value?.value || c.value)?.schema || {}).slice(0, 2000) }));
    } catch {
      out[host].text = r.text.slice(0, 1000);
    }
    if (out[host].blocks) break;
  } catch (err) {
    out[host] = { error: `${err.message} ${err.cause ? err.cause.code || err.cause.message : ""}` };
  }
}
fs.writeFileSync("data/debug.json", JSON.stringify(out, null, 2));
