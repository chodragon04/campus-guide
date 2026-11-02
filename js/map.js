// map.html: 카카오 지도, 건물 마커, 정보 모달

const modalBox = document.querySelector("#modal-box");
const closeBtn = document.querySelector("#close");

closeBtn.addEventListener("click", () => {
  modalBox.classList.remove("active");
});

// TODO: 카카오 지도 API 키 발급 후 지도 생성
// TODO: data/buildings.json을 불러와 마커 표시
// TODO: Geolocation으로 내 위치 표시
