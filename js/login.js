// login.html: 로그인 / 회원가입
//  - 성공하면 ?next= 로 받은 페이지(없으면 홈)로 돌아간다

const form = document.querySelector("#auth-form");
const title = document.querySelector("#auth-title");
const submit = document.querySelector("#submit");
const rules = document.querySelector("#rules");
const authMessage = document.querySelector("#auth-message");
const passwordInput = document.querySelector("#password");
const switchText = document.querySelector("#switch-text");
const switchLink = document.querySelector("#switch-link");

let mode = "login"; // "login" 또는 "signup"

// 돌아갈 페이지: 우리 사이트의 html 파일 이름만 허용 (다른 사이트로 보내는 주소는 무시)
function nextPage() {
  const next = new URLSearchParams(location.search).get("next") || "";
  return /^[\w-]+\.html(\?[\w=&%.-]*)?$/.test(next) ? next : "index.html";
}

function setMode(newMode) {
  mode = newMode;
  const signup = mode === "signup";
  title.innerText = signup ? "회원가입" : "로그인";
  submit.innerText = signup ? "가입하기" : "로그인";
  switchText.innerText = signup ? "이미 계정이 있나요?" : "계정이 없나요?";
  switchLink.innerText = signup ? "로그인" : "회원가입";
  // 비밀번호 관리자가 새 비밀번호를 제안하도록
  passwordInput.autocomplete = signup ? "new-password" : "current-password";
  rules.style.display = signup ? "block" : "none";
  document.querySelector("#forgot-link").style.display = signup ? "none" : "block";
  authMessage.innerText = "";
}

switchLink.addEventListener("click", (event) => {
  event.preventDefault();
  setMode(mode === "login" ? "signup" : "login");
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const body = {
    username: document.querySelector("#username").value,
    password: passwordInput.value,
  };
  submit.disabled = true;
  authMessage.innerText = "";

  sendJson("POST", `api/auth/${mode}`, body)
    .then((result) => {
      if (result.ok) {
        // 회원가입이면 복구 코드를 먼저 보여 주고, 저장했다고 확인하면 이동
        if (result.data.recoveryCode) {
          refreshAuthMenu();
          form.style.display = "none";
          document.querySelector("#switch-mode").style.display = "none";
          title.innerText = "가입 완료";
          document.querySelector("#auth-desc").innerText = "가입하고 로그인했어요. 계속하기 전에 아래 복구 코드를 저장해 주세요.";
          document.querySelector("#auth-box").appendChild(
            makeRecoveryCodeBox(result.data.recoveryCode, "계속하기", () => (location.href = nextPage()))
          );
          return;
        }
        location.href = nextPage();
        return;
      }
      authMessage.innerText = result.data.error || "잠시 후 다시 시도해 주세요.";
    })
    .catch(() => {
      authMessage.innerText = "서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    })
    .then(() => {
      submit.disabled = false;
    });
});

// 회원 기능이 없는 곳이거나 이미 로그인한 경우 안내
getMe().then((me) => {
  if (!me.accounts) {
    form.style.display = "none";
    document.querySelector("#switch-mode").style.display = "none";
    document.querySelector("#auth-desc").innerText =
      "이 주소에서는 회원 기능을 쓸 수 없습니다. https://campus-guide-az3a.onrender.com 에서 이용해 주세요.";
  } else if (me.user) {
    document.querySelector("#auth-desc").innerText = `${me.user.username} 계정으로 로그인되어 있습니다.`;
    form.style.display = "none";
    document.querySelector("#switch-mode").style.display = "none";
  }
});

// 주소가 login.html?mode=signup 이면 회원가입 화면으로 시작
setMode(new URLSearchParams(location.search).get("mode") === "signup" ? "signup" : "login");
