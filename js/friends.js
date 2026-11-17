// friends.html: 친구 신청 보내기, 받은 신청 수락·거절, 보낸 신청 취소, 친구 목록(함께 듣는 수업)

const friendsArea = document.querySelector("#friends-area");
const friendsStatus = document.querySelector("#friends-status");
const requestForm = document.querySelector("#request-form");
const friendIdInput = document.querySelector("#friend-id");
const requestMessage = document.querySelector("#request-message");
const incomingList = document.querySelector("#incoming");
const outgoingList = document.querySelector("#outgoing");
const friendList = document.querySelector("#friend-list");

let courseNames = new Map(); // 내 시간표의 강좌 ID → 과목명

function showRequestMessage(text, success) {
  requestMessage.innerText = text;
  requestMessage.className = success ? "success" : "";
}

// 목록 한 줄: 아이디, 설명, 버튼들
function makeRow(username, detail, buttons) {
  const li = make("li", "friend-row");
  const info = make("div", "friend-info");
  info.appendChild(make("strong", "", username));
  if (detail) info.appendChild(make("p", "friend-detail", detail));
  li.appendChild(info);
  const actions = make("div", "friend-actions");
  for (let button of buttons) actions.appendChild(button);
  li.appendChild(actions);
  return li;
}

function makeButton(text, className, onClick) {
  const button = make("button", className, text);
  button.addEventListener("click", onClick);
  return button;
}

// 삭제처럼 되돌리기 어려운 동작은 한 번 더 눌러야 실행
function makeConfirmButton(text, confirmText, onConfirm) {
  const button = make("button", "secondary", text);
  button.addEventListener("click", () => {
    if (button.dataset.armed) {
      onConfirm();
      return;
    }
    button.dataset.armed = "1";
    button.innerText = confirmText;
    button.classList.add("danger");
    setTimeout(() => {
      delete button.dataset.armed;
      button.innerText = text;
      button.classList.remove("danger");
    }, 3000);
  });
  return button;
}

function emptyRow(text) {
  return make("li", "empty", text);
}

function act(method, url) {
  return sendJson(method, url).then((result) => {
    if (!result.ok) showRequestMessage(result.data.error || "처리하지 못했습니다.", false);
    return loadFriends();
  });
}

function render(data) {
  incomingList.innerHTML = "";
  for (let request of data.incoming) {
    incomingList.appendChild(
      makeRow(request.username, "친구 신청을 보냈어요.", [
        makeButton("수락", "", () => act("POST", `api/friends/requests/${request.id}/accept`)),
        makeButton("거절", "secondary", () => act("DELETE", `api/friends/requests/${request.id}`)),
      ])
    );
  }
  if (data.incoming.length === 0) incomingList.appendChild(emptyRow("받은 신청이 없습니다."));
  document.querySelector("#incoming-count").innerText = data.incoming.length ? `(${data.incoming.length})` : "";

  outgoingList.innerHTML = "";
  for (let request of data.outgoing) {
    outgoingList.appendChild(
      makeRow(request.username, "수락을 기다리는 중", [
        makeButton("취소", "secondary", () => act("DELETE", `api/friends/requests/${request.id}`)),
      ])
    );
  }
  if (data.outgoing.length === 0) outgoingList.appendChild(emptyRow("보낸 신청이 없습니다."));
  document.querySelector("#outgoing-count").innerText = data.outgoing.length ? `(${data.outgoing.length})` : "";

  friendList.innerHTML = "";
  for (let friend of data.friends) {
    const shared = friend.sharedCourseIds.map((id) => courseNames.get(id)).filter(Boolean);
    const detail = shared.length > 0 ? `함께 듣는 수업: ${shared.join(", ")}` : "함께 듣는 수업이 없습니다.";
    friendList.appendChild(
      makeRow(friend.username, detail, [
        makeConfirmButton("삭제", "정말 삭제", () => act("DELETE", `api/friends/${encodeURIComponent(friend.username)}`)),
      ])
    );
  }
  if (data.friends.length === 0) friendList.appendChild(emptyRow("아직 친구가 없습니다. 위에서 친구 아이디로 신청해 보세요."));
  document.querySelector("#friend-count").innerText = `(${data.friends.length}명)`;
}

function loadFriends() {
  return fetch("api/friends")
    .then((res) => res.json())
    .then(render)
    .catch(() => showRequestMessage("친구 목록을 불러오지 못했습니다.", false));
}

requestForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const username = friendIdInput.value.trim();
  if (username === "") return;
  sendJson("POST", "api/friends/requests", { username: username }).then((result) => {
    if (!result.ok) {
      showRequestMessage(result.data.error || "신청하지 못했습니다.", false);
      return;
    }
    friendIdInput.value = "";
    if (result.data.result === "accepted") {
      showRequestMessage(`${result.data.username}님도 신청해 둔 상태라 바로 친구가 되었습니다.`, true);
    } else {
      showRequestMessage(`${result.data.username}님에게 친구 신청을 보냈습니다.`, true);
    }
    loadFriends();
  });
});

// 시작: 로그인해야 쓸 수 있는 페이지
getMe().then((me) => {
  if (!me.accounts) {
    friendsArea.style.display = "none";
    friendsStatus.innerText = "이 주소에서는 친구 기능을 쓸 수 없습니다. https://campus-guide-az3a.onrender.com 에서 이용해 주세요.";
    return;
  }
  if (!me.user) {
    friendsArea.style.display = "none";
    friendsStatus.innerText = "친구 기능은 로그인 후 사용할 수 있습니다. ";
    const login = make("a", "", "로그인하기 →");
    login.href = "login.html?next=friends.html";
    friendsStatus.appendChild(login);
    return;
  }
  // 함께 듣는 수업 이름을 보여 주려고 내 시간표도 불러온다
  loadMyCourses()
    .then((result) => {
      courseNames = new Map(result.courses.map((c) => [c.id, c.name]));
    })
    .catch(() => {})
    .then(loadFriends);
});
