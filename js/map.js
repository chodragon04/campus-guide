// map.html: 카카오 지도, 건물 마커, 정보 모달

// 지도 만들기 (서울과기대 중심)
const mapContainer = document.querySelector("#map");
const map = new kakao.maps.Map(mapContainer, {
  center: new kakao.maps.LatLng(37.6316, 127.0771),
  level: 3
});

// 모달 닫기
const modalBox = document.querySelector("#modal-box");
const closeBtn = document.querySelector("#close");

closeBtn.addEventListener("click", () => {
  modalBox.classList.remove("active");
});

// TODO: data/buildings.json을 불러와 마커 표시
// TODO: 마커 클릭 시 모달에 건물 정보 표시
// TODO: Geolocation으로 내 위치 표시
