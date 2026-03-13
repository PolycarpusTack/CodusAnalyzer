export function renderUserProfile(container: HTMLElement, userContent: string) {
  const profileSection = document.createElement("div");
  profileSection.className = "user-profile";

  // Safe: textContent does not parse HTML
  const bioDiv = document.createElement("div");
  bioDiv.className = "bio";
  bioDiv.textContent = userContent;
  profileSection.appendChild(bioDiv);

  const headerEl = document.getElementById("header");
  if (headerEl) {
    headerEl.textContent = userContent;
  }

  container.appendChild(profileSection);
}

export function updateNotification(message: string) {
  const element = document.querySelector(".notification");
  if (element) {
    element.textContent = message;
  }
}
