// food.html: 학식 정보 (data/food.json은 GitHub Actions가 매일 갱신)
//  - 생활관 식당(type "daily"): 요일 탭을 눌러 그날의 조식/중식/석식 보기
//  - 학생식당(type "fixed"): 브랜드별 고정 메뉴판
//  - 테크노파크(type "weekly-image"): 주간 식단 이미지

const tabs = document.querySelectorAll("#day-tabs button");
const dormList = document.querySelector("#dorm-list");
const fixedList = document.querySelector("#fixed-list");
const weeklyList = document.querySelector("#weekly-list");
let foodData = null;

// 식당 ID → 건물 ID (지도에서 위치 보기 링크용). 위치를 확인한 식당만 적는다
const CAFETERIA_BUILDINGS = {
  technopark: "007", // 서울테크노파크 (캠퍼스맵 편의시설: 7번 건물 식당)
};

function makeCard(cafeteria) {
  const card = make("section", "food-card");
  const title = make("h3", "", cafeteria.name);
  const buildingId = CAFETERIA_BUILDINGS[cafeteria.id];
  if (buildingId) {
    const link = make("a", "place-link", "위치 보기");
    link.href = `map.html?b=${buildingId}`;
    title.appendChild(link);
  }
  card.appendChild(title);
  return card;
}

// ---------- 생활관 식당 ----------

function makeDormCard(cafeteria, date) {
  const card = makeCard(cafeteria);
  const day = cafeteria.days[date];
  if (!day) {
    card.appendChild(make("p", "notice", "등록된 식단이 없습니다."));
    return card;
  }
  for (let meal of day.meals) {
    const box = make("div", "meal");
    box.appendChild(make("h4", "", meal.name));
    box.appendChild(make("p", "", meal.items.join(", ")));
    card.appendChild(box);
  }
  return card;
}

// 선택한 요일(1 월 ~ 7 일)의 생활관 식단 보여주기
function showDay(dayNumber) {
  for (let tab of tabs) {
    tab.classList.toggle("active", tab.dataset.day === String(dayNumber));
  }
  const date = foodData.week[dayNumber - 1];
  dormList.innerHTML = "";
  for (let cafeteria of foodData.cafeterias) {
    if (cafeteria.type === "daily") dormList.appendChild(makeDormCard(cafeteria, date));
  }
}

for (let tab of tabs) {
  tab.addEventListener("click", function () {
    showDay(Number(this.dataset.day));
  });
}

// ---------- 학생식당 ----------

function makeFixedCard(cafeteria) {
  const card = makeCard(cafeteria);
  if (!cafeteria.brands) {
    card.appendChild(make("p", "notice", "메뉴판을 가져오지 못했습니다."));
    return card;
  }
  for (let brand of cafeteria.brands) {
    const details = make("details", "brand");
    details.appendChild(make("summary", "", `${brand.brand} (${brand.menus.length})`));
    const ul = make("ul");
    for (let menu of brand.menus) {
      const li = make("li", "", menu.name);
      if (menu.price) li.appendChild(make("span", "price", `${menu.price.toLocaleString()}원`));
      ul.appendChild(li);
    }
    details.appendChild(ul);
    card.appendChild(details);
  }
  return card;
}

// ---------- 테크노파크 ----------

function makeWeeklyCard(cafeteria) {
  const card = makeCard(cafeteria);
  if (!cafeteria.imageUrl) {
    card.appendChild(make("p", "notice", "식단 정보를 가져오지 못했습니다."));
    return card;
  }
  card.appendChild(make("p", "", `${cafeteria.title} (${cafeteria.uploaded})`));
  const a = make("a");
  a.href = cafeteria.link;
  a.target = "_blank";
  const img = make("img");
  img.src = cafeteria.imageUrl;
  img.alt = cafeteria.title;
  a.appendChild(img);
  card.appendChild(a);
  return card;
}

// ---------- 데이터 불러오기 ----------

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

fetch("data/food.json")
  .then((res) => res.json())
  .then((data) => {
    foodData = data;

    // 탭에 날짜 붙이기: "월" → "월 11/2"
    for (let tab of tabs) {
      const date = data.week[Number(tab.dataset.day) - 1];
      tab.innerText += ` ${Number(date.slice(5, 7))}/${Number(date.slice(8))}`;
    }
    const index = data.week.indexOf(todayKey());
    showDay(index === -1 ? 1 : index + 1);

    for (let cafeteria of data.cafeterias) {
      if (cafeteria.type === "fixed") fixedList.appendChild(makeFixedCard(cafeteria));
      if (cafeteria.type === "weekly-image") weeklyList.appendChild(makeWeeklyCard(cafeteria));
    }

    const updated = new Date(data.updatedAt);
    document.querySelector("#updated").innerText = `업데이트: ${updated.toLocaleString("ko-KR")}`;
  })
  .catch(() => {
    dormList.appendChild(make("p", "notice", "학식 데이터를 불러오지 못했습니다."));
  });
