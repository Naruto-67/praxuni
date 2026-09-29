/**
 * Praxuni - Frontend Application Logic
 * Vanilla JavaScript (No Frameworks)
 */

document.addEventListener("DOMContentLoaded", () => {
  initHealthCheck();
  initSearch();
  initCardInteractions();
  initCustomSelects();
});

/**
 * Universal Custom Dropdown Component
 * Replaces native OS select popups with theme-matching accessible menus
 */
function initCustomSelect(selectEl) {
  if (!selectEl || selectEl.dataset.customized === 'true') return;
  selectEl.dataset.customized = 'true';

  const wrapper = document.createElement('div');
  const extraClasses = Array.from(selectEl.classList).filter(c => c !== 'form-select').join(' ');
  wrapper.className = 'custom-select-wrapper' + (extraClasses ? ' ' + extraClasses : '');

  // Trigger button
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'custom-select-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');

  const labelSpan = document.createElement('span');
  labelSpan.className = 'custom-select-label';
  const selectedOpt = selectEl.options[selectEl.selectedIndex] || selectEl.options[0];
  labelSpan.textContent = selectedOpt ? selectedOpt.textContent : '';

  const arrowSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  arrowSvg.setAttribute('class', 'custom-select-arrow');
  arrowSvg.setAttribute('viewBox', '0 0 24 24');
  arrowSvg.setAttribute('width', '16');
  arrowSvg.setAttribute('height', '16');
  arrowSvg.setAttribute('stroke', 'currentColor');
  arrowSvg.setAttribute('stroke-width', '2');
  arrowSvg.setAttribute('fill', 'none');
  const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  polyline.setAttribute('points', '6 9 12 15 18 9');
  arrowSvg.appendChild(polyline);

  trigger.appendChild(labelSpan);
  trigger.appendChild(arrowSvg);

  // Menu list
  const menu = document.createElement('div');
  menu.className = 'custom-select-menu';
  menu.setAttribute('role', 'listbox');

  function renderOptions() {
    menu.innerHTML = '';
    Array.from(selectEl.options).forEach((opt) => {
      const optionBtn = document.createElement('button');
      optionBtn.type = 'button';
      optionBtn.className = 'custom-select-option' + (opt.selected ? ' selected' : '');
      optionBtn.setAttribute('role', 'option');
      optionBtn.setAttribute('aria-selected', opt.selected ? 'true' : 'false');
      optionBtn.dataset.value = opt.value;

      const optText = document.createElement('span');
      optText.textContent = opt.textContent;
      optionBtn.appendChild(optText);

      const checkSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      checkSvg.setAttribute('class', 'custom-select-option-check');
      checkSvg.setAttribute('viewBox', '0 0 24 24');
      checkSvg.setAttribute('width', '15');
      checkSvg.setAttribute('height', '15');
      checkSvg.setAttribute('stroke', 'currentColor');
      checkSvg.setAttribute('stroke-width', '2.5');
      checkSvg.setAttribute('fill', 'none');
      const checkPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      checkPoly.setAttribute('points', '20 6 9 17 4 12');
      checkSvg.appendChild(checkPoly);
      optionBtn.appendChild(checkSvg);

      optionBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (selectEl.value !== opt.value) {
          selectEl.value = opt.value;
          selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
        closeMenu();
      });

      menu.appendChild(optionBtn);
    });
  }

  renderOptions();
  selectEl._syncCustomSelect = renderOptions;

  function openMenu() {
    document.querySelectorAll('.custom-select-wrapper.open').forEach(w => {
      if (w !== wrapper) {
        w.classList.remove('open');
        const trig = w.querySelector('.custom-select-trigger');
        if (trig) trig.setAttribute('aria-expanded', 'false');
      }
    });
    wrapper.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
  }

  function closeMenu() {
    wrapper.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (wrapper.classList.contains('open')) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  // Sync label & selected class when native select changes
  selectEl.addEventListener('change', () => {
    const curOpt = selectEl.options[selectEl.selectedIndex];
    if (curOpt) {
      labelSpan.textContent = curOpt.textContent;
      menu.querySelectorAll('.custom-select-option').forEach(btn => {
        const isMatch = btn.dataset.value === curOpt.value;
        btn.classList.toggle('selected', isMatch);
        btn.setAttribute('aria-selected', isMatch ? 'true' : 'false');
      });
    }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) {
      closeMenu();
    }
  });

  // Keyboard navigation
  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openMenu();
      const firstOpt = menu.querySelector('.custom-select-option');
      if (firstOpt) firstOpt.focus();
    } else if (e.key === 'Escape') {
      closeMenu();
    }
  });

  menu.addEventListener('keydown', (e) => {
    const options = Array.from(menu.querySelectorAll('.custom-select-option'));
    const currIndex = options.indexOf(document.activeElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = options[currIndex + 1] || options[0];
      if (next) next.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = options[currIndex - 1] || options[options.length - 1];
      if (prev) prev.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeMenu();
      trigger.focus();
    }
  });

  // Hide native select visually while keeping it active
  selectEl.classList.add('custom-select-native-hidden');
  selectEl.parentNode.insertBefore(wrapper, selectEl);
  wrapper.appendChild(selectEl);
  wrapper.appendChild(trigger);
  wrapper.appendChild(menu);
}

function initCustomSelects() {
  document.querySelectorAll('select.form-select').forEach(initCustomSelect);
}

window.initCustomSelect = initCustomSelect;
window.initCustomSelects = initCustomSelects;

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
