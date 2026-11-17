// map.html: 내 위치 표시와 가까운 편의시설 (map.js 다음에 불러온다)
//  - 위치는 브라우저의 Geolocation API로 받아 이 기기에서 거리 계산에만 쓰고, 서버로 보내지 않는다
//  - "내 위치 보기"를 눌러 처음 허용하면 그때부터 1시간 동안은 지도를 열 때 자동으로 위치를 다시 받는다
//    (허용한 시각만 localStorage에 저장하고 좌표는 저장하지 않는다. "위치 끄기"를 누르면 바로 지운다)
//  - 거리는 직선거리, 걸어서 걸리는 시간은 분당 67m(시속 약 4km)로 어림한다

const CONSENT_KEY = "cg.locationConsentUntil";
const CONSENT_MS = 60 * 60 * 1000; // 자동 허용 유지 시간: 1시간
const WALK_M_PER_MIN = 67;
const FAR_FROM_CAMPUS_M = 1500; // 가장 가까운 건물이 이보다 멀면 캠퍼스 밖으로 본다

const locateButton = document.querySelector("#locate");
const recenterButton = document.querySelector("#recenter");
const nearbyStatus = document.querySelector("#nearby-status");
const nearbyFilters = document.querySelector("#nearby-filters");
const nearbyList = document.querySelector("#nearby-list");

let spots = []; // 편의시설 하나하나: { building, facility }
let nearbyType = "all";
let myPosition = null; // { lat, lng, accuracy }
let watchId = null;
let myOverlay = null;
let myCircle = null;
let movedToMe = false; // 처음 위치를 받았을 때 한 번만 지도를 내 위치로 옮긴다

// ---------- 자동 허용 기억 (허용한 시각 + 1시간) ----------

function consentUntil() {
  try {
    return Number(localStorage.getItem(CONSENT_KEY)) || 0;
  } catch (err) {
    return 0;
  }
}

function saveConsent() {
  try {
    localStorage.setItem(CONSENT_KEY, String(Date.now() + CONSENT_MS));
  } catch (err) {
    // 저장소를 못 쓰는 환경(사생활 보호 모드 등)이면 매번 버튼을 누르면 된다
  }
}

function clearConsent() {
  try {
    localStorage.removeItem(CONSENT_KEY);
  } catch (err) {}
}

function timeText(ms) {
  const d = new Date(ms);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ---------- 거리 ----------

// 두 좌표 사이의 직선거리(m), 하버사인 공식
function distance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const rad = (deg) => (deg * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function distanceText(m) {
  if (m >= 1000) return `${(m / 1000).toFixed(1)}km`;
  return `${Math.round(m / 10) * 10}m`;
}

function walkText(m) {
  return `걸어서 약 ${Math.max(1, Math.ceil(m / WALK_M_PER_MIN))}분`;
}

// ---------- 지도에 내 위치 ----------

function drawMe() {
  if (!map || !myPosition) return;
  const position = new kakao.maps.LatLng(myPosition.lat, myPosition.lng);
  if (!myOverlay) {
    const dot = make("div", "my-location");
    dot.title = "내 위치";
    myOverlay = new kakao.maps.CustomOverlay({ position: position, content: dot, xAnchor: 0.5, yAnchor: 0.5, zIndex: 20 });
    myCircle = new kakao.maps.Circle({
      center: position,
      radius: 10,
      strokeWeight: 1,
      strokeColor: "#1e6fff",
      strokeOpacity: 0.5,
      fillColor: "#1e6fff",
      fillOpacity: 0.12,
    });
  }
  myOverlay.setPosition(position);
  myOverlay.setMap(map);
  myCircle.setPosition(position);
  myCircle.setRadius(Math.min(myPosition.accuracy, 300)); // 오차 범위 (너무 크면 300m까지만)
  myCircle.setMap(map);
}

function removeMe() {
  if (myOverlay) myOverlay.setMap(null);
  if (myCircle) myCircle.setMap(null);
}

function moveToMe() {
  if (!map || !myPosition) return;
  map.setLevel(3);
  map.setCenter(new kakao.maps.LatLng(myPosition.lat, myPosition.lng));
}

// ---------- 위치 받기 ----------

function setLocating(on) {
  locateButton.innerText = on ? "위치 끄기" : "내 위치 보기";
  locateButton.classList.toggle("active", on);
  recenterButton.style.display = on && myPosition && map ? "" : "none";
}

function startLocating() {
  if (watchId !== null) return;
  if (!("geolocation" in navigator)) {
    nearbyStatus.innerText = "이 브라우저는 위치 기능을 지원하지 않습니다.";
    return;
  }
  if (!window.isSecureContext) {
    nearbyStatus.innerText = "위치 기능은 https 주소에서만 쓸 수 있습니다.";
    return;
  }
  nearbyStatus.innerText = "내 위치를 찾는 중...";
  movedToMe = false;
  watchId = navigator.geolocation.watchPosition(onPosition, onPositionError, {
    enableHighAccuracy: true,
    maximumAge: 10000,
    timeout: 20000,
  });
  setLocating(true);
}

// 위치 끄기: 위치 받기를 멈추고, 자동 허용 기억도 지운다
function stopLocating() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  myPosition = null;
  clearConsent();
  removeMe();
  setLocating(false);
  nearbyStatus.innerText = "위치를 껐습니다. 다시 보려면 '내 위치 보기'를 누르세요.";
  renderNearby();
}

function onPosition(pos) {
  myPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
  // 처음 허용한 때부터 1시간 (위치를 받을 때마다 늘리지 않는다)
  if (consentUntil() <= Date.now()) saveConsent();
  drawMe();
  renderNearby();
  if (!movedToMe) {
    movedToMe = true;
    if (nearestBuildingDistance() <= FAR_FROM_CAMPUS_M) moveToMe(); // 캠퍼스 밖이면 지도는 그대로
  }
  setLocating(true);
}

function onPositionError(err) {
  if (err.code === err.PERMISSION_DENIED) {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = null;
    clearConsent();
    setLocating(false);
    nearbyStatus.innerText =
      "위치 권한이 거부되어 있습니다. 주소창 왼쪽의 사이트 설정에서 위치를 허용한 뒤 다시 눌러 주세요.";
    return;
  }
  // 신호를 못 잡았거나 시간이 초과된 경우: 계속 기다린다 (이미 받은 위치가 있으면 그대로 사용)
  if (!myPosition) nearbyStatus.innerText = "위치를 아직 찾지 못했습니다. 실외나 창가에서 잠시 기다려 주세요.";
}

locateButton.addEventListener("click", () => {
  if (watchId !== null) stopLocating();
  else startLocating();
});
recenterButton.addEventListener("click", moveToMe);

// 지도를 열 때: 1시간 안에 허용한 적이 있으면 버튼을 누르지 않아도 위치를 받는다
// 단, 그사이 브라우저에서 위치 권한을 막았으면 다시 묻지 않는다
function autoStart() {
  const until = consentUntil();
  if (until <= Date.now()) {
    clearConsent();
    return;
  }
  const start = () => {
    startLocating();
  };
  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions
      .query({ name: "geolocation" })
      .then((status) => {
        if (status.state === "denied") clearConsent();
        else start();
      })
      .catch(start);
  } else {
    start();
  }
}

// ---------- 가까운 편의시설 목록 ----------

function nearestBuildingDistance() {
  if (!myPosition || spots.length === 0) return Infinity;
  return Math.min(...spots.map((s) => distance(myPosition.lat, myPosition.lng, s.building.lat, s.building.lng)));
}

// 종류 버튼: 전체 + 데이터에 있는 편의시설 종류 전부 (FACILITY_LABELS 순서)
function makeTypeButtons() {
  nearbyFilters.innerHTML = "";
  const types = Object.keys(FACILITY_LABELS).filter((type) => spots.some((s) => s.facility.type === type));
  for (let type of ["all"].concat(types)) {
    const count = type === "all" ? spots.length : spots.filter((s) => s.facility.type === type).length;
    const button = make("button", type === nearbyType ? "active" : "", `${type === "all" ? "전체" : FACILITY_LABELS[type]} ${count}`);
    button.addEventListener("click", () => {
      nearbyType = type;
      for (let b of nearbyFilters.children) b.classList.toggle("active", b === button);
      renderNearby();
    });
    nearbyFilters.appendChild(button);
  }
}

function renderNearby() {
  nearbyList.innerHTML = "";
  let list = spots.filter((s) => nearbyType === "all" || s.facility.type === nearbyType);

  if (myPosition) {
    list = list
      .map((s) => ({ ...s, meters: distance(myPosition.lat, myPosition.lng, s.building.lat, s.building.lng) }))
      .sort((a, b) => a.meters - b.meters);
    const nearest = nearestBuildingDistance();
    const until = consentUntil();
    const auto = until > Date.now() ? ` · ${timeText(until)}까지는 지도를 열면 자동으로 위치를 보여 줍니다` : "";
    nearbyStatus.innerText =
      nearest > FAR_FROM_CAMPUS_M
        ? `캠퍼스에서 약 ${distanceText(nearest)} 떨어져 있어요. 캠퍼스에 오면 가까운 순서가 더 정확해집니다.${auto}`
        : `내 위치에서 가까운 순서 (직선거리, 오차 약 ${Math.round(myPosition.accuracy)}m)${auto}`;
  } else {
    list.sort((a, b) => a.building.no - b.building.no);
  }

  for (let spot of list) {
    const li = make("li");
    const button = make("button", "nearby-item");
    const main = make("span", "nearby-main");
    const label = FACILITY_LABELS[spot.facility.type] || "기타";
    main.appendChild(make("span", `fac fac-${spot.facility.type}`, label));
    // 이름이 종류와 같으면("ATM", "카페") 건물 이름을 크게 보여 준다
    const sameName = spot.facility.name === label;
    main.appendChild(make("strong", "", sameName ? spot.building.name : spot.facility.name));
    main.appendChild(make("span", "nearby-building", sameName ? `${spot.building.no}번 건물` : `${spot.building.no} ${spot.building.name}`));
    button.appendChild(main);
    if (spot.meters !== undefined) {
      const far = make("span", "nearby-distance");
      far.appendChild(make("strong", "", distanceText(spot.meters)));
      if (spot.meters <= FAR_FROM_CAMPUS_M) far.appendChild(make("span", "", walkText(spot.meters))); // 멀면 걷는 시간은 생략
      button.appendChild(far);
    }
    button.title = "지도에서 보기";
    button.addEventListener("click", () => focusBuilding(spot.building));
    li.appendChild(button);
    nearbyList.appendChild(li);
  }
  if (list.length === 0) nearbyList.appendChild(make("li", "notice", "해당하는 편의시설이 없습니다."));
}

// ---------- 시작 ----------

setLocating(false);
nearbyStatus.innerText =
  "'내 위치 보기'를 누르면 가까운 순서로 정렬합니다. 위치는 이 기기에서 거리 계산에만 쓰고 서버로 보내지 않으며, 한 번 허용하면 1시간 동안은 자동으로 위치를 보여 줍니다.";

buildingsData
  .then((data) => {
    for (let building of data.buildings) {
      for (let facility of building.facilities || []) spots.push({ building: building, facility: facility });
    }
    makeTypeButtons();
    renderNearby();
    autoStart();
  })
  .catch(() => {
    nearbyStatus.innerText = "편의시설 정보를 불러오지 못했습니다.";
  });
