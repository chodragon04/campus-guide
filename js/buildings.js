// buildings.html: 건물·시설 목록, 검색, 종류·편의시설 필터
// data/buildings.json의 건물 정보를 카드로 보여준다

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

const searchInput = document.querySelector("#search");
const categoryButtons = document.querySelectorAll("#category-filters button");
const facilityButtons = document.querySelectorAll("#facility-filters button");
const list = document.querySelector("#building-list");
const resultCount = document.querySelector("#result-count");

let buildings = [];
let categoryNames = {};
let selectedCategory = "all";
let selectedFacility = null; // null이면 편의시설 조건 없음

function make(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.innerText = text;
  return el;
}

// ---------- 카드 만들기 ----------

function makeCard(building) {
  const li = make("li", "building-card");

  const head = make("div", "card-head");
  head.appendChild(make("span", "no", String(building.no)));
  head.appendChild(make("h2", "", building.name));
  head.appendChild(make("span", `tag cat-${building.category}`, categoryNames[building.category]));
  li.appendChild(head);

  if (building.floors) li.appendChild(make("p", "floors", building.floors));

  // 편의시설 태그 (종류는 테두리 색으로 구분)
  if (building.facilities) {
    const ul = make("ul", "facilities");
    for (let facility of building.facilities) {
      ul.appendChild(make("li", `fac fac-${facility.type}`, facility.name));
    }
    li.appendChild(ul);
  }

  // 입주 대학·부서는 길어서 접어 둔다
  const members = (building.colleges || []).concat(building.offices || []);
  if (members.length > 0) {
    const details = make("details", "members");
    details.appendChild(make("summary", "", `입주 대학·부서 (${members.length})`));
    details.appendChild(make("p", "", members.join(", ")));
    li.appendChild(details);
  }

  const link = make("a", "map-link", "지도에서 보기 →");
  link.href = `map.html?b=${building.id}`;
  li.appendChild(link);
  return li;
}

// ---------- 검색·필터 ----------

// 건물 하나에서 검색할 글자들을 한 줄로 모으기
function searchText(building) {
  const words = [building.name, String(building.no)];
  words.push(...(building.aliases || []));
  words.push(...(building.colleges || []));
  words.push(...(building.offices || []));
  for (let facility of building.facilities || []) {
    words.push(facility.name, FACILITY_LABELS[facility.type]);
  }
  return words.join(" ").toLowerCase();
}

function matches(building) {
  if (selectedCategory !== "all" && building.category !== selectedCategory) return false;
  if (selectedFacility && !(building.facilities || []).some((f) => f.type === selectedFacility)) return false;
  const keyword = searchInput.value.trim().toLowerCase();
  if (keyword !== "" && !searchText(building).includes(keyword)) return false;
  return true;
}

function render() {
  list.innerHTML = "";
  const found = buildings.filter(matches);
  for (let building of found) list.appendChild(makeCard(building));
  resultCount.innerText = `${found.length}곳`;
  if (found.length === 0) list.appendChild(make("li", "notice", "조건에 맞는 건물이 없습니다."));
}

searchInput.addEventListener("input", render);

for (let button of categoryButtons) {
  button.addEventListener("click", function () {
    selectedCategory = this.dataset.category;
    for (let b of categoryButtons) b.classList.toggle("active", b === this);
    render();
  });
}

// 편의시설 버튼은 한 번 더 누르면 해제
for (let button of facilityButtons) {
  button.addEventListener("click", function () {
    selectedFacility = selectedFacility === this.dataset.facility ? null : this.dataset.facility;
    for (let b of facilityButtons) b.classList.toggle("active", b.dataset.facility === selectedFacility);
    render();
  });
}

// ---------- 데이터 불러오기 ----------

fetch("data/buildings.json")
  .then((res) => res.json())
  .then((data) => {
    buildings = data.buildings;
    categoryNames = data.categories;
    render();
  })
  .catch(() => {
    resultCount.innerText = "건물 정보를 불러오지 못했습니다.";
  });
