// [임시] scripts/geocode/page.html을 브라우저로 열어 건물 좌표 검색 결과를 data/debug.json에 저장
import fs from "node:fs";
import { chromium } from "playwright";

const targets = JSON.parse(fs.readFileSync("scripts/geocode/targets.json", "utf-8"));
const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on("console", (m) => logs.push(m.text()));
page.on("pageerror", (e) => logs.push("ERR " + e.message));
await page.goto("http://127.0.0.1:5500/scripts/geocode/page.html");
await page.waitForFunction(() => window.kakao && window.runGeocode, null, { timeout: 30000 });
const results = await page.evaluate((t) => window.runGeocode(t), targets);
fs.writeFileSync("data/debug.json", JSON.stringify({ logs, results }, null, 1));
await browser.close();
