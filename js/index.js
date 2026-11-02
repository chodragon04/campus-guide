// index.html: 오늘 날짜 표시, 오늘의 학식 요약

const todayText = document.querySelector("#today");
const now = new Date();
const days = ["일", "월", "화", "수", "목", "금", "토"];
todayText.innerText = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 (${days[now.getDay()]})`;

// 오늘 수업: 내 시간표(localStorage)에서 오늘 요일 수업을 교시 순서로
const todayClass = document.querySelector("#today-class");
let myCourses = [];
try {
  myCourses = JSON.parse(localStorage.getItem("campus-guide-timetable")) || [];
} catch {
  myCourses = [];
}
const todayDay = days[now.getDay()];
const todaySlots = [];
for (let course of myCourses) {
  for (let slot of course.slots) {
    if (slot.day === todayDay) todaySlots.push({ course: course, slot: slot });
  }
}
todaySlots.sort((a, b) => a.slot.start - b.slot.start);
for (let item of todaySlots) {
  const p = document.createElement("p");
  const periods = item.slot.start === item.slot.end ? `${item.slot.start}교시` : `${item.slot.start}~${item.slot.end}교시`;
  p.innerText = `${periods} ${item.course.name} · ${item.course.room}`;
  todayClass.appendChild(p);
}
if (todaySlots.length === 0) {
  const p = document.createElement("p");
  p.innerText = myCourses.length === 0 ? "아직 시간표를 만들지 않았습니다." : "오늘은 수업이 없습니다.";
  todayClass.appendChild(p);
}
const timetableLink = document.createElement("a");
timetableLink.href = "timetable.html";
timetableLink.innerText = "내 시간표 →";
todayClass.appendChild(timetableLink);

// 오늘 날짜를 food.json 형식(YYYY-MM-DD)으로
const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
const todayFood = document.querySelector("#today-food");

fetch("data/food.json")
  .then((res) => res.json())
  .then((data) => {
    // 생활관 식당의 오늘 중식
    let found = false;
    for (let cafeteria of data.cafeterias) {
      if (cafeteria.type !== "daily") continue;
      const day = cafeteria.days[todayKey];
      if (!day) continue;
      const lunch = day.meals.find((meal) => meal.name === "중식");
      if (!lunch) continue;
      const p = document.createElement("p");
      p.innerText = `${cafeteria.name} 중식: ${lunch.items.join(", ")}`;
      todayFood.appendChild(p);
      found = true;
    }
    if (!found) {
      const p = document.createElement("p");
      p.innerText = "오늘 등록된 생활관 식단이 없습니다.";
      todayFood.appendChild(p);
    }
    const a = document.createElement("a");
    a.href = "food.html";
    a.innerText = "전체 식단 보기 →";
    todayFood.appendChild(a);
  });
