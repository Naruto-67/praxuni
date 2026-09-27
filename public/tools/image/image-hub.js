/**
 * Praxuni - Image Tools Hub JavaScript
 * Lightweight, zero-dependency client script
 */

document.addEventListener("DOMContentLoaded", () => {
  initHealthCheck();
  initBackToTop();
  initToolFilter();
  initSmoothScroll();
});

async function initHealthCheck() {
  const badge = document.getElementById("serviceStatus");
  if (!badge) return;

  try {
    const res = await fetch("/api/health");
    if (res.ok) {
      const data = await res.json();
      if (data.status === "ok") {
        badge.className = "status-badge online";
        badge.querySelector(".status-label").textContent = "Edge: Online";
        return;
      }
    }
    throw new Error("Worker unavailable");
  } catch {
    badge.className = "status-badge offline";
    badge.querySelector(".status-label").textContent = "Edge: Offline";
  }
}

function initBackToTop() {
  const btn = document.getElementById("backToTopBtn");
  if (!btn) return;

  function updateBackToTop() {
    const scrollableDistance = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollableDistance <= 0) {
      btn.classList.remove("visible");
      return;
    }

    const scrollPercent = (window.scrollY / scrollableDistance) * 100;
    if (scrollPercent >= 97) {
      btn.classList.add("visible");
    } else {
      btn.classList.remove("visible");
    }
  }

  window.addEventListener("scroll", updateBackToTop, { passive: true });
  window.addEventListener("resize", updateBackToTop, { passive: true });

  btn.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  });
}

function initToolFilter() {
  const searchInput = document.getElementById("toolSearchInput");
  const clearBtn = document.getElementById("clearSearchBtn");
  const resetBtn = document.getElementById("resetSearchBtn");
  const noResults = document.getElementById("noResultsState");
  const sections = document.querySelectorAll(".hub-section");

  if (!searchInput) return;

  function applyFilter(query) {
    const q = query.trim().toLowerCase();

    if (q.length > 0) {
      clearBtn.classList.remove("hidden");
    } else {
      clearBtn.classList.add("hidden");
    }

    let totalVisible = 0;

    sections.forEach(section => {
      const sectionCards = section.querySelectorAll(".tool-card");
      let sectionVisibleCount = 0;

      sectionCards.forEach(card => {
        const name = (card.getAttribute("data-name") || "").toLowerCase();
        const text = card.textContent.toLowerCase();

        if (!q || name.includes(q) || text.includes(q)) {
          card.style.display = "";
          sectionVisibleCount++;
          totalVisible++;
        } else {
          card.style.display = "none";
        }
      });

      if (sectionVisibleCount === 0 && q.length > 0) {
        section.style.display = "none";
      } else {
        section.style.display = "";
      }
    });

    if (totalVisible === 0) {
      noResults.classList.remove("hidden");
    } else {
      noResults.classList.add("hidden");
    }
  }

  searchInput.addEventListener("input", (e) => {
    applyFilter(e.target.value);
  });

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      searchInput.value = "";
      applyFilter("");
      searchInput.focus();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      searchInput.value = "";
      applyFilter("");
      searchInput.focus();
    });
  }
}

function initSmoothScroll() {
  const pills = document.querySelectorAll(".quick-nav-pills a[href^='#']");
  pills.forEach(pill => {
    pill.addEventListener("click", (e) => {
      const targetId = pill.getAttribute("href");
      if (targetId && targetId !== "#") {
        const targetEl = document.querySelector(targetId);
        if (targetEl) {
          e.preventDefault();
          targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
          history.pushState(null, "", targetId);
        }
      }
    });
  });
}
