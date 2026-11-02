// index.html: 오늘 날짜 표시, 오늘의 학식 요약

const todayText = document.querySelector("#today");
const now = new Date();
const days = ["일", "월", "화", "수", "목", "금", "토"];
todayText.innerText = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 (${days[now.getDay()]})`;

// 오늘 날짜를 food.json 형식(YYYY-MM-DD)으로
const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
const todayFood = document.querySelector("#today-food");

fetch("data/food.json")
  .then((res) => res.json())
  .then((data) => {
    let found = false;
    for (let cafeteria of data.cafeterias) {
      if (cafeteria.type !== "daily") continue;
      const day = cafeteria.days[todayKey];
      if (!day || day.error || day.lunch.length === 0) continue;
      const p = document.createElement("p");
      const names = day.lunch.map((menu) => menu.name).join(", ");
      p.innerText = `${cafeteria.name} 중식: ${names}`;
      todayFood.appendChild(p);
      found = true;
    }
    if (!found) {
      const p = document.createElement("p");
      p.innerText = "오늘 등록된 학식이 없습니다.";
      todayFood.appendChild(p);
    }
    const a = document.createElement("a");
    a.href = "food.html";
    a.innerText = "전체 식단 보기 →";
    todayFood.appendChild(a);
  });
