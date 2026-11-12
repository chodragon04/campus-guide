// 모든 페이지 공통 스크립트

// 현재 페이지 메뉴 강조
const currentPage = document.body.dataset.page;
const menuLinks = document.querySelectorAll("#menu a");
for (let link of menuLinks) {
  if (link.dataset.key === currentPage) {
    link.classList.add("current");
  }
}

// 교시 → 시각: 1교시 9:00~10:00, 2교시 10:00~11:00 ... (한 교시 = 한 시간)
function periodStart(period) {
  return `${8 + period}:00`;
}

function periodEnd(period) {
  return `${9 + period}:00`;
}

// { start: 1, end: 4 } → "9:00~13:00"
function slotTime(slot) {
  return `${periodStart(slot.start)}~${periodEnd(slot.end)}`;
}

// 과목의 모든 수업 시간 → "화 9:00~13:00, 목 11:00~12:00"
function courseTime(course) {
  if (!course.slots || course.slots.length === 0) return "시간 미정";
  return course.slots.map((slot) => `${slot.day} ${slotTime(slot)}`).join(", ");
}

// 태그 하나 만들기 (글자는 innerText로 넣어 데이터가 HTML로 해석되지 않게 한다)
function make(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.innerText = text;
  return el;
}

// ---------- 건물 정보 (건물·시설 페이지 카드와 지도 정보 창에서 같이 사용) ----------

const FACILITY_LABELS = {
  cafe: "카페",
  food: "식당",
  store: "매점",
  atm: "ATM",
  print: "증명서·복사",
  bank: "은행·우체국",
  health: "보건",
  etc: "기타",
};

// 번호·이름·종류, 층, 편의시설 태그, 입주 대학·부서(접기)를 담은 요소
function makeBuildingInfo(building, categoryNames) {
  const box = make("div", "building-info");

  const head = make("div", "card-head");
  head.appendChild(make("span", "no", String(building.no)));
  head.appendChild(make("h2", "", building.name));
  head.appendChild(make("span", `tag cat-${building.category}`, categoryNames[building.category]));
  box.appendChild(head);

  if (building.floors) box.appendChild(make("p", "floors", building.floors));

  // 편의시설 태그 (종류는 테두리 색으로 구분)
  if (building.facilities) {
    const ul = make("ul", "facilities");
    for (let facility of building.facilities) {
      ul.appendChild(make("li", `fac fac-${facility.type}`, facility.name));
    }
    box.appendChild(ul);
  }

  // 입주 대학·부서는 길어서 접어 둔다
  const members = (building.colleges || []).concat(building.offices || []);
  if (members.length > 0) {
    const details = make("details", "members");
    details.appendChild(make("summary", "", `입주 대학·부서 (${members.length})`));
    details.appendChild(make("p", "", members.join(", ")));
    box.appendChild(details);
  }
  return box;
}

// ---------- 서버 API (서버가 없으면 정적 JSON 파일로 대신) ----------

// Render 서버에서는 api/... 가 응답하고, GitHub Pages처럼 파일만 있는 곳에서는 404가 난다.
// 그때는 같은 내용을 담은 data/*.json 파일을 대신 불러온다.
function fetchJson(apiUrl, fallbackUrl) {
  return fetch(apiUrl)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .catch(() => fetch(fallbackUrl).then((res) => res.json()));
}

// ---------- 강의실 → 건물 연결 ----------

let buildingsPromise = null;

// 건물 목록은 한 번만 불러와서 재사용
function loadBuildings() {
  if (!buildingsPromise) {
    buildingsPromise = fetch("data/buildings.json")
      .then((res) => res.json())
      .then((data) => data.buildings)
      .catch(() => []);
  }
  return buildingsPromise;
}

// "미래관-320" → 미래관 건물. 이름이나 다른 이름(aliases)이 "이름-"으로 시작하는 건물을 찾는다
function findBuildingByRoom(buildings, room) {
  let found = null;
  let foundLength = 0;
  for (let building of buildings) {
    for (let name of [building.name].concat(building.aliases || [])) {
      // 더 긴 이름을 우선 ("중앙도서관 별관-103"이 "중앙도서관"보다 "중앙도서관 별관"에 맞도록)
      if (room.startsWith(name + "-") && name.length > foundLength) {
        found = building;
        foundLength = name.length;
      }
    }
  }
  return found;
}

// "미래관-320, 다산관-101" → 강의실마다 지도 링크(map.html?b=건물ID)를 붙인 요소
function makeRoomLinks(roomText, buildings) {
  const span = make("span", "rooms");
  if (!roomText) {
    span.innerText = "강의실 미정";
    return span;
  }
  // 강의실 사이 구분자는 ", " (건물 이름 안에는 쉼표가 없다)
  roomText.split(", ").forEach((room, index) => {
    if (index > 0) span.appendChild(document.createTextNode(", "));
    const building = findBuildingByRoom(buildings, room);
    if (building) {
      const a = make("a", "room-link", room);
      a.href = `map.html?b=${building.id}`;
      a.title = `${building.name} 위치 보기`;
      span.appendChild(a);
    } else {
      span.appendChild(document.createTextNode(room));
    }
  });
  return span;
}
