// food.html: 요일별 학식 메뉴 (data/food.json은 GitHub Actions가 매일 갱신)

const tabs = document.querySelectorAll("#day-tabs button");
const menuList = document.querySelector("#menu-list");
let foodData = null;

// 메뉴 하나를 li로 만들기
function makeMenuItem(menu) {
  const li = document.createElement("li");
  li.innerHTML = `<strong>${menu.name}</strong> <span class="price">${menu.price}</span>
    <p class="side">${menu.side.replaceAll("\n", ", ")}</p>`;
  return li;
}

// 중식/석식 한 묶음 만들기
function makeMeal(title, menus) {
  const section = document.createElement("div");
  section.className = "meal";
  const h3 = document.createElement("h3");
  h3.innerText = title;
  section.appendChild(h3);
  const ul = document.createElement("ul");
  for (let menu of menus) {
    ul.appendChild(makeMenuItem(menu));
  }
  section.appendChild(ul);
  return section;
}

// 식당 카드 만들기
function makeCard(cafeteria, date) {
  const card = document.createElement("section");
  card.className = "food-card";
  const h2 = document.createElement("h2");
  h2.innerText = cafeteria.name;
  card.appendChild(h2);

  if (cafeteria.type === "weekly-image") {
    if (cafeteria.imageUrl) {
      const p = document.createElement("p");
      p.innerText = cafeteria.title;
      const a = document.createElement("a");
      a.href = cafeteria.link;
      a.target = "_blank";
      const img = document.createElement("img");
      img.src = cafeteria.imageUrl;
      img.alt = cafeteria.title;
      a.appendChild(img);
      card.appendChild(p);
      card.appendChild(a);
    } else {
      card.appendChild(makeNotice("식단 정보를 가져오지 못했습니다."));
    }
    return card;
  }

  const day = cafeteria.days[date];
  if (!day || day.error) {
    card.appendChild(makeNotice("등록된 식단이 없습니다."));
    return card;
  }
  if (day.lunch.length > 0) card.appendChild(makeMeal("중식", day.lunch));
  if (day.dinner.length > 0) card.appendChild(makeMeal("석식", day.dinner));
  return card;
}

function makeNotice(text) {
  const p = document.createElement("p");
  p.className = "notice";
  p.innerText = text;
  return p;
}

// 선택한 요일(1~5) 메뉴 보여주기
function showDay(dayNumber) {
  for (let tab of tabs) {
    tab.classList.toggle("active", tab.dataset.day === String(dayNumber));
  }
  const date = foodData.week[dayNumber - 1];
  menuList.innerHTML = "";
  for (let cafeteria of foodData.cafeterias) {
    menuList.appendChild(makeCard(cafeteria, date));
  }
}

for (let tab of tabs) {
  tab.addEventListener("click", function () {
    showDay(Number(this.dataset.day));
  });
}

fetch("data/food.json")
  .then((res) => res.json())
  .then((data) => {
    foodData = data;
    const today = new Date().getDay(); // 0 일 ~ 6 토
    showDay(today >= 1 && today <= 5 ? today : 1);
    const updated = new Date(data.updatedAt);
    document.querySelector("#updated").innerText = `업데이트: ${updated.toLocaleString("ko-KR")}`;
  })
  .catch(() => {
    menuList.appendChild(makeNotice("학식 데이터를 불러오지 못했습니다."));
  });
