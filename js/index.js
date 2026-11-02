// index.html: 오늘 날짜 표시, 오늘의 학식 요약

const todayText = document.querySelector("#today");
const now = new Date();
const days = ["일", "월", "화", "수", "목", "금", "토"];
todayText.innerText = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 (${days[now.getDay()]})`;

// TODO: data/food.json을 fetch로 불러와 오늘 메뉴 표시
