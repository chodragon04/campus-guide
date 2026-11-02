// 모든 페이지 공통 스크립트

// 현재 페이지 메뉴 강조
const currentPage = document.body.dataset.page;
const menuLinks = document.querySelectorAll("#menu a");
for (let link of menuLinks) {
  if (link.dataset.key === currentPage) {
    link.classList.add("current");
  }
}
