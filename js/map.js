// map.html: 카카오 지도, 건물 번호 마커, 정보 모달, 종류·편의시설 필터
//  - map.html?b=040 처럼 건물 ID를 붙여 들어오면 그 건물로 이동하고 정보 창을 연다
//  - map.html?edit=1 은 좌표 수정 모드: 핀을 고르고 지도에서 맞는 위치를 누르면 핀이 옮겨지고
//    바뀐 좌표가 아래 칸에 쌓인다 (data/buildings.json을 고칠 때 사용)

const mapContainer = document.querySelector("#map");
const mapStatus = document.querySelector("#map-status");
const modalBox = document.querySelector("#modal-box");
const modalBody = document.querySelector("#modal-body");
const categoryButtons = document.querySelectorAll("#category-filters button");
const facilityButtons = document.querySelectorAll("#facility-filters button");

let map = null;
let markers = []; // { building, overlay, pin }
let categoryNames = {};
let selectedCategory = "all";
let selectedFacility = null;

const params = new URLSearchParams(location.search);
const EDIT_MODE = params.get("edit") === "1";
let editTarget = null; // 좌표 수정 모드에서 고른 핀
const edits = {}; // 건물 ID → 바뀐 좌표 한 줄

// ---------- 지도 ----------

function createMap() {
  map = new kakao.maps.Map(mapContainer, {
    center: new kakao.maps.LatLng(37.6316, 127.0771), // 서울과기대
    level: 3,
  });
}

// 건물 번호가 적힌 핀을 지도에 올린다 (카카오 CustomOverlay에 직접 만든 태그를 넣음)
function addMarker(building) {
  const pin = make("button", `pin cat-${building.category}`);
  pin.appendChild(make("span", "", String(building.no))); // 핀은 기울어져 있고 숫자만 똑바로 세운다
  pin.title = building.name;

  const overlay = new kakao.maps.CustomOverlay({
    position: new kakao.maps.LatLng(building.lat, building.lng),
    content: pin,
    yAnchor: 1,
    clickable: true,
  });
  overlay.setMap(map);
  const marker = { building: building, overlay: overlay, pin: pin };
  markers.push(marker);

  pin.addEventListener("click", () => {
    if (EDIT_MODE) selectForEdit(marker);
    else openBuilding(building);
  });
}

// 모든 건물이 화면에 들어오게 지도 범위 맞추기
function fitAll() {
  const bounds = new kakao.maps.LatLngBounds();
  for (let marker of markers) bounds.extend(marker.overlay.getPosition());
  map.setBounds(bounds);
}

// ---------- 정보 모달 ----------

function openBuilding(building) {
  modalBody.innerHTML = "";
  modalBody.appendChild(makeBuildingInfo(building, categoryNames));

  if (building.approx) {
    modalBody.appendChild(make("p", "notice", "※ 지도 검색에 없는 장소라 위치가 조금 다를 수 있습니다."));
  }

  // 카카오맵 길찾기 (도착지를 이 건물로 지정)
  const route = make("a", "route-link", "카카오맵에서 길찾기 →");
  route.href = `https://map.kakao.com/link/to/${encodeURIComponent("서울과기대 " + building.name)},${building.lat},${building.lng}`;
  route.target = "_blank";
  modalBody.appendChild(route);

  // 고른 건물의 핀을 강조하고 다른 핀보다 위에 그리기
  for (let marker of markers) {
    const selected = marker.building === building;
    marker.pin.classList.toggle("selected", selected);
    marker.overlay.setZIndex(selected ? 10 : 0);
  }
  modalBox.classList.add("active");
}

function closeModal() {
  modalBox.classList.remove("active");
}

document.querySelector("#close").addEventListener("click", closeModal);
// 어두운 바깥 부분을 눌러도 닫기
modalBox.addEventListener("click", (event) => {
  if (event.target === modalBox) closeModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeModal();
});

// ---------- 좌표 수정 모드 (?edit=1) ----------

function setupEditMode() {
  const panel = make("section", "edit-panel");
  panel.appendChild(make("h2", "", "좌표 수정 모드"));
  const guide = make("p", "hint", "① 옮길 핀을 누르고 ② 지도에서 건물의 실제 위치를 누르세요. 바뀐 좌표가 아래에 쌓입니다.");
  panel.appendChild(guide);
  const log = make("textarea", "edit-log");
  log.readOnly = true;
  log.rows = 6;
  panel.appendChild(log);
  const copy = make("button", "", "좌표 복사");
  copy.addEventListener("click", () => {
    navigator.clipboard.writeText(log.value).then(() => (copy.innerText = "복사했습니다"));
  });
  panel.appendChild(copy);
  mapContainer.after(panel);

  // 지도를 누르면 고른 핀을 그 자리로 옮기고 좌표 기록
  kakao.maps.event.addListener(map, "click", (mouseEvent) => {
    if (!editTarget) return;
    const latLng = mouseEvent.latLng;
    const b = editTarget.building;
    editTarget.overlay.setPosition(latLng);
    edits[b.id] = `${b.id} ${b.name}: ${latLng.getLat().toFixed(6)}, ${latLng.getLng().toFixed(6)}`;
    log.value = Object.values(edits).join("\n");
    guide.innerText = `${b.no} ${b.name} 위치를 옮겼습니다. 다른 핀을 고르거나, 다시 눌러 위치를 고칠 수 있습니다.`;
  });
}

function selectForEdit(marker) {
  editTarget = marker;
  for (let m of markers) m.pin.classList.toggle("selected", m === marker);
  mapStatus.innerText = `${marker.building.no} ${marker.building.name} 선택됨 · 지도에서 실제 위치를 누르세요.`;
}

// ---------- 필터 ----------

function applyFilters() {
  let count = 0;
  for (let marker of markers) {
    const b = marker.building;
    let show = selectedCategory === "all" || b.category === selectedCategory;
    if (selectedFacility && !(b.facilities || []).some((f) => f.type === selectedFacility)) show = false;
    marker.overlay.setMap(show ? map : null);
    if (show) count++;
  }
  mapStatus.innerText = `${count}곳 표시 중 · 번호를 누르면 건물 정보를 볼 수 있습니다.`;
}

for (let button of categoryButtons) {
  button.addEventListener("click", function () {
    selectedCategory = this.dataset.category;
    for (let b of categoryButtons) b.classList.toggle("active", b === this);
    applyFilters();
  });
}

// 편의시설 버튼은 한 번 더 누르면 해제
for (let button of facilityButtons) {
  button.addEventListener("click", function () {
    selectedFacility = selectedFacility === this.dataset.facility ? null : this.dataset.facility;
    for (let b of facilityButtons) b.classList.toggle("active", b.dataset.facility === selectedFacility);
    applyFilters();
  });
}

// ---------- 시작 ----------

if (typeof kakao === "undefined") {
  mapStatus.innerText = "지도를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
} else {
  createMap();
  fetch("data/buildings.json")
    .then((res) => res.json())
    .then((data) => {
      categoryNames = data.categories;
      for (let building of data.buildings) addMarker(building);
      applyFilters();
      if (EDIT_MODE) setupEditMode();

      // 주소에 ?b=건물ID가 있으면 그 건물로 이동
      const id = params.get("b");
      const target = data.buildings.find((b) => b.id === id);
      if (target) {
        map.setLevel(2);
        map.setCenter(new kakao.maps.LatLng(target.lat, target.lng));
        openBuilding(target);
      } else {
        fitAll();
      }
    })
    .catch(() => {
      mapStatus.innerText = "건물 정보를 불러오지 못했습니다.";
    });
}
