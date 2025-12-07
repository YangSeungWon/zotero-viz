/* ===========================================
   Detail Panel (Desktop & Mobile)
   =========================================== */

function clearSelection() {
  selectedPaper = null;
  connectedPapers = new Set();
  render(currentFiltered);
  showDefaultPanel();
}

function showDefaultPanel() {
  const panel = document.getElementById('detailPanel');
  panel.classList.add('active');
  const savedWidth = localStorage.getItem('detailPanelWidth');
  if (savedWidth) panel.style.width = savedWidth;

  // 닫기 버튼 숨기기
  document.getElementById('closeDetail').style.display = 'none';

  // 통계 계산
  const papers = currentFiltered.length > 0 ? currentFiltered : allPapers;
  const totalPapers = papers.filter(p => p.is_paper).length;
  const totalApps = papers.filter(p => !p.is_paper).length;
  const yearRange = papers.length > 0
    ? `${Math.min(...papers.map(p => p.year).filter(Boolean))} - ${Math.max(...papers.map(p => p.year).filter(Boolean))}`
    : 'N/A';

  // 클러스터별 통계
  const clusterStats = {};
  papers.forEach(p => {
    if (!clusterStats[p.cluster]) {
      clusterStats[p.cluster] = { count: 0, label: p.cluster_label || '' };
    }
    clusterStats[p.cluster].count++;
  });

  let clusterHtml = Object.entries(clusterStats)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([c, s]) => `<div class="stat-row"><span style="color: ${CLUSTER_COLORS[c % CLUSTER_COLORS.length]}">●</span> ${s.label || 'Cluster ' + c}: ${s.count}</div>`)
    .join('');

  document.getElementById('detailTitle').textContent = 'Paper Map';
  document.getElementById('detailMeta').innerHTML = `
    <div class="default-stats">
      <div class="stat-row"><strong>📄 Papers:</strong> ${totalPapers}</div>
      <div class="stat-row"><strong>💎 Apps:</strong> ${totalApps}</div>
      <div class="stat-row"><strong>📅 Years:</strong> ${yearRange}</div>
      <div class="stat-row"><strong>🔗 Citations:</strong> ${citationLinks.length}</div>
    </div>
  `;
  document.getElementById('detailLinks').innerHTML = '';
  document.getElementById('detailAbstract').innerHTML = `
    <div class="help-section">
      <h4>사용법</h4>
      <ul>
        <li>노드 <strong>클릭</strong>: 상세 정보</li>
        <li><strong>Ctrl+호버</strong>: 인용 관계 미리보기</li>
        <li><strong>더블클릭</strong>: 줌 리셋</li>
        <li>왼쪽 클러스터 클릭: 필터</li>
      </ul>
    </div>
  `;
  document.getElementById('detailNotes').innerHTML = `
    <div class="cluster-overview">
      <h4>클러스터 분포</h4>
      ${clusterHtml}
    </div>
  `;
  document.getElementById('referencesSection').style.display = 'none';
  document.getElementById('citedBySection').style.display = 'none';
  document.getElementById('similarPapers').innerHTML = '';
}

function showHoverPreview(item) {
  if (selectedPaper !== null) return; // 선택된 게 있으면 무시
  if (window.innerWidth <= MOBILE_BREAKPOINT) return;

  const panel = document.getElementById('detailPanel');
  panel.classList.add('active');

  // 닫기 버튼 숨기기 (호버 미리보기에서는)
  document.getElementById('closeDetail').style.display = 'none';

  document.getElementById('detailTitle').innerHTML = `<span style="opacity: 0.6; font-size: 12px;">미리보기</span><br>${item.title || 'Untitled'}`;

  const typeClass = item.is_paper ? 'paper' : 'app';
  const typeLabel = item.is_paper ? 'Paper' : 'App/Service';

  document.getElementById('detailMeta').innerHTML = `
    <span class="badge ${typeClass}">${typeLabel}</span>
    <span class="badge cluster">Cluster ${item.cluster}</span>
    ${item.citation_count ? `<span class="badge" style="background: #ffd70033; color: #ffd700;">${item.citation_count} cited</span>` : ''}
    <br><br>
    <span><strong>Year:</strong> ${item.year || 'N/A'}</span>
    <span><strong>Venue:</strong> ${item.venue || 'N/A'}</span>
    ${item.authors ? `<br><span><strong>Authors:</strong> ${item.authors.substring(0, 80)}${item.authors.length > 80 ? '...' : ''}</span>` : ''}
  `;

  let linksHtml = '';
  if (item.url) linksHtml += `<a href="${item.url}" target="_blank">Open URL</a>`;
  if (item.doi) linksHtml += `<a href="https://doi.org/${item.doi}" target="_blank">DOI</a>`;
  document.getElementById('detailLinks').innerHTML = linksHtml;

  const abstract = item.abstract || 'No abstract available.';
  document.getElementById('detailAbstract').textContent =
    abstract.length > 300 ? abstract.substring(0, 300) + '...' : abstract;

  document.getElementById('detailNotes').innerHTML = '';
  document.getElementById('referencesSection').style.display = 'none';
  document.getElementById('citedBySection').style.display = 'none';
  document.getElementById('similarPapers').innerHTML = '<p style="color: var(--text-muted); font-size: 12px;">클릭하여 상세 정보 보기</p>';
}

function showDetail(item) {
  // Mobile: use bottom sheet
  if (window.innerWidth <= MOBILE_BREAKPOINT) {
    showMobileDetail(item);
    return;
  }

  const panel = document.getElementById('detailPanel');
  panel.classList.add('active');
  const savedWidth = localStorage.getItem('detailPanelWidth');
  if (savedWidth) {
    panel.style.width = savedWidth;
  }

  // 닫기 버튼 표시 (선택된 논문이 있을 때)
  document.getElementById('closeDetail').style.display = 'block';

  selectedPaper = item;
  connectedPapers = new Set();

  const references = [];
  const citedBy = [];

  citationLinks.forEach(link => {
    if (link.source === item.id) {
      connectedPapers.add(link.target);
      const refPaper = allPapers.find(p => p.id === link.target);
      if (refPaper) references.push(refPaper);
    }
    if (link.target === item.id) {
      connectedPapers.add(link.source);
      const citingPaper = allPapers.find(p => p.id === link.source);
      if (citingPaper) citedBy.push(citingPaper);
    }
  });

  render(currentFiltered);

  document.getElementById('detailTitle').textContent = item.title || 'Untitled';

  const typeClass = item.is_paper ? 'paper' : 'app';
  const typeLabel = item.is_paper ? 'Paper' : 'App/Service';

  const citationBadge = item.citation_count !== null && item.citation_count !== undefined
    ? `<span class="badge" style="background: #ffd70033; color: #ffd700;">Global: ${item.citation_count}</span>`
    : '';

  const refsBadge = references.length > 0
    ? `<span class="badge" style="background: #58a6ff33; color: #58a6ff;">Refs: ${references.length}</span>`
    : '';

  const citedByBadge = citedBy.length > 0
    ? `<span class="badge" style="background: #f9731633; color: #f97316;">Cited: ${citedBy.length}</span>`
    : '';

  document.getElementById('detailMeta').innerHTML = `
    <span class="badge ${typeClass}">${typeLabel}</span>
    <span class="badge cluster">Cluster ${item.cluster}: ${item.cluster_label || ''}</span>
    ${citationBadge}
    ${refsBadge}
    ${citedByBadge}
    <br><br>
    <span><strong>Year:</strong> ${item.year || 'N/A'}</span>
    <span><strong>Venue:</strong> ${item.venue || 'N/A'}</span>
    <span><strong>Quality:</strong> ${item.venue_quality}/5</span>
    ${item.citation_count !== null ? `<span><strong>Citations:</strong> ${item.citation_count}</span>` : ''}
    ${item.authors ? `<br><span><strong>Authors:</strong> ${item.authors.substring(0, 100)}${item.authors.length > 100 ? '...' : ''}</span>` : ''}
    ${item.tags ? `<br><span><strong>Tags:</strong> ${item.tags}</span>` : ''}
  `;

  let linksHtml = '';
  if (item.url) {
    linksHtml += `<a href="${item.url}" target="_blank">Open URL</a>`;
  }
  if (item.doi) {
    linksHtml += `<a href="https://doi.org/${item.doi}" target="_blank">DOI</a>`;
  }
  document.getElementById('detailLinks').innerHTML = linksHtml;

  document.getElementById('detailAbstract').textContent =
    item.abstract || 'No abstract available.';

  const notesContent = item.notes_html || item.notes || '';
  const notesHtml = notesContent
    ? `<div class="notes"><h3>Notes</h3><div class="notes-content">${notesContent}</div></div>`
    : '';
  document.getElementById('detailNotes').innerHTML = notesHtml;

  // References 섹션
  const refsSection = document.getElementById('referencesSection');
  if (references.length > 0) {
    let refsHtml = `<h3><span class="dot" style="background: #58a6ff;"></span>References (${references.length})</h3><ul>`;
    references.forEach(p => {
      const title = p.title.length > 50 ? p.title.substring(0, 50) + '...' : p.title;
      refsHtml += `<li data-id="${p.id}">${title} <span class="year">(${p.year || 'N/A'})</span></li>`;
    });
    refsHtml += '</ul>';
    refsSection.innerHTML = refsHtml;
    refsSection.style.display = 'block';
  } else {
    refsSection.innerHTML = `<h3><span class="dot" style="background: #58a6ff;"></span>References</h3><p class="empty">No references in library</p>`;
    refsSection.style.display = 'block';
  }

  // Cited by 섹션
  const citedBySection = document.getElementById('citedBySection');
  if (citedBy.length > 0) {
    let citedHtml = `<h3><span class="dot" style="background: #f97316;"></span>Cited by (${citedBy.length})</h3><ul>`;
    citedBy.forEach(p => {
      const title = p.title.length > 50 ? p.title.substring(0, 50) + '...' : p.title;
      citedHtml += `<li data-id="${p.id}">${title} <span class="year">(${p.year || 'N/A'})</span></li>`;
    });
    citedHtml += '</ul>';
    citedBySection.innerHTML = citedHtml;
    citedBySection.style.display = 'block';
  } else {
    citedBySection.innerHTML = `<h3><span class="dot" style="background: #f97316;"></span>Cited by</h3><p class="empty">No citations in library</p>`;
    citedBySection.style.display = 'block';
  }

  // Citation 섹션 클릭 핸들러
  document.querySelectorAll('#referencesSection li, #citedBySection li').forEach(li => {
    li.addEventListener('click', () => {
      const paperId = parseInt(li.dataset.id);
      const paper = allPapers.find(p => p.id === paperId);
      if (paper) showDetail(paper);
    });
  });

  // Similar papers
  const similar = findSimilarPapers(item, allPapers, 5);
  let similarHtml = '<h3>Similar Papers</h3><ul>';
  similar.forEach(p => {
    const title = p.title.length > 50 ? p.title.substring(0, 50) + '...' : p.title;
    similarHtml += `<li data-id="${p.id}">${title} <span class="year">(${p.year || 'N/A'})</span></li>`;
  });
  similarHtml += '</ul>';
  document.getElementById('similarPapers').innerHTML = similarHtml;

  document.querySelectorAll('#similarPapers li').forEach(li => {
    li.addEventListener('click', () => {
      const paperId = parseInt(li.dataset.id);
      const paper = allPapers.find(p => p.id === paperId);
      if (paper) showDetail(paper);
    });
  });
}

function findSimilarPapers(target, papers, n = 5) {
  return papers
    .filter(p => p.id !== target.id)
    .map(p => ({
      ...p,
      distance: Math.sqrt(Math.pow(p.x - target.x, 2) + Math.pow(p.y - target.y, 2))
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, n);
}

function showMobileDetail(item) {
  selectedPaper = item;
  connectedPapers = new Set();

  const references = [];
  const citedBy = [];

  citationLinks.forEach(link => {
    if (link.source === item.id) {
      connectedPapers.add(link.target);
      const refPaper = allPapers.find(p => p.id === link.target);
      if (refPaper) references.push(refPaper);
    }
    if (link.target === item.id) {
      connectedPapers.add(link.source);
      const citingPaper = allPapers.find(p => p.id === link.source);
      if (citingPaper) citedBy.push(citingPaper);
    }
  });

  render(currentFiltered);

  document.getElementById('mobileDetailTitle').textContent = item.title || 'Untitled';

  const typeClass = item.is_paper ? 'paper' : 'app';
  const typeLabel = item.is_paper ? 'Paper' : 'App';

  document.getElementById('mobileDetailMeta').innerHTML = `
    <span class="badge ${typeClass}">${typeLabel}</span>
    <span class="badge cluster">C${item.cluster}</span>
    ${item.citation_count ? `<span class="badge" style="background: #ffd70033; color: #ffd700;">${item.citation_count} cited</span>` : ''}
    <br><br>
    <span><strong>Year:</strong> ${item.year || 'N/A'}</span>
    <span><strong>Venue:</strong> ${item.venue || 'N/A'}</span>
    ${item.authors ? `<br><span style="font-size: 11px;"><strong>Authors:</strong> ${item.authors.substring(0, 60)}${item.authors.length > 60 ? '...' : ''}</span>` : ''}
  `;

  let linksHtml = '';
  if (item.url) linksHtml += `<a href="${item.url}" target="_blank">Open</a>`;
  if (item.doi) linksHtml += `<a href="https://doi.org/${item.doi}" target="_blank">DOI</a>`;
  document.getElementById('mobileDetailLinks').innerHTML = linksHtml;

  document.getElementById('mobileDetailAbstract').textContent =
    item.abstract || 'No abstract available.';

  const notesContent = item.notes_html || item.notes || '';
  document.getElementById('mobileDetailNotes').innerHTML = notesContent
    ? `<div class="notes"><h3>Notes</h3><div class="notes-content">${notesContent}</div></div>`
    : '';

  // References
  const refsSection = document.getElementById('mobileReferencesSection');
  if (references.length > 0) {
    let html = `<h3><span class="dot" style="background: #58a6ff;"></span>References (${references.length})</h3><ul>`;
    references.slice(0, 5).forEach(p => {
      const title = p.title.length > 35 ? p.title.substring(0, 35) + '...' : p.title;
      html += `<li data-id="${p.id}">${title} <span class="year">(${p.year || 'N/A'})</span></li>`;
    });
    if (references.length > 5) html += `<li style="color: var(--text-muted);">+${references.length - 5} more</li>`;
    html += '</ul>';
    refsSection.innerHTML = html;
    refsSection.style.display = 'block';
  } else {
    refsSection.style.display = 'none';
  }

  // Cited by
  const citedBySection = document.getElementById('mobileCitedBySection');
  if (citedBy.length > 0) {
    let html = `<h3><span class="dot" style="background: #f97316;"></span>Cited by (${citedBy.length})</h3><ul>`;
    citedBy.slice(0, 5).forEach(p => {
      const title = p.title.length > 35 ? p.title.substring(0, 35) + '...' : p.title;
      html += `<li data-id="${p.id}">${title} <span class="year">(${p.year || 'N/A'})</span></li>`;
    });
    if (citedBy.length > 5) html += `<li style="color: var(--text-muted);">+${citedBy.length - 5} more</li>`;
    html += '</ul>';
    citedBySection.innerHTML = html;
    citedBySection.style.display = 'block';
  } else {
    citedBySection.style.display = 'none';
  }

  // Similar
  const similar = findSimilarPapers(item, allPapers, 3);
  let similarHtml = '<h3>Similar</h3><ul>';
  similar.forEach(p => {
    const title = p.title.length > 35 ? p.title.substring(0, 35) + '...' : p.title;
    similarHtml += `<li data-id="${p.id}">${title} <span class="year">(${p.year || 'N/A'})</span></li>`;
  });
  similarHtml += '</ul>';
  document.getElementById('mobileSimilarPapers').innerHTML = similarHtml;

  // Click handlers
  document.querySelectorAll('#bottomSheetContent li[data-id]').forEach(li => {
    li.addEventListener('click', () => {
      const paperId = parseInt(li.dataset.id);
      const paper = allPapers.find(p => p.id === paperId);
      if (paper) showMobileDetail(paper);
    });
  });

  openBottomSheet();
}
