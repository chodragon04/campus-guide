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
