// timetable.html: 내 시간표
//  - data/courses.json(GitHub Actions가 수강신청시스템에서 수집)에서 과목을 검색해 담는다
//  - 담은 과목은 localStorage에 저장해 다음에 방문해도 남아 있다

const STORAGE_KEY = "campus-guide-timetable";
const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const COLORS = ["#dbe8ff", "#ffe3d6", "#dff5e1", "#fff2c7", "#eadcff", "#ffd9e6", "#d6f3f5", "#e8e8e8"];

const searchInput = document.querySelector("#course-search");
const searchResults = document.querySelector("#search-results");
const message = document.querySelector("#message");
const timetable = document.querySelector("#timetable");
const courseList = document.querySelector("#course-list");

let allCourses = [];
let myCourses = loadCourses();

// ---------- 저장 / 불러오기 ----------

function loadCourses() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCourses() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(myCourses));
}

function make(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.innerText = text;
  return el;
}

function showMessage(text) {
  message.innerText = text;
}

// ---------- 담기 / 빼기 ----------

// 두 과목의 시간이 겹치는지 확인
function overlaps(a, b) {
  for (let s1 of a.slots) {
    for (let s2 of b.slots) {
      if (s1.day === s2.day && s1.start <= s2.end && s2.start <= s1.end) return true;
    }
  }
  return false;
}

function addCourse(course) {
  if (myCourses.some((c) => c.id === course.id)) {
    showMessage(`${course.name}은(는) 이미 담았습니다.`);
    return;
  }
  const conflict = myCourses.find((c) => overlaps(c, course));
  if (conflict) {
    showMessage(`${conflict.name}과(와) 시간이 겹쳐서 담을 수 없습니다.`);
    return;
  }
  myCourses.push(course);
  saveCourses();
  showMessage(`${course.name}을(를) 담았습니다.`);
  render();
}

function removeCourse(id) {
  myCourses = myCourses.filter((c) => c.id !== id);
  saveCourses();
  showMessage("");
  render();
}

// ---------- 검색 ----------

function search(keyword) {
  searchResults.innerHTML = "";
  keyword = keyword.trim().toLowerCase(); // 영어 과목명은 대소문자 구분 없이 ("database" → "Database")
  if (keyword.length < 2) return;

  const found = allCourses.filter((c) => c.name.toLowerCase().includes(keyword) || c.prof.toLowerCase().includes(keyword));
  // 검색어로 시작하는 과목을 먼저 (예: "웹프로그래밍" 검색 시 "고급웹프로그래밍"보다 앞에)
  const startsWith = (c) => Number(c.name.toLowerCase().startsWith(keyword));
  found.sort((a, b) => startsWith(b) - startsWith(a));
  if (found.length === 0) {
    searchResults.appendChild(make("li", "notice", "검색 결과가 없습니다."));
    return;
  }
  for (let course of found.slice(0, 30)) {
    const li = make("li", "result");
    const info = make("div");
    info.appendChild(make("strong", "", course.name));
    info.appendChild(make("span", "meta", ` ${course.dept} · ${course.type} · ${course.credit}학점`));
    info.appendChild(make("p", "meta", `${course.prof || "교수 미정"} · ${courseTime(course)} · ${course.room || "강의실 미정"}`));
    const button = make("button", "", "담기");
    button.addEventListener("click", () => addCourse(course));
    li.appendChild(info);
    li.appendChild(button);
    searchResults.appendChild(li);
  }
  if (found.length > 30) {
    searchResults.appendChild(make("li", "notice", `${found.length}개 중 30개만 표시합니다. 검색어를 더 자세히 입력하세요.`));
  }
}

searchInput.addEventListener("input", () => search(searchInput.value));

// ---------- 시간표 그리기 ----------

function drawTimetable() {
  timetable.innerHTML = "";

  // 토·일 수업이 있을 때만 주말 칸 표시, 시간은 최소 9교시(17시)까지
  const usedDays = myCourses.flatMap((c) => c.slots.map((s) => s.day));
  const dayCount = usedDays.includes("일") ? 7 : usedDays.includes("토") ? 6 : 5;
  const lastPeriod = Math.max(9, ...myCourses.flatMap((c) => c.slots.map((s) => s.end)));
  timetable.style.gridTemplateColumns = `52px repeat(${dayCount}, 1fr)`;

  // 머리줄(요일)과 시간 칸 (한 줄 = 한 교시)
  timetable.appendChild(make("div", "corner"));
  for (let d = 0; d < dayCount; d++) {
    timetable.appendChild(make("div", "day-head", DAYS[d]));
  }
  for (let p = 1; p <= lastPeriod; p++) {
    const label = make("div", "period", periodStart(p));
    label.style.gridRow = p + 1;
    timetable.appendChild(label);
    for (let d = 0; d < dayCount; d++) {
      const cell = make("div", "cell");
      cell.style.gridRow = p + 1;
      cell.style.gridColumn = d + 2;
      timetable.appendChild(cell);
    }
  }

  // 과목 블록: grid-row로 시작 교시부터 끝 교시까지 차지
  myCourses.forEach((course, index) => {
    for (let slot of course.slots) {
      const block = make("div", "class-block");
      block.style.gridColumn = DAYS.indexOf(slot.day) + 2;
      block.style.gridRow = `${slot.start + 1} / ${slot.end + 2}`;
      block.style.backgroundColor = COLORS[index % COLORS.length];
      block.appendChild(make("strong", "", course.name));
      block.appendChild(make("span", "", course.room));
      timetable.appendChild(block);
    }
  });
}

function drawList() {
  courseList.innerHTML = "";
  let credits = 0;
  for (let course of myCourses) {
    credits += course.credit;
    const li = make("li");
    li.appendChild(make("span", "", `${course.name} (${course.prof || "교수 미정"}) · ${courseTime(course)} · ${course.room || "강의실 미정"}`));
    const button = make("button", "", "삭제");
    button.addEventListener("click", () => removeCourse(course.id));
    li.appendChild(button);
    courseList.appendChild(li);
  }
  if (myCourses.length === 0) {
    courseList.appendChild(make("li", "notice", "아직 담은 과목이 없습니다. 위에서 검색해 담아 보세요."));
  }
  document.querySelector("#credit-sum").innerText = `(${myCourses.length}과목, ${credits}학점)`;
}

function render() {
  drawTimetable();
  drawList();
}

// ---------- 시작 ----------

render();

fetch("data/courses.json")
  .then((res) => res.json())
  .then((data) => {
    allCourses = data.courses;
    const [year, term] = data.semester.split("-");
    document.querySelector("#semester").innerText =
      `${year}학년도 ${term}학기 개설 강좌 ${data.count}개 · 수강신청시스템 시간표 조회 기준`;
    search(searchInput.value);
  })
  .catch(() => {
    showMessage("강좌 목록을 불러오지 못했습니다.");
  });
