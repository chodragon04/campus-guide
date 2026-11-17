// settings.html: 계정 설정 (비밀번호 변경)

const settingsArea = document.querySelector("#settings-area");
const settingsStatus = document.querySelector("#settings-status");
const passwordForm = document.querySelector("#password-form");
const passwordMessage = document.querySelector("#password-message");
const passwordSubmit = document.querySelector("#password-submit");

function showPasswordMessage(text, success) {
  passwordMessage.innerText = text;
  passwordMessage.className = success ? "success" : "";
}

passwordForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const currentPassword = document.querySelector("#current-password").value;
  const newPassword = document.querySelector("#new-password").value;
  const confirmPassword = document.querySelector("#confirm-password").value;

  if (newPassword !== confirmPassword) {
    showPasswordMessage("새 비밀번호와 확인이 서로 다릅니다.", false);
    return;
  }

  passwordSubmit.disabled = true;
  sendJson("POST", "api/auth/password", { currentPassword: currentPassword, newPassword: newPassword })
    .then((result) => {
      if (!result.ok) {
        showPasswordMessage(result.data.error || "비밀번호를 바꾸지 못했습니다.", false);
        return;
      }
      passwordForm.reset();
      showPasswordMessage("비밀번호를 변경했습니다.", true);
    })
    .catch(() => showPasswordMessage("서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.", false))
    .then(() => {
      passwordSubmit.disabled = false;
    });
});

// 복구 코드 새로 받기
const recoveryForm = document.querySelector("#recovery-form");
const recoveryMessage = document.querySelector("#recovery-message");

recoveryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const submit = document.querySelector("#recovery-submit");
  submit.disabled = true;
  recoveryMessage.innerText = "";
  sendJson("POST", "api/auth/recovery-code", { password: document.querySelector("#recovery-password").value })
    .then((result) => {
      if (!result.ok) {
        recoveryMessage.innerText = result.data.error || "복구 코드를 만들지 못했습니다.";
        return;
      }
      recoveryForm.reset();
      recoveryForm.style.display = "none";
      const box = makeRecoveryCodeBox(result.data.recoveryCode, "확인", () => {
        box.remove();
        recoveryForm.style.display = "flex";
      });
      document.querySelector("#recovery-section").appendChild(box);
    })
    .catch(() => (recoveryMessage.innerText = "서버에 연결하지 못했습니다."))
    .then(() => {
      submit.disabled = false;
    });
});

// 로그인해야 쓸 수 있는 페이지
getMe().then((me) => {
  if (!me.accounts) {
    settingsArea.style.display = "none";
    settingsStatus.innerText = "이 주소에서는 회원 기능을 쓸 수 없습니다. https://campus-guide-az3a.onrender.com 에서 이용해 주세요.";
  } else if (!me.user) {
    settingsArea.style.display = "none";
    settingsStatus.innerText = "로그인 후 사용할 수 있습니다. ";
    const login = make("a", "", "로그인하기 →");
    login.href = "login.html?next=settings.html";
    settingsStatus.appendChild(login);
  } else {
    document.querySelector("#account-name").innerText = me.user.username;
  }
});
