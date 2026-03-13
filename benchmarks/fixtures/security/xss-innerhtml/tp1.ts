export function renderUserProfile(container: HTMLElement, userContent: string) {
  const profileSection = document.createElement("div");
  profileSection.className = "user-profile";

  // Vulnerable: innerHTML with unsanitized user content
  profileSection.innerHTML = "<div class='bio'>" + userContent + "</div>";

  const headerEl = document.getElementById("header");
  if (headerEl) {
    headerEl.innerHTML = "<h1>" + userContent + "</h1>";
  }

  container.appendChild(profileSection);
}

export function updateNotification(message: string) {
  const element = document.querySelector(".notification");
  if (element) {
    element.innerHTML = message;
  }
}
