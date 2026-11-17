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

// ---------- 로그인 상태와 내 시간표 ----------

// JSON으로 보내고 JSON으로 받기 (회원·시간표 API용)
function sendJson(method, url, body) {
  return fetch(url, {
    method: method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  }).then((res) =>
    res
      .json()
      .catch(() => ({}))
      .then((data) => ({ ok: res.ok, status: res.status, data: data }))
  );
}

let mePromise = null;

// 지금 로그인한 사람: { accounts, user }
// accounts가 false면 회원 기능이 없는 곳(GitHub Pages, DB 미연결)
function getMe() {
  if (!mePromise) {
    mePromise = fetch("api/auth/me")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .catch(() => ({ accounts: false, user: null }));
  }
  return mePromise;
}

// 헤더 오른쪽에 "로그인" 또는 "아이디 · 로그아웃" 표시
function setupAuthMenu() {
  getMe().then((me) => {
    if (!me.accounts) return;
    const box = make("div", "auth-menu");
    if (me.user) {
      // 친구 페이지 링크 (받은 친구 신청이 있으면 숫자 표시)
      const friends = make("a", "auth-friends", "친구");
      friends.href = "friends.html";
      if (currentPage === "friends") friends.classList.add("current");
      if (me.user.friendRequests > 0) friends.appendChild(make("span", "badge", String(me.user.friendRequests)));
      box.appendChild(friends);
      // 아이디를 누르면 계정 설정(비밀번호 변경)
      const account = make("a", "auth-user", me.user.username);
      account.href = "settings.html";
      account.title = "계정 설정";
      if (currentPage === "settings") account.classList.add("current");
      box.appendChild(account);
      const logout = make("button", "auth-button", "로그아웃");
      logout.addEventListener("click", () => {
        sendJson("POST", "api/auth/logout").then(() => location.reload());
      });
      box.appendChild(logout);
    } else if (currentPage !== "login") {
      const login = make("a", "auth-button", "로그인");
      // 로그인 후 지금 보던 페이지로 돌아오도록
      const here = location.pathname.split("/").pop() || "index.html";
      login.href = `login.html?next=${encodeURIComponent(here + location.search)}`;
      box.appendChild(login);
    }
    document.querySelector("#site-header").appendChild(box);
  });
}

setupAuthMenu();

// 로그인 상태가 바뀌었을 때(가입·복구 직후) 헤더를 다시 그린다
function refreshAuthMenu() {
  mePromise = null;
  const old = document.querySelector(".auth-menu");
  if (old) old.remove();
  setupAuthMenu();
}

// 내 시간표: 로그인했으면 서버(DB)에, 아니면 이 브라우저(localStorage)에 저장
const LOCAL_TIMETABLE_KEY = "campus-guide-timetable";

function loadLocalCourses() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_TIMETABLE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveLocalCourses(courses) {
  try {
    if (courses.length === 0) localStorage.removeItem(LOCAL_TIMETABLE_KEY);
    else localStorage.setItem(LOCAL_TIMETABLE_KEY, JSON.stringify(courses));
  } catch {
    // 저장소를 쓸 수 없는 브라우저(일부 시크릿 창)는 이번 방문 동안만 유지
  }
}

// { courses, where: "server" | "local" }
function loadMyCourses() {
  return getMe().then((me) => {
    if (!me.user) return { courses: loadLocalCourses(), where: "local" };
    return fetch("api/timetable")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => ({ courses: data.courses, where: "server" }));
  });
}

// 함께 듣는 친구: 강좌 ID → 그 강좌를 같이 듣는 친구 아이디 목록 (로그인하지 않았으면 빈 Map)
function loadClassmates() {
  return getMe().then((me) => {
    const classmates = new Map();
    if (!me.user) return classmates;
    return fetch("api/friends")
      .then((res) => (res.ok ? res.json() : { friends: [] }))
      .then((data) => {
        for (let friend of data.friends) {
          for (let id of friend.sharedCourseIds) {
            if (!classmates.has(id)) classmates.set(id, []);
            classmates.get(id).push(friend.username);
          }
        }
        return classmates;
      })
      .catch(() => classmates);
  });
}

// 복구 코드 안내 상자: 코드는 이때 한 번만 보여 주므로 저장했다고 체크해야 다음으로 넘어간다
function makeRecoveryCodeBox(code, doneText, onDone) {
  const box = make("section", "recovery-box");
  box.appendChild(make("h2", "", "복구 코드"));
  box.appendChild(
    make("p", "", "비밀번호를 잊었을 때 이 코드로 재설정할 수 있어요. 다시 보여 드릴 수 없으니 캡처하거나 안전한 곳에 적어 두세요.")
  );
  box.appendChild(make("p", "recovery-code", code));

  const copy = make("button", "recovery-copy", "코드 복사");
  copy.type = "button";
  copy.addEventListener("click", () => {
    navigator.clipboard.writeText(code).then(() => (copy.innerText = "복사했습니다"));
  });
  box.appendChild(copy);

  const label = make("label", "recovery-check");
  const check = make("input");
  check.type = "checkbox";
  label.appendChild(check);
  label.appendChild(document.createTextNode(" 복구 코드를 저장했습니다"));
  box.appendChild(label);

  const done = make("button", "recovery-done", doneText);
  done.type = "button";
  done.disabled = true;
  check.addEventListener("change", () => (done.disabled = !check.checked));
  done.addEventListener("click", onDone);
  box.appendChild(done);
  return box;
}
