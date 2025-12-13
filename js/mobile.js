/* ===========================================
   Mobile UI Functions (Simplified - List only)
   =========================================== */

const isMobile = () => window.innerWidth <= MOBILE_BREAKPOINT;

// Mobile semantic search state
let mobileSemanticEnabled = false;

// Hamburger Menu
function openMobileMenu() {
  const mobileMenu = document.getElementById('mobileMenu');
  const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  mobileMenu.classList.add('active');
  mobileMenuOverlay.classList.add('active');
  hamburgerBtn.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeMobileMenu() {
  const mobileMenu = document.getElementById('mobileMenu');
  const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  mobileMenu.classList.remove('active');
  mobileMenuOverlay.classList.remove('active');
  hamburgerBtn.classList.remove('active');
  document.body.style.overflow = '';
}

// Bottom Sheet
function openBottomSheet() {
  document.getElementById('bottomSheet').classList.add('active');
}

function closeBottomSheet() {
  document.getElementById('bottomSheet').classList.remove('active');
  if (isMobile()) {
    selectedPaper = null;
    connectedPapers = new Set();
    updateUrlWithPaper(null);
    renderList(currentFiltered);
  }
}

// Mobile Cluster Chips
function populateMobileClusterChips() {
  const container = document.getElementById('mobileClusterChips');
  if (!container) return;

  container.innerHTML = '';

  // All chip
  const allChip = document.createElement('div');
  allChip.className = 'cluster-chip' + (highlightCluster === null ? ' active' : '');
  allChip.textContent = 'All';
  allChip.addEventListener('click', () => {
    highlightCluster = null;
    updateMobileClusterChips();
    applyFilters();
  });
  container.appendChild(allChip);

  // Cluster chips
  const clusters = [...new Set(allPapers.map(p => p.cluster))].sort((a, b) => a - b);
  clusters.forEach(c => {
    const label = clusterLabels[c] || `C${c}`;
    const chip = document.createElement('div');
    chip.className = 'cluster-chip' + (highlightCluster === c ? ' active' : '');
    chip.dataset.cluster = c;
    const shortLabel = label.length > 12 ? label.substring(0, 12) + '..' : label;
    chip.innerHTML = `<span class="chip-dot" style="background: ${CLUSTER_COLORS[c % CLUSTER_COLORS.length]}"></span>${shortLabel}`;
    chip.addEventListener('click', () => {
      if (highlightCluster === c) {
        highlightCluster = null;
      } else {
        highlightCluster = c;
      }
      updateMobileClusterChips();
      applyFilters();
    });
    container.appendChild(chip);
  });
}

function updateMobileClusterChips() {
  const chips = document.querySelectorAll('.cluster-chip');
  chips.forEach(chip => {
    if (chip.dataset.cluster) {
      chip.classList.toggle('active', highlightCluster === parseInt(chip.dataset.cluster));
    } else {
      chip.classList.toggle('active', highlightCluster === null);
    }
  });
}

// Sync controls (simplified)
function syncMobileControls() {
  const tagFilter = document.getElementById('mobileTagFilter');
  const bookmarkedOnly = document.getElementById('mobileBookmarkedOnly');
  const sortBy = document.getElementById('mobileSortBy');
  const headerSearch = document.getElementById('mobileHeaderSearch');

  if (tagFilter) tagFilter.value = document.getElementById('tagFilter')?.value || '';
  if (bookmarkedOnly) bookmarkedOnly.checked = document.getElementById('bookmarkedOnly')?.checked || false;
  if (sortBy) sortBy.value = document.getElementById('listSortBy')?.value || 'year-desc';
  if (headerSearch) headerSearch.value = document.getElementById('searchFilter')?.value || '';
}

function syncDesktopControls() {
  const mobileTagFilter = document.getElementById('mobileTagFilter');
  const mobileBookmarkedOnly = document.getElementById('mobileBookmarkedOnly');
  const mobileSortBy = document.getElementById('mobileSortBy');
  const mobileHeaderSearch = document.getElementById('mobileHeaderSearch');

  if (mobileTagFilter) {
    const tagFilter = document.getElementById('tagFilter');
    if (tagFilter) tagFilter.value = mobileTagFilter.value;
  }
  if (mobileBookmarkedOnly) {
    const bookmarkedOnly = document.getElementById('bookmarkedOnly');
    if (bookmarkedOnly) bookmarkedOnly.checked = mobileBookmarkedOnly.checked;
  }
  if (mobileSortBy) {
    const listSortBy = document.getElementById('listSortBy');
    if (listSortBy) listSortBy.value = mobileSortBy.value;
  }
  if (mobileHeaderSearch) {
    const searchFilter = document.getElementById('searchFilter');
    if (searchFilter) searchFilter.value = mobileHeaderSearch.value;
  }
}

// Initialize mobile event handlers
function initMobileHandlers() {
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
  const bottomSheet = document.getElementById('bottomSheet');
  const bottomSheetHandle = document.getElementById('bottomSheetHandle');
  const bottomSheetClose = document.getElementById('bottomSheetClose');

  hamburgerBtn.addEventListener('click', () => {
    if (mobileMenu.classList.contains('active')) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  });

  mobileMenuOverlay.addEventListener('click', closeMobileMenu);

  // Swipe to close menu
  let menuTouchStartX = 0;
  mobileMenu.addEventListener('touchstart', (e) => {
    menuTouchStartX = e.touches[0].clientX;
  }, { passive: true });

  mobileMenu.addEventListener('touchmove', (e) => {
    const deltaX = e.touches[0].clientX - menuTouchStartX;
    if (deltaX < -50) {
      closeMobileMenu();
    }
  }, { passive: true });

  // Bottom sheet
  bottomSheetClose.addEventListener('click', closeBottomSheet);

  let sheetTouchStartY = 0;
  let sheetTouchCurrentY = 0;
  let isDraggingSheet = false;

  bottomSheetHandle.addEventListener('touchstart', (e) => {
    isDraggingSheet = true;
    sheetTouchStartY = e.touches[0].clientY;
    bottomSheet.style.transition = 'none';
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!isDraggingSheet) return;
    sheetTouchCurrentY = e.touches[0].clientY;
    const deltaY = sheetTouchCurrentY - sheetTouchStartY;
    if (deltaY > 0) {
      bottomSheet.style.transform = `translateY(${deltaY}px)`;
    }
  }, { passive: true });

  document.addEventListener('touchend', () => {
    if (!isDraggingSheet) return;
    isDraggingSheet = false;
    const deltaY = sheetTouchCurrentY - sheetTouchStartY;
    bottomSheet.style.transition = 'transform 0.3s ease';
    bottomSheet.style.transform = '';
    if (deltaY > 100) {
      closeBottomSheet();
    } else {
      openBottomSheet();
    }
  });

  // Mobile header search
  const mobileHeaderSearch = document.getElementById('mobileHeaderSearch');
  if (mobileHeaderSearch) {
    mobileHeaderSearch.addEventListener('input', debounce(() => {
      syncDesktopControls();
      if (mobileSemanticEnabled && mobileHeaderSearch.value.trim()) {
        // Trigger semantic search
        const semanticToggle = document.getElementById('semanticToggle');
        if (semanticToggle && !semanticToggle.classList.contains('active')) {
          semanticToggle.click();
        }
        document.getElementById('searchFilter').value = mobileHeaderSearch.value;
        applyFilters();
      } else {
        applyFilters();
      }
    }, DEBOUNCE_DELAY));
  }

  // Mobile semantic toggle
  const mobileSemanticToggle = document.getElementById('mobileSemanticToggle');
  if (mobileSemanticToggle) {
    mobileSemanticToggle.addEventListener('click', () => {
      mobileSemanticEnabled = !mobileSemanticEnabled;
      mobileSemanticToggle.classList.toggle('active', mobileSemanticEnabled);

      // Sync with desktop semantic toggle
      const desktopToggle = document.getElementById('semanticToggle');
      if (desktopToggle) {
        if (mobileSemanticEnabled !== desktopToggle.classList.contains('active')) {
          desktopToggle.click();
        }
      }

      // Update placeholder
      mobileHeaderSearch.placeholder = mobileSemanticEnabled ? 'AI Search...' : 'Search...';
    });
  }

  // Mobile menu control handlers
  const mobileTagFilter = document.getElementById('mobileTagFilter');
  if (mobileTagFilter) {
    mobileTagFilter.addEventListener('change', () => {
      syncDesktopControls();
      applyFilters();
    });
  }

  const mobileBookmarkedOnly = document.getElementById('mobileBookmarkedOnly');
  if (mobileBookmarkedOnly) {
    mobileBookmarkedOnly.addEventListener('change', () => {
      syncDesktopControls();
      applyFilters();
    });
  }

  const mobileSortBy = document.getElementById('mobileSortBy');
  if (mobileSortBy) {
    mobileSortBy.addEventListener('change', () => {
      syncDesktopControls();
      renderList(currentFiltered);
    });
  }

  const mobileResetFilter = document.getElementById('mobileResetFilter');
  if (mobileResetFilter) {
    mobileResetFilter.addEventListener('click', () => {
      document.getElementById('resetFilter')?.click();
      mobileHeaderSearch.value = '';
      mobileSemanticEnabled = false;
      mobileSemanticToggle?.classList.remove('active');
      mobileHeaderSearch.placeholder = 'Search...';
      syncMobileControls();
      closeMobileMenu();
    });
  }

  const mobileThemeToggle = document.getElementById('mobileThemeToggle');
  if (mobileThemeToggle) {
    mobileThemeToggle.addEventListener('click', () => {
      document.getElementById('themeToggle')?.click();
    });
  }

  // Window resize
  window.addEventListener('resize', debounce(() => {
    if (!isMobile()) {
      closeMobileMenu();
      closeBottomSheet();
    }
  }, 250));
}
