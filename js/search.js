/**
 * search.js — landing page behavior.
 * Depends on anilist.js being loaded first.
 */

(() => {
  "use strict";

  /* ---------------------------------------------------------------------
     Mode tabs
     --------------------------------------------------------------------- */

  const tabs = document.querySelectorAll(".mode-tab");
  const panels = {
    similar: document.getElementById("panel-similar"),
    filter: document.getElementById("panel-filter"),
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.setAttribute("aria-selected", "false"));
      tab.setAttribute("aria-selected", "true");
      const mode = tab.dataset.mode;
      Object.entries(panels).forEach(([key, panel]) => {
        panel.hidden = key !== mode;
      });
      clearResults();
    });
  });

  /* ---------------------------------------------------------------------
     Results rendering (shared by both modes)
     --------------------------------------------------------------------- */

  const resultsSection = document.getElementById("results-section");
  const resultsGrid = document.getElementById("results-grid");
  const resultsHeading = document.getElementById("results-heading-text");
  const resultsCount = document.getElementById("results-count");

  function clearResults() {
    resultsSection.hidden = true;
    resultsGrid.innerHTML = "";
  }

  function showMessage(message, isError = false) {
    resultsSection.hidden = false;
    resultsHeading.textContent = isError ? "Something went wrong" : "Searching";
    resultsCount.textContent = "";
    const cls = "state-message" + (isError ? " is-error" : "");
    resultsGrid.innerHTML = `<p class="${cls}">${message}</p>`;
  }

  function cardHTML(media) {
    const title = displayTitle(media);
    const cover = media.coverImage ? media.coverImage.large || media.coverImage.medium : "";
    const genres = (media.genres || []).slice(0, 3).join(", ");
    const score = media.averageScore ? `${media.averageScore}%` : "—";
    const meta = [media.format, media.seasonYear].filter(Boolean).join(" · ");

    return `
      <a class="result-card" href="${media.siteUrl || "#"}" target="_blank" rel="noopener noreferrer">
        <img class="cover" loading="lazy" src="${cover}" alt="${title} cover art" />
        <div class="card-body">
          <p class="card-title">${title}</p>
          ${genres ? `<p class="card-genres">${genres}</p>` : ""}
          <div class="card-meta">
            <span>${meta}</span>
            <span class="score">${score}</span>
          </div>
        </div>
      </a>
    `;
  }

  function renderResults(heading, items) {
    resultsSection.hidden = false;
    resultsHeading.textContent = heading;
    if (!items.length) {
      resultsCount.textContent = "";
      resultsGrid.innerHTML =
        '<p class="state-message">No matches found. Try loosening a filter or picking a different title.</p>';
      return;
    }
    resultsCount.textContent = `${items.length} result${items.length === 1 ? "" : "s"}`;
    resultsGrid.innerHTML = items.map(cardHTML).join("");
  }

  function friendlyError(err) {
    if (err && err.message === "RATE_LIMITED") {
      return "AniList is rate-limiting requests right now — wait a few seconds and try again.";
    }
    // anilistQuery() now throws with AniList's own error message when it
    // has one (validation errors, GraphQL errors, etc.) — show it directly
    // instead of hiding it behind a generic message.
    if (err && err.message && err.message !== "REQUEST_FAILED") {
      return err.message;
    }
    return "Couldn't reach AniList. Check your connection and try again.";
  }

  /* ---------------------------------------------------------------------
     Similar-shows search
     --------------------------------------------------------------------- */

  const titleInput = document.getElementById("title-search-input");
  const autocompleteList = document.getElementById("autocomplete-list");
  const findSimilarBtn = document.getElementById("find-similar-btn");
  const selectedChip = document.getElementById("selected-title-chip");
  const selectedChipLabel = document.getElementById("selected-title-label");
  const clearSelectionBtn = document.getElementById("clear-selection-btn");

  let selectedMediaId = null;
  let activeIndex = -1;

  function closeAutocomplete() {
    autocompleteList.hidden = true;
    autocompleteList.innerHTML = "";
    activeIndex = -1;
  }

  function selectTitle(media) {
    selectedMediaId = media.id;
    selectedChipLabel.textContent = displayTitle(media);
    selectedChip.classList.add("is-visible");
    titleInput.value = displayTitle(media);
    findSimilarBtn.disabled = false;
    closeAutocomplete();
  }

  clearSelectionBtn.addEventListener("click", () => {
    selectedMediaId = null;
    selectedChip.classList.remove("is-visible");
    titleInput.value = "";
    findSimilarBtn.disabled = true;
    titleInput.focus();
  });

  const runAutocomplete = debounce(async (term) => {
    if (!term || term.trim().length < 2) {
      closeAutocomplete();
      return;
    }
    try {
      const media = await searchTitles(term.trim());
      if (!media.length) {
        closeAutocomplete();
        return;
      }
      autocompleteList.innerHTML = media
        .map(
          (m, i) => `
        <div class="autocomplete-item" role="option" data-index="${i}" data-id="${m.id}">
          <img src="${m.coverImage ? m.coverImage.medium : ""}" alt="" />
          <div>
            <div class="ac-title">${displayTitle(m)}</div>
            ${m.seasonYear ? `<div class="ac-year">${m.seasonYear}</div>` : ""}
          </div>
        </div>
      `
        )
        .join("");
      autocompleteList.hidden = false;
      activeIndex = -1;

      autocompleteList.querySelectorAll(".autocomplete-item").forEach((el) => {
        el.addEventListener("click", () => {
          const id = Number(el.dataset.id);
          const match = media.find((m) => m.id === id);
          if (match) selectTitle(match);
        });
      });
    } catch (err) {
      closeAutocomplete();
    }
  }, 300);

  titleInput.addEventListener("input", () => {
    findSimilarBtn.disabled = true;
    selectedMediaId = null;
    selectedChip.classList.remove("is-visible");
    runAutocomplete(titleInput.value);
  });

  titleInput.addEventListener("keydown", (e) => {
    const items = autocompleteList.querySelectorAll(".autocomplete-item");
    if (autocompleteList.hidden || !items.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      items.forEach((el, i) => el.classList.toggle("is-active", i === activeIndex));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      items.forEach((el, i) => el.classList.toggle("is-active", i === activeIndex));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0) {
        e.preventDefault();
        items[activeIndex].click();
      }
    } else if (e.key === "Escape") {
      closeAutocomplete();
    }
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".title-search")) closeAutocomplete();
  });

  findSimilarBtn.addEventListener("click", async () => {
    if (!selectedMediaId) return;
    showMessage("Looking up similar titles…");
    try {
      const { sourceTitle, results } = await fetchRecommendations(selectedMediaId);
      renderResults(`Because you liked "${sourceTitle}"`, results);
    } catch (err) {
      showMessage(friendlyError(err), true);
    }
  });

  /* ---------------------------------------------------------------------
     Filter search
     --------------------------------------------------------------------- */

  const chipToggles = document.querySelectorAll(".chip-toggle");
  chipToggles.forEach((chip) => {
    chip.addEventListener("click", () => {
      const pressed = chip.getAttribute("aria-pressed") === "true";
      chip.setAttribute("aria-pressed", String(!pressed));
    });
  });

  function selectedChipValues(groupSelector) {
    return Array.from(document.querySelectorAll(`${groupSelector} .chip-toggle[aria-pressed="true"]`)).map(
      (el) => el.dataset.value
    );
  }

  const filterForm = document.getElementById("filter-form");
  filterForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const genres = selectedChipValues("#genre-chips");
    const themes = selectedChipValues("#theme-chips");
    const demographic = document.getElementById("demographic-select").value || null;
    const year = document.getElementById("year-input").value
      ? Number(document.getElementById("year-input").value)
      : null;
    const epMin = document.getElementById("ep-min-input").value
      ? Number(document.getElementById("ep-min-input").value)
      : null;
    const epMax = document.getElementById("ep-max-input").value
      ? Number(document.getElementById("ep-max-input").value)
      : null;

    showMessage("Searching AniList…");
    try {
      const results = await fetchFilteredMedia({ genres, themes, demographic, year, epMin, epMax });
      renderResults("Results", results);
    } catch (err) {
      showMessage(friendlyError(err), true);
    }
  });

  document.getElementById("filter-reset-btn").addEventListener("click", () => {
    chipToggles.forEach((chip) => chip.setAttribute("aria-pressed", "false"));
    document.getElementById("demographic-select").value = "";
    document.getElementById("year-input").value = "";
    document.getElementById("ep-min-input").value = "";
    document.getElementById("ep-max-input").value = "";
    clearResults();
  });
})();
