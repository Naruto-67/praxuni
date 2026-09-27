/**
 * Praxuni - Frontend Application Logic
 * Vanilla JavaScript (No Frameworks)
 */

document.addEventListener("DOMContentLoaded", () => {
  initHealthCheck();
  initSearch();
  initCardInteractions();
});

/**
 * Checks the Cloudflare Worker backend health endpoint (/api/health)
 */
async function initHealthCheck() {
  const statusEl = document.getElementById("serviceStatus");
  if (!statusEl) return;

  const labelEl = statusEl.querySelector(".status-label");

  try {
    const response = await fetch("/api/health");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.status === "ok" && data.service === "praxuni") {
      statusEl.className = "status-badge online";
      if (labelEl) labelEl.textContent = "Worker: Live";
      statusEl.title = `Service: ${data.service} • Status: ${data.status}`;
    } else {
      throw new Error("Invalid payload");
    }
  } catch (err) {
    statusEl.className = "status-badge offline";
    if (labelEl) labelEl.textContent = "Offline / Local";
    statusEl.title = "Could not reach /api/health endpoint";
  }
}

/**
 * Live search filter for tool categories
 */
function initSearch() {
  const searchInput = document.getElementById("categorySearch");
  const cards = document.querySelectorAll(".category-card");
  const noResultsEl = document.getElementById("noResults");

  if (!searchInput || cards.length === 0) return;

  searchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    let visibleCount = 0;

    cards.forEach((card) => {
      const title = card.querySelector(".card-title")?.textContent.toLowerCase() || "";
      const description = card.querySelector(".card-text")?.textContent.toLowerCase() || "";
      const tags = Array.from(card.querySelectorAll(".tag"))
        .map((t) => t.textContent.toLowerCase())
        .join(" ");

      const matches =
        title.includes(query) ||
        description.includes(query) ||
        tags.includes(query);

      if (matches) {
        card.classList.remove("hidden");
        visibleCount++;
      } else {
        card.classList.add("hidden");
      }
    });

    if (noResultsEl) {
      if (visibleCount === 0) {
        noResultsEl.classList.remove("hidden");
      } else {
        noResultsEl.classList.add("hidden");
      }
    }
  });
}

/**
 * Interactive feedback for placeholder category cards
 */
function initCardInteractions() {
  const cards = document.querySelectorAll(".category-card");

  cards.forEach((card) => {
    card.addEventListener("click", () => {
      const categoryName = card.querySelector(".card-title")?.textContent || "Tools";
      console.log(`Praxuni: Selected category "${categoryName}"`);
    });
  });
}
