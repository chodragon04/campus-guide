// food.html: 학식 정보 (data/food.json은 GitHub Actions가 매일 갱신)
//  - 생활관 식당(type "daily"): 요일 탭을 눌러 그날의 조식/중식/석식 보기
//  - 학생식당(type "fixed"): 브랜드별 고정 메뉴판
//  - 테크노파크(type "weekly-image"): 주간 식단 이미지
//  - 생활관 식사와 학생식당 메뉴마다 별점·한줄평 (서버가 있는 곳에서만)

const tabs = document.querySelectorAll("#day-tabs button");
const dormList = document.querySelector("#dorm-list");
const fixedList = document.querySelector("#fixed-list");
const weeklyList = document.querySelector("#weekly-list");
let foodData = null;
let reviewSummary = null; // 대상별 { avg, count }. null이면 한줄평 기능을 쓸 수 없는 곳(GitHub Pages)
const reviewChips = new Map(); // 대상 → 그 대상의 별점 버튼들 (한줄평을 남기면 숫자 갱신)

// 식당 ID → 건물 ID (지도에서 위치 보기 링크용)
const CAFETERIA_BUILDINGS = {
  "dorm-kb": "042", // KB학사 식당 (각 학사 건물 안)
  "dorm-sunglim": "043", // 성림학사
  "dorm-surim": "045", // 수림학사
  "st-table": "037", // ST:Table: 학생회관(제1학생회관)
  "st-dining": "052", // ST:Dining: 제2학생회관
  technopark: "007", // 서울테크노파크
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

// 학기 중 평일 식사 시간 (분 단위). 주말은 시간이 달라 표시하지 않는다
const MEAL_HOURS = [
  { name: "조식", start: 7 * 60 + 30, end: 8 * 60 + 50, text: "07:30~08:50" },
  { name: "중식", start: 11 * 60 + 30, end: 13 * 60 + 30, text: "11:30~13:30" },
  { name: "석식", start: 17 * 60 + 30, end: 18 * 60 + 40, text: "17:30~18:40" },
];

// 지금 먹고 있는 식사 또는 다음 식사: { meal, now: true/false } (평일만, 석식 뒤에는 null)
function currentMeal() {
  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) return null;
  const minutes = now.getHours() * 60 + now.getMinutes();
  for (let meal of MEAL_HOURS) {
    if (minutes < meal.start) return { meal: meal, now: false };
    if (minutes <= meal.end) return { meal: meal, now: true };
  }
  return null;
}

function makeDormCard(cafeteria, date) {
  const card = makeCard(cafeteria);
  const day = cafeteria.days[date];
  if (!day) {
    card.appendChild(make("p", "notice", "등록된 식단이 없습니다."));
    return card;
  }
  const highlight = date === todayKey() ? currentMeal() : null;
  for (let meal of day.meals) {
    const box = make("div", "meal");
    // 오늘 지금(또는 다음) 식사는 강조
    if (highlight && highlight.meal.name === meal.name) {
      box.classList.add("meal-now");
      box.appendChild(make("span", "now-label", highlight.now ? "지금" : "다음"));
    }
    const heading = make("h4", "", meal.name);
    // 대상: "dorm-kb|2026-11-17|중식"
    const title = `${cafeteria.name} · ${Number(date.slice(5, 7))}/${Number(date.slice(8))} ${meal.name}`;
    addReviewChip(heading, `${cafeteria.id}|${date}|${meal.name}`, title);
    box.appendChild(heading);
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
  showNowMeal(date);
  for (let cafeteria of foodData.cafeterias) {
    if (cafeteria.type === "daily") dormList.appendChild(makeDormCard(cafeteria, date));
  }
}

// 오늘 탭을 볼 때: "지금은 중식 시간이에요" 안내
function showNowMeal(date) {
  const box = document.querySelector("#now-meal");
  const current = date === todayKey() ? currentMeal() : null;
  box.innerText = "";
  box.style.display = current ? "block" : "none";
  if (!current) return;
  box.innerText = current.now
    ? `지금은 ${current.meal.name} 시간이에요 (${current.meal.text})`
    : `다음 식사는 ${current.meal.name}이에요 (${current.meal.text})`;
}

for (let tab of tabs) {
  tab.addEventListener("click", function () {
    showDay(Number(this.dataset.day));
  });
}

// ---------- 학생식당 ----------

// 브랜드 버튼으로 고르고, 고른 브랜드의 메뉴를 카드 격자로 보여 준다
function makeFixedCard(cafeteria) {
  const card = makeCard(cafeteria);
  card.classList.add("fixed-card");
  if (!cafeteria.brands) {
    card.appendChild(make("p", "notice", "메뉴판을 가져오지 못했습니다."));
    return card;
  }

  const brandRow = make("div", "brand-tabs");
  const grid = make("div", "menu-grid");
  card.appendChild(brandRow);
  card.appendChild(grid);

  function showBrand(brand) {
    for (let button of brandRow.children) button.classList.toggle("active", button.innerText.startsWith(brand.brand));
    grid.innerHTML = "";
    for (let menu of brand.menus) grid.appendChild(makeMenuItem(cafeteria, brand, menu));
  }

  for (let brand of cafeteria.brands) {
    const button = make("button", "", `${brand.brand} ${brand.menus.length}`);
    button.type = "button";
    button.addEventListener("click", () => showBrand(brand));
    brandRow.appendChild(button);
  }
  showBrand(cafeteria.brands[0]);
  return card;
}

// 메뉴 하나: 이름, 가격, 별점 버튼
function makeMenuItem(cafeteria, brand, menu) {
  const item = make("div", "menu-item");
  item.appendChild(make("p", "menu-name", menu.name));
  const bottom = make("div", "menu-bottom");
  bottom.appendChild(make("span", "price", menu.price ? `${menu.price.toLocaleString()}원` : ""));
  // 대상: "st-table|바비든든|치킨마요덮밥"
  addReviewChip(bottom, `${cafeteria.id}|${brand.brand}|${menu.name}`, `${cafeteria.name} · ${brand.brand} · ${menu.name}`);
  item.appendChild(bottom);
  return item;
}

// ---------- 별점·한줄평 ----------

function stars(rating) {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

function chipText(target) {
  const s = reviewSummary[target];
  return s ? `★ ${s.avg.toFixed(1)} · ${s.count}` : "☆ 평가하기";
}

// 식사·메뉴 이름 옆에 붙는 별점 버튼 (누르면 한줄평 창)
function addReviewChip(parent, target, title) {
  if (!reviewSummary) return;
  const chip = make("button", "review-chip", chipText(target));
  chip.type = "button";
  chip.title = "별점·한줄평 보기";
  chip.addEventListener("click", (event) => {
    event.preventDefault();
    openReviews(target, title);
  });
  if (!reviewChips.has(target)) reviewChips.set(target, []);
  reviewChips.get(target).push(chip);
  parent.appendChild(chip);
}

function refreshChips() {
  return fetch("api/reviews/summary")
    .then((res) => res.json())
    .then((summary) => {
      reviewSummary = summary;
      for (let [target, chips] of reviewChips) {
        for (let chip of chips) chip.innerText = chipText(target);
      }
    })
    .catch(() => {});
}

// 한줄평 창 (food.html 맨 아래에 한 번만 만든다)
const reviewModal = make("div", "review-modal");
const reviewPanel = make("section", "review-panel");
reviewModal.appendChild(reviewPanel);
document.body.appendChild(reviewModal);

function closeReviews() {
  reviewModal.classList.remove("active");
}
reviewModal.addEventListener("click", (event) => {
  if (event.target === reviewModal) closeReviews();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeReviews();
});

function openReviews(target, title) {
  reviewPanel.innerHTML = "";
  const close = make("button", "review-close", "×");
  close.type = "button";
  close.setAttribute("aria-label", "닫기");
  close.addEventListener("click", closeReviews);
  reviewPanel.appendChild(close);
  reviewPanel.appendChild(make("h3", "", title));
  const body = make("div", "", "불러오는 중…");
  reviewPanel.appendChild(body);
  reviewModal.classList.add("active");

  Promise.all([fetch(`api/reviews?target=${encodeURIComponent(target)}`).then((res) => res.json()), getMe()])
    .then(([data, me]) => {
      body.innerText = "";
      body.appendChild(make("p", "review-summary", data.count ? `★ ${data.avg.toFixed(1)} (${data.count}명)` : "아직 한줄평이 없어요."));
      if (me.user) body.appendChild(makeReviewForm(target, title, data.myReview));
      else {
        const login = make("a", "", "로그인하면 별점과 한줄평을 남길 수 있어요 →");
        login.href = "login.html?next=food.html";
        body.appendChild(make("p", "review-login")).appendChild(login);
      }
      const list = make("ul", "review-list");
      for (let review of data.reviews) {
        const li = make("li", review.mine ? "mine" : "");
        const head = make("p", "review-head");
        head.appendChild(make("span", "review-stars", stars(review.rating)));
        head.appendChild(make("span", "review-name", ` ${review.nickname}${review.mine ? " (나)" : ""}`));
        head.appendChild(make("span", "review-date", ` · ${new Date(review.updatedAt).toLocaleDateString("ko-KR")}`));
        li.appendChild(head);
        if (review.text) li.appendChild(make("p", "review-text", review.text)); // innerText라 코드도 글자로만 보임
        list.appendChild(li);
      }
      body.appendChild(list);
    })
    .catch(() => (body.innerText = "한줄평을 불러오지 못했습니다."));
}

// 별점(1~5)과 한줄평 입력. 이미 남겼으면 그 내용으로 채워 수정
function makeReviewForm(target, title, myReview) {
  const form = make("form", "review-form");
  let rating = myReview ? myReview.rating : 0;

  const starRow = make("div", "star-input");
  const starButtons = [];
  for (let n = 1; n <= 5; n++) {
    const star = make("button", "star", "★");
    star.type = "button";
    star.setAttribute("aria-label", `별점 ${n}점`);
    star.addEventListener("click", () => {
      rating = n;
      paint();
    });
    starButtons.push(star);
    starRow.appendChild(star);
  }
  function paint() {
    starButtons.forEach((star, i) => star.classList.toggle("on", i < rating));
  }
  paint();
  form.appendChild(starRow);

  const text = make("textarea");
  text.maxLength = 100;
  text.rows = 2;
  text.placeholder = "한줄평 (선택, 100자까지)";
  text.value = myReview ? myReview.text : "";
  const counter = make("span", "review-counter", `${text.value.length}/100`);
  text.addEventListener("input", () => (counter.innerText = `${text.value.length}/100`));
  form.appendChild(text);
  form.appendChild(counter);

  const message = make("p", "review-message");
  form.appendChild(message);

  const actions = make("div", "review-actions");
  actions.appendChild(make("button", "", myReview ? "수정" : "남기기"));
  if (myReview) {
    const remove = make("button", "secondary", "내 한줄평 삭제");
    remove.type = "button";
    remove.addEventListener("click", () => {
      sendJson("DELETE", `api/reviews?target=${encodeURIComponent(target)}`)
        .then(() => refreshChips())
        .then(() => openReviews(target, title));
    });
    actions.appendChild(remove);
  }
  form.appendChild(actions);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (rating === 0) {
      message.innerText = "별점을 골라 주세요.";
      return;
    }
    sendJson("PUT", "api/reviews", { target: target, rating: rating, text: text.value }).then((result) => {
      if (!result.ok) {
        message.innerText = result.data.error || "저장하지 못했습니다.";
        return;
      }
      refreshChips().then(() => openReviews(target, title));
    });
  });
  return form;
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

// 한줄평을 쓸 수 있는 곳이면 별점 요약을 먼저 받아 두고 식단을 그린다
function loadReviewSummary() {
  return getMe().then((me) => {
    if (!me.accounts) return null;
    return fetch("api/reviews/summary")
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
  });
}

Promise.all([fetchJson("api/food", "data/food.json"), loadReviewSummary()])
  .then(([data, summary]) => {
    reviewSummary = summary;
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
