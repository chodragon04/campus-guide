// 모든 페이지 공통 스크립트

// 현재 페이지 메뉴 강조
const currentPage = document.body.dataset.page;
const menuLinks = document.querySelectorAll("#menu a");
for (let link of menuLinks) {
  if (link.dataset.key === currentPage) {
    link.classList.add("current");
  }
}

// 교시 → 시각: 1교시 09:00~09:50, 2교시 10:00~10:50 ... (한 교시 50분, 매시 정각 시작)
function periodStart(period) {
  return `${8 + period}:00`;
}

function periodEnd(period) {
  return `${8 + period}:50`;
}

// { start: 1, end: 4 } → "9:00~12:50"
function slotTime(slot) {
  return `${periodStart(slot.start)}~${periodEnd(slot.end)}`;
}

// 과목의 모든 수업 시간 → "화 9:00~12:50, 목 11:00~11:50"
function courseTime(course) {
  if (!course.slots || course.slots.length === 0) return "시간 미정";
  return course.slots.map((slot) => `${slot.day} ${slotTime(slot)}`).join(", ");
}
