# 과기대 캠퍼스 가이드

서울과학기술대학교 학생과 방문자를 위한 캠퍼스 안내 웹사이트입니다. (2026-2 웹프로그래밍 프로젝트)

- 홈페이지: https://chodragon04.github.io/campus-guide/

## 페이지

| 페이지 | 기능 |
| --- | --- |
| `index.html` | 오늘 날짜, 오늘의 학식 요약, 메뉴 바로가기 |
| `map.html` | 카카오 지도 건물 마커, 정보 모달, 내 위치 표시 |
| `buildings.html` | 건물·시설 목록, 검색, 카테고리 필터 |
| `food.html` | 생활관 요일별 식단(월~일), 학생식당 브랜드별 메뉴판, 테크노파크 주간 식단 |
| `timetable.html` | 내 시간표 추가·삭제, localStorage 저장 |

## 사용 기술

HTML, CSS, JavaScript(DOM, 이벤트), 카카오 지도 API, Geolocation API, localStorage, fetch(JSON), GitHub Pages

## 학식 자동 수집

`scripts/crawl-food.js`가 아래 세 곳에서 식단을 모아 `data/food.json`에 저장합니다. GitHub Actions(`.github/workflows/crawl-food.yml`)가 매일 06:00(한국 시간)에 한 번 실행하고, 바뀐 내용이 있으면 자동으로 커밋합니다. 브라우저에서 학교 사이트를 직접 불러오면 CORS로 막히기 때문에 이 방식을 사용합니다.

| 식당 | 출처 | 수집 방법 |
| --- | --- | --- |
| 생활관 KB학사·성림학사·수림학사 | 생활관 홈페이지 식당이용안내 | 주간 식단 표(`table.chang`)에서 날짜별 조식·중식·석식 추출 |
| 학생식당 ST:Table, ST:Dining | 학교 홈페이지 식단 메뉴가 연결한 노션 메뉴판 | 노션 공개 페이지 API로 브랜드·메뉴·가격 데이터베이스 조회 |
| 서울테크노파크 | 테크노파크 식단 게시판 | 최신 게시글의 주간 식단 이미지 주소 |

- 생활관 추가: `DORMS` 배열에 식당이용안내 탭 주소의 `foodtype` 값을 한 줄 추가
- 한 식당이 실패해도 나머지는 계속 수집하고, 실패한 식당은 지난번 데이터를 유지
- 수동 실행: GitHub 저장소의 Actions 탭 → "학식 크롤링" → Run workflow

> 크롤링 방식은 과기대 디스코드 봇의 `menucrawler.py`(Python)를 참고해 JavaScript로 옮기면서 시작했습니다. 원본이 쓰던 학교 학식 페이지는 사이트 개편으로 없어져서, 현재 학교가 안내하는 식단 출처를 새로 분석해 다시 작성했습니다.

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
| 2026-11-02 | 바뀐 학교 식단 출처(생활관 표, 노션 메뉴판) 분석, 크롤러 재작성, 학식 페이지를 생활관·학생식당·테크노파크로 개편 |
