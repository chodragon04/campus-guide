// map.html: 카카오 지도, 건물 번호 마커, 핀 위 정보 창, 종류·편의시설 필터
//  - 핀을 누르면 지도 안에서 핀 바로 위에 건물 정보 창을 띄운다 (지도를 못 불러왔을 때만 모달로 표시)
//  - map.html?b=040 처럼 건물 ID를 붙여 들어오면 그 건물로 이동하고 정보 창을 연다
//  - map.html?edit=1 은 좌표 수정 모드: 핀을 고르고 지도에서 맞는 위치를 누르면 핀이 옮겨지고
//    바뀐 좌표가 아래 칸에 쌓인다 (data/buildings.json을 고칠 때 사용)
//  - 내 위치와 가까운 편의시설 목록은 js/location.js

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

// ---------- 건물 정보 창 ----------

// 정보 창 내용: 건물 정보, 위치 안내, 카카오맵 길찾기
function makeBuildingContent(building) {
  const box = make("div");
  box.appendChild(makeBuildingInfo(building, categoryNames));
  if (building.approx) {
    box.appendChild(make("p", "notice", "※ 지도 검색에 없는 장소라 위치가 조금 다를 수 있습니다."));
  }
  // 도착지를 이 건물로 지정
  const route = make("a", "route-link", "카카오맵에서 길찾기 →");
  route.href = `https://map.kakao.com/link/to/${encodeURIComponent("서울과기대 " + building.name)},${building.lat},${building.lng}`;
  route.target = "_blank";
  box.appendChild(route);
  return box;
}

// 고른 건물의 핀을 강조하고 다른 핀보다 위에 그리기 (null이면 강조 해제)
function highlightPin(building) {
  for (let marker of markers) {
    const selected = marker.building === building;
    marker.pin.classList.toggle("selected", selected);
    marker.overlay.setZIndex(selected ? 10 : 0);
  }
}

// 핀 위 정보 창: CustomOverlay 하나를 만들어 두고 내용과 위치만 바꾼다
const infoBox = make("div", "map-info");
const infoBody = make("div", "map-info-body");
const infoClose = make("button", "map-info-close", "×");
infoClose.setAttribute("aria-label", "닫기");
infoBox.appendChild(infoClose);
infoBox.appendChild(infoBody);
infoClose.addEventListener("click", closeInfo);
// 정보 창 안에서 스크롤·드래그·확대할 때 뒤의 지도가 움직이지 않도록
for (let type of ["wheel", "mousedown", "touchstart", "dblclick"]) {
  infoBox.addEventListener(type, (event) => event.stopPropagation());
}

let infoOverlay = null;
let infoBuilding = null; // 지금 정보 창을 띄운 건물

function openBuilding(building) {
  if (!map) {
    openModal(building);
    return;
  }
  infoBody.innerHTML = "";
  infoBody.appendChild(makeBuildingContent(building));
  infoBody.scrollTop = 0;
  const position = new kakao.maps.LatLng(building.lat, building.lng);
  if (!infoOverlay) {
    infoOverlay = new kakao.maps.CustomOverlay({ content: infoBox, xAnchor: 0.5, yAnchor: 1, zIndex: 30, clickable: true });
  }
  infoOverlay.setPosition(position);
  infoOverlay.setMap(map);
  infoBuilding = building;
  highlightPin(building);
  requestAnimationFrame(() => showWholeInfo(position)); // 정보 창이 화면에 그려진 뒤 높이를 잰다
}

function closeInfo() {
  if (infoOverlay) infoOverlay.setMap(null);
  infoBuilding = null;
  highlightPin(null);
}

// 정보 창이 지도 위쪽에 잘리지 않도록, 건물이 지도 아래쪽(정보 창 높이만큼 내려간 곳)에 오게 지도를 옮긴다
function showWholeInfo(position) {
  const projection = map.getProjection();
  const point = projection.containerPointFromCoords(position);
  const width = mapContainer.clientWidth;
  const height = mapContainer.clientHeight;
  const gap = parseFloat(getComputedStyle(infoBox).marginBottom) || 0; // 정보 창과 핀 사이 (핀 높이)
  const infoHeight = infoBox.offsetHeight || 260; // 아직 못 쟀으면 최대 높이로 어림
  const wantY = Math.min(height - 24, infoHeight + gap + 16); // 건물이 놓일 높이
  const center = new kakao.maps.Point(point.x, point.y - wantY + height / 2);
  // 이미 다 보이면 움직이지 않는다
  const fits = point.y >= wantY && point.x >= 160 && point.x <= width - 160;
  if (!fits) map.panTo(projection.coordsFromContainerPoint(center));
}

// 지도를 불러오지 못했을 때만 쓰는 모달
function openModal(building) {
  modalBody.innerHTML = "";
  modalBody.appendChild(makeBuildingContent(building));
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
  if (event.key !== "Escape") return;
  closeModal();
  if (map) closeInfo();
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
    if (!show && b === infoBuilding) closeInfo(); // 정보 창을 띄운 건물이 필터로 숨겨지면 닫기
  }
  mapStatus.innerText = `${count}곳 표시 중 · 번호를 누르면 핀 위에 건물 정보가 나옵니다.`;
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

// 건물로 지도를 옮기고 정보 창 열기 (가까운 편의시설 목록에서도 사용)
function focusBuilding(building) {
  if (map) {
    map.setLevel(2);
    map.setCenter(new kakao.maps.LatLng(building.lat, building.lng));
  }
  openBuilding(building);
  if (map) mapContainer.scrollIntoView({ block: "nearest", behavior: "smooth" }); // 모바일: 목록 아래에서 눌러도 지도가 보이게
}

// ---------- 시작 ----------

// 건물 데이터는 한 번만 받아 지도와 가까운 편의시설 목록(location.js)이 함께 쓴다
const buildingsData = fetch("data/buildings.json").then((res) => res.json());
buildingsData.then((data) => (categoryNames = data.categories)).catch(() => {});

if (typeof kakao === "undefined") {
  mapStatus.innerText = "지도를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
} else {
  createMap();
  buildingsData
    .then((data) => {
      for (let building of data.buildings) addMarker(building);
      applyFilters();
      if (EDIT_MODE) setupEditMode();
      // 지도 빈 곳을 누르면 정보 창 닫기 (좌표 수정 모드에서는 지도 클릭을 좌표 고치기에 쓴다)
      else kakao.maps.event.addListener(map, "click", closeInfo);

      // 주소에 ?b=건물ID가 있으면 그 건물로 이동
      const id = params.get("b");
      const target = data.buildings.find((b) => b.id === id);
      if (target) {
        focusBuilding(target);
      } else {
        fitAll();
      }
    })
    .catch(() => {
      mapStatus.innerText = "건물 정보를 불러오지 못했습니다.";
    });
}
