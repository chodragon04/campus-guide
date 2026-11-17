// recover.html: 복구 코드로 비밀번호 재설정
//  - 성공하면 로그인되고, 쓴 복구 코드 대신 새 복구 코드를 보여 준다

const recoverForm = document.querySelector("#recover-form");
const recoverMessage = document.querySelector("#auth-message");
const recoverSubmit = document.querySelector("#submit");

recoverForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const newPassword = document.querySelector("#new-password").value;
  if (newPassword !== document.querySelector("#confirm-password").value) {
    recoverMessage.innerText = "새 비밀번호와 확인이 서로 다릅니다.";
    return;
  }

  recoverSubmit.disabled = true;
  recoverMessage.innerText = "";
  sendJson("POST", "api/auth/recover", {
    username: document.querySelector("#username").value,
    recoveryCode: document.querySelector("#recovery-code").value,
    newPassword: newPassword,
  })
    .then((result) => {
      if (!result.ok) {
        recoverMessage.innerText = result.data.error || "잠시 후 다시 시도해 주세요.";
        return;
      }
      recoverForm.style.display = "none";
      refreshAuthMenu();
      document.querySelector("#recover-note").style.display = "none";
      document.querySelector("#switch-mode").style.display = "none";
      document.querySelector("#auth-title").innerText = "재설정 완료";
      document.querySelector("#auth-desc").innerText = "비밀번호를 바꾸고 로그인했어요. 방금 쓴 복구 코드는 더 이상 쓸 수 없어서 새 코드를 드려요.";
      document.querySelector("#auth-box").appendChild(
        makeRecoveryCodeBox(result.data.recoveryCode, "홈으로", () => (location.href = "index.html"))
      );
    })
    .catch(() => {
      recoverMessage.innerText = "서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    })
    .then(() => {
      recoverSubmit.disabled = false;
    });
});

// 회원 기능이 없는 주소 안내
getMe().then((me) => {
  if (!me.accounts) {
    recoverForm.style.display = "none";
    document.querySelector("#auth-desc").innerText =
      "이 주소에서는 회원 기능을 쓸 수 없습니다. https://campus-guide-az3a.onrender.com 에서 이용해 주세요.";
  }
});
