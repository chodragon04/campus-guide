# 과기대 캠퍼스 가이드

서울과학기술대학교 학생과 방문자를 위한 캠퍼스 안내 웹사이트입니다. (2026-2 웹프로그래밍 프로젝트)

- 홈페이지: https://chodragon04.github.io/campus-guide/

## 페이지

| 페이지 | 기능 |
| --- | --- |
| `index.html` | 오늘 날짜, 오늘의 학식 요약, 메뉴 바로가기 |
| `map.html` | 카카오 지도 건물 마커, 정보 모달, 내 위치 표시 |
| `buildings.html` | 건물·시설 목록, 검색, 카테고리 필터 |
| `food.html` | 식당별 주간 메뉴, 요일 탭 |
| `timetable.html` | 내 시간표 추가·삭제, localStorage 저장 |

## 사용 기술

HTML, CSS, JavaScript(DOM, 이벤트), 카카오 지도 API, Geolocation API, localStorage, fetch(JSON), GitHub Pages

## 학식 자동 수집

`scripts/crawl-food.js`가 학교 홈페이지와 서울테크노파크 게시판에서 이번 주(월~금) 식단을 가져와 `data/food.json`에 저장합니다. GitHub Actions(`.github/workflows/crawl-food.yml`)가 평일 06:00, 11:00(한국 시간)에 실행하고, 바뀐 내용이 있으면 자동으로 커밋합니다. 브라우저에서 학교 사이트를 직접 불러오면 CORS로 막히기 때문에 이 방식을 사용합니다.

- 식당 추가: `scripts/crawl-food.js`의 `CAFETERIAS` 배열에 학식 페이지의 `location_code`를 한 줄 추가
- 수동 실행: GitHub 저장소의 Actions 탭 → "학식 크롤링" → Run workflow

> 크롤링 방식은 과기대 디스코드 봇의 `menucrawler.py`(Python)를 참고해 JavaScript로 옮기고 수정했습니다.

## 폴더 구조

```
css/     공통·페이지별 스타일
js/      공통·페이지별 스크립트
data/    건물, 학식 JSON 데이터
scripts/ 학식 크롤러 (Node.js)
.github/ GitHub Actions 설정
images/  이미지
```

## AI 활용 기록

| 날짜 | 활용 내용 |
| --- | --- |
| 2026-11-02 | 프로젝트 폴더 구조와 빈 페이지 템플릿 생성 |
| 2026-11-02 | 카카오 지도 SDK 연결, 학교 중심 지도 표시 |
| 2026-11-02 | 학식 크롤러를 Python에서 JavaScript로 변환, GitHub Actions 자동 수집, 학식 페이지·홈 요약 구현 |
