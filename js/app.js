/* ===========================================
   Main Application Logic
   =========================================== */

async function loadData() {
  try {
    const resp = await fetch('papers.json');
  const data = await resp.json();

  // 새 포맷 (papers 배열 + centroids) vs 기존 포맷 (배열만)
  if (data.papers) {
    allPapers = data.papers;
    clusterCentroids = data.cluster_centroids || {};
    clusterLabels = data.cluster_labels || {};
    citationLinks = data.citation_links || [];
    dataMeta = data.meta || {};
  } else {
    allPapers = data;
  }

  // 로컬 스토리지에서 커스텀 라벨 로드
  const customLabels = JSON.parse(localStorage.getItem('customClusterLabels') || '{}');
  Object.assign(clusterLabels, customLabels);

  // Populate tag filter
  const tagFilterEl = document.getElementById('tagFilter');
  const allTags = new Set();
  allPapers.forEach(p => {
    if (p.tags) {
      // tags는 "tag1; tag2; tag3" 또는 "tag1, tag2" 형식일 수 있음
      p.tags.split(/[;,]/).forEach(t => {
        const tag = t.trim();
        if (tag) allTags.add(tag);
      });
    }
  });
  [...allTags].sort().forEach(tag => {
    const opt = document.createElement('option');
    opt.value = tag;
    opt.textContent = tag;
    tagFilterEl.appendChild(opt);
  });

  // Populate cluster filter with labels
  const clusters = [...new Set(allPapers.map(p => p.cluster))].sort((a,b) => a-b);
  const intersect1 = document.getElementById('intersectCluster1');
  const intersect2 = document.getElementById('intersectCluster2');
  const clusterListEl = document.getElementById('clusterList');

  clusters.forEach(c => {
    const sample = allPapers.find(p => p.cluster === c);
    const label = clusterLabels[c] || sample?.cluster_label || '';
    const count = allPapers.filter(p => p.cluster === c).length;

    // 교차점 선택 1
    const opt1 = document.createElement('option');
    opt1.value = c;
    opt1.textContent = `${c}: ${label.substring(0, 20)}`;
    intersect1.appendChild(opt1);

    // 교차점 선택 2
    const opt2 = document.createElement('option');
    opt2.value = c;
    opt2.textContent = `${c}: ${label.substring(0, 20)}`;
    intersect2.appendChild(opt2);

    // 클러스터 패널 아이템
    const item = document.createElement('div');
    item.className = 'cluster-item';
    item.dataset.cluster = c;
    item.innerHTML = `
      <div class="dot" style="background: ${CLUSTER_COLORS[c % CLUSTER_COLORS.length]}"></div>
      <div class="label" title="더블클릭으로 편집">${label || 'Cluster ' + c}</div>
      <div class="count">${count}</div>
      <button class="stats-btn" title="클러스터 통계">📊</button>
    `;

    // 통계 버튼 클릭
    item.querySelector('.stats-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      showClusterStats(c, e);
    });

    item.addEventListener('click', () => {
      if (highlightCluster === c) {
        highlightCluster = null;
        item.classList.remove('active');
      } else {
        document.querySelectorAll('.cluster-item').forEach(el => el.classList.remove('active'));
        highlightCluster = c;
        item.classList.add('active');
      }
      render(currentFiltered);
    });

    // 더블클릭으로 라벨 편집
    const labelEl = item.querySelector('.label');
    labelEl.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      const currentLabel = clusterLabels[c] || '';
      const newLabel = prompt(`클러스터 ${c} 라벨 편집:`, currentLabel);
      if (newLabel !== null && newLabel !== currentLabel) {
        clusterLabels[c] = newLabel;
        labelEl.textContent = newLabel || 'Cluster ' + c;
        // 로컬 스토리지에 저장
        const customLabels = JSON.parse(localStorage.getItem('customClusterLabels') || '{}');
        customLabels[c] = newLabel;
        localStorage.setItem('customClusterLabels', JSON.stringify(customLabels));
        // 논문 데이터의 cluster_label도 업데이트
        allPapers.forEach(p => {
          if (p.cluster === c) p.cluster_label = newLabel;
        });
      }
    });

    clusterListEl.appendChild(item);
  });

  currentFiltered = [...allPapers];
  render(currentFiltered);
  updateStats(currentFiltered);

  // Initialize mobile components
  const mobileTagFilter = document.getElementById('mobileTagFilter');
  if (mobileTagFilter) {
    [...allTags].sort().forEach(tag => {
      const opt = document.createElement('option');
      opt.value = tag;
      opt.textContent = tag;
      mobileTagFilter.appendChild(opt);
    });
  }
  populateMobileClusterChips();
} catch (e) {
  document.getElementById('stats').textContent = 'Error loading papers.json';
  console.error(e);
}
    }

    function filterPapers() {
const minYear = parseInt(document.getElementById('minYear').value) || 0;
const minVenue = parseFloat(document.getElementById('minVenue').value) || 0;
const papersOnly = document.getElementById('papersOnly').checked;
const tagFilter = document.getElementById('tagFilter').value;
const searchFilter = document.getElementById('searchFilter').value.toLowerCase().trim();

return allPapers.filter(p => {
  if (p.year && p.year < minYear) return false;
  if (p.venue_quality < minVenue) return false;
  if (papersOnly && !p.is_paper) return false;
  if (tagFilter) {
    const paperTags = (p.tags || '').split(/[;,]/).map(t => t.trim().toLowerCase());
    if (!paperTags.includes(tagFilter.toLowerCase())) return false;
  }
  if (searchFilter) {
    const searchText = `${p.title} ${p.authors || ''} ${p.abstract} ${p.notes || ''}`.toLowerCase();
    if (!searchText.includes(searchFilter)) return false;
  }
  return true;
});
    }

    function updateStats(papers) {
const paperCount = papers.filter(p => p.is_paper).length;
const appCount = papers.filter(p => !p.is_paper).length;
document.getElementById('stats').textContent =
  `${papers.length} items (${paperCount} papers, ${appCount} apps/services)`;
    }

    function render(filteredPapers) {
// highlight 모드면 전체 논문 표시, filter 모드면 필터된 것만
const papers = filterMode === 'highlight' ? allPapers : filteredPapers;
const filteredIds = new Set(filteredPapers.map(p => p.id));

// Separate papers and apps
const paperItems = papers.filter(p => p.is_paper);
const appItems = papers.filter(p => !p.is_paper);

// opacity 계산 함수
function getOpacity(p, baseOpacity) {
  // 선택된 논문이 있으면 - 전체 맵 보이게, 살짝만 강조
  if (selectedPaper !== null) {
    if (p.id === selectedPaper.id) return 1;
    if (connectedPapers.has(p.id)) return 0.9;
    return 0.5;  // 나머지도 반 정도 보이게
  }
  // 클러스터 하이라이트가 있으면 그것 우선
  if (highlightCluster !== null) {
    return p.cluster === highlightCluster ? 1 : 0.15;
  }
  // highlight 모드에서 필터 매칭 여부
  if (filterMode === 'highlight') {
    return filteredIds.has(p.id) ? baseOpacity : 0.15;
  }
  return baseOpacity;
}

// 내부 인용수 계산 (우리 DB 내에서 이 논문을 인용한 횟수)
const myS2Ids = new Set(papers.map(p => p.s2_id).filter(Boolean));
const s2IdToInternal = {};
papers.forEach(p => {
  if (p.s2_id) {
    // 이 논문을 인용한 논문들 중 우리 DB에 있는 것 수
    const internalCiteCount = (p.citations || []).filter(citeId => myS2Ids.has(citeId)).length;
    s2IdToInternal[p.id] = internalCiteCount;
  }
});

// 마커 크기 - 전체 피인용수
function getSize(p) {
  const baseSize = 12;
  const citationBonus = p.citation_count ? Math.log10(p.citation_count + 1) * 6 : 0;
  return baseSize + citationBonus;
}

// 내부 원 크기 - 내부 인용수
function getInternalSize(p) {
  const internalCount = s2IdToInternal[p.id] || 0;
  if (internalCount === 0) return 0;
  return 3 + Math.log10(internalCount + 1) * 5;
}

// 선택된 논문 테두리
function getLineWidth(p) {
  if (selectedPaper !== null && p.id === selectedPaper.id) return 4;
  if (selectedPaper !== null && connectedPapers.has(p.id)) return 3;
  return 1;
}

function getLineColor(p) {
  if (selectedPaper !== null && p.id === selectedPaper.id) return '#ffd700';
  if (selectedPaper !== null && connectedPapers.has(p.id)) return '#ff6b6b';
  return '#0d1117';
}

// 단어 단위 줄바꿈 함수
function wrapText(text, maxLen = 25) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length <= maxLen) {
      line = (line + ' ' + word).trim();
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.join('<br>');
}

// 노트 첫 문단 추출
function getFirstParagraph(notes, maxLen = 100) {
  if (!notes) return '';
  // 첫 문단 (빈 줄 전까지)
  const para = notes.split(/\n\s*\n/)[0].trim();
  if (para.length > maxLen) {
    return para.substring(0, maxLen) + '...';
  }
  return para;
}

// Papers trace (circles)
const paperTrace = {
  x: paperItems.map(p => p.x),
  y: paperItems.map(p => p.y),
  text: paperItems.map(p => {
    const wrappedTitle = wrapText(p.title || '', 28);
    const firstNote = getFirstParagraph(p.notes);
    const notePreview = firstNote ? `<br><br><i>"${wrapText(firstNote, 28)}"</i>` : '';
    return `<b>${wrappedTitle}</b><br><br>` +
      `${p.year || 'N/A'}<br>` +
      `${(p.venue || '').substring(0, 30)}<br>` +
      `Cluster ${p.cluster}` +
      notePreview;
  }),
  customdata: paperItems,
  mode: 'markers',
  type: 'scatter',
  name: 'Papers',
  marker: {
    size: paperItems.map(p => getSize(p)),
    color: paperItems.map(p => CLUSTER_COLORS[p.cluster % CLUSTER_COLORS.length]),
    opacity: paperItems.map(p => getOpacity(p, 0.8)),
    line: {
      width: paperItems.map(p => getLineWidth(p)),
      color: paperItems.map(p => getLineColor(p))
    }
  },
  hovertemplate: '%{text}<extra></extra>'
};

// 내부 인용 표시 (진한 안쪽 원)
const internalItems = paperItems.filter(p => getInternalSize(p) > 0);
const innerPaperTrace = {
  x: internalItems.map(p => p.x),
  y: internalItems.map(p => p.y),
  text: internalItems.map(p => {
    const internalCount = s2IdToInternal[p.id] || 0;
    return `내부 인용: ${internalCount}`;
  }),
  mode: 'markers',
  type: 'scatter',
  name: 'Internal Citations',
  showlegend: false,
  marker: {
    size: internalItems.map(p => getInternalSize(p)),
    color: '#1a1a2e',  // 진한 어두운 색
    opacity: internalItems.map(p => getOpacity(p, 0.95)),
    line: { width: 0 }
  },
  hoverinfo: 'text'
};

// Apps trace (diamonds)
const appTrace = {
  x: appItems.map(p => p.x),
  y: appItems.map(p => p.y),
  text: appItems.map(p => {
    const wrappedTitle = wrapText(p.title || '', 28);
    return `<b>${wrappedTitle}</b><br><br>` +
      `App/Service<br>` +
      `Cluster ${p.cluster}`;
  }),
  customdata: appItems,
  mode: 'markers',
  type: 'scatter',
  name: 'Apps/Services',
  marker: {
    size: 14,
    symbol: 'diamond',
    color: appItems.map(p => CLUSTER_COLORS[p.cluster % CLUSTER_COLORS.length]),
    opacity: appItems.map(p => getOpacity(p, 0.9)),
    line: { width: 2, color: '#bc8cff' }
  },
  hovertemplate: '%{text}<extra></extra>'
};

const isLight = document.documentElement.dataset.theme === 'light';
const colors = isLight ? {
  bg: '#ffffff', grid: '#eaeef2', zero: '#d0d7de', text: '#656d76'
} : {
  bg: '#0d1117', grid: '#21262d', zero: '#30363d', text: '#8b949e'
};

const layout = {
  margin: { l: 40, r: 20, t: 20, b: 40 },
  paper_bgcolor: colors.bg,
  plot_bgcolor: colors.bg,
  xaxis: {
    title: '',
    showgrid: true,
    gridcolor: colors.grid,
    zerolinecolor: colors.zero,
    tickfont: { color: colors.text }
  },
  yaxis: {
    title: '',
    showgrid: true,
    gridcolor: colors.grid,
    zerolinecolor: colors.zero,
    tickfont: { color: colors.text }
  },
  showlegend: false,
  hovermode: 'closest'
};

const config = {
  responsive: true,
  displayModeBar: true,
  modeBarButtonsToRemove: ['lasso2d', 'select2d']
};

// 인용 관계 선 추가 (노드보다 먼저 그려서 노드가 위에 오도록)
const traces = [];

if (showCitations && citationLinks.length > 0) {
  // 현재 필터된 논문들의 ID 맵
  const visibleIds = new Set(papers.map(p => p.id));
  const idToPos = {};
  papers.forEach(p => { idToPos[p.id] = { x: p.x, y: p.y }; });

  // 필터된 논문들 사이의 인용 관계만 표시
  const relevantLinks = citationLinks.filter(
    link => visibleIds.has(link.source) && visibleIds.has(link.target)
  );

  // 선택된 논문이 있으면 관련 링크만 색상 구분
  if (selectedPaper !== null) {
    // References (내가 인용한 것) - 파란색
    const refLinks = relevantLinks.filter(link => link.source === selectedPaper.id);
    // Cited by (나를 인용한 것) - 주황색
    const citedByLinks = relevantLinks.filter(link => link.target === selectedPaper.id);
    // 나머지 - 회색
    const otherLinks = relevantLinks.filter(
      link => link.source !== selectedPaper.id && link.target !== selectedPaper.id
    );

    // 나머지 링크 (희미하게)
    otherLinks.forEach(link => {
      const source = idToPos[link.source];
      const target = idToPos[link.target];
      if (source && target) {
        traces.push({
          x: [source.x, target.x],
          y: [source.y, target.y],
          mode: 'lines',
          type: 'scatter',
          line: { color: 'rgba(128, 128, 128, 0.1)', width: 1 },
          hoverinfo: 'none',
          showlegend: false
        });
      }
    });

    // References (파란색, 두껍게)
    refLinks.forEach(link => {
      const source = idToPos[link.source];
      const target = idToPos[link.target];
      if (source && target) {
        traces.push({
          x: [source.x, target.x],
          y: [source.y, target.y],
          mode: 'lines',
          type: 'scatter',
          line: { color: 'rgba(88, 166, 255, 0.8)', width: 2 },
          hoverinfo: 'none',
          showlegend: false
        });
      }
    });

    // Cited by (주황색, 두껍게)
    citedByLinks.forEach(link => {
      const source = idToPos[link.source];
      const target = idToPos[link.target];
      if (source && target) {
        traces.push({
          x: [source.x, target.x],
          y: [source.y, target.y],
          mode: 'lines',
          type: 'scatter',
          line: { color: 'rgba(249, 115, 22, 0.8)', width: 2 },
          hoverinfo: 'none',
          showlegend: false
        });
      }
    });
  } else {
    // 선택 없으면 전체 표시 (기존 색상)
    relevantLinks.forEach(link => {
      const source = idToPos[link.source];
      const target = idToPos[link.target];
      if (source && target) {
        traces.push({
          x: [source.x, target.x],
          y: [source.y, target.y],
          mode: 'lines',
          type: 'scatter',
          line: { color: 'rgba(255, 165, 0, 0.3)', width: 1 },
          hoverinfo: 'none',
          showlegend: false
        });
      }
    });
  }
}

// 노드는 선 위에 그리기
traces.push(paperTrace, innerPaperTrace, appTrace);

const plotDiv = document.getElementById('plot');

Plotly.newPlot(plotDiv, traces, layout, config).then(function() {
  plotDiv.on('plotly_click', function(data) {
    if (data.points && data.points[0] && data.points[0].customdata) {
      showDetail(data.points[0].customdata);
    }
  });

  // 빈 곳 더블클릭하면 선택 해제
  plotDiv.on('plotly_doubleclick', function() {
    clearSelection();
  });
});
    }

    function clearSelection() {
selectedPaper = null;
connectedPapers = new Set();
const panel = document.getElementById('detailPanel');
panel.classList.remove('active');
panel.style.width = '';  // 인라인 스타일 제거
setTimeout(() => Plotly.Plots.resize('plot'), 10);
render(currentFiltered);
    }

    function showDetail(item) {
// Mobile: use bottom sheet
if (window.innerWidth <= 768) {
  showMobileDetail(item);
  return;
}

const panel = document.getElementById('detailPanel');
panel.classList.add('active');
// 저장된 너비 적용
const savedWidth = localStorage.getItem('detailPanelWidth');
if (savedWidth) {
  panel.style.width = savedWidth;
}
setTimeout(() => Plotly.Plots.resize('plot'), 10);

// 선택된 논문과 연결된 논문들 설정
selectedPaper = item;
connectedPapers = new Set();

// References (이 논문이 인용한 것) 와 Cited by (이 논문을 인용한 것) 분리
const references = [];  // source = this paper
const citedBy = [];     // target = this paper

// citation links에서 연결된 논문 찾기
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

// 맵 다시 렌더링
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

// 노트 표시 (HTML 서식 유지)
const notesContent = item.notes_html || item.notes || '';
const notesHtml = notesContent
  ? `<div class="notes"><h3>Notes</h3><div class="notes-content">${notesContent}</div></div>`
  : '';
document.getElementById('detailNotes').innerHTML = notesHtml;

// References 섹션 (이 논문이 인용한 것) - 파란색
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

// Cited by 섹션 (이 논문을 인용한 것) - 주황색
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

// Find similar papers (closest by x,y coordinates)
const similar = findSimilarPapers(item, allPapers, 5);
let similarHtml = '<h3>Similar Papers</h3><ul>';
similar.forEach(p => {
  const title = p.title.length > 50 ? p.title.substring(0, 50) + '...' : p.title;
  similarHtml += `<li data-id="${p.id}">${title} <span class="year">(${p.year || 'N/A'})</span></li>`;
});
similarHtml += '</ul>';
document.getElementById('similarPapers').innerHTML = similarHtml;

// Click handler for similar papers
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

    // 클러스터 통계 표시
    let statsTooltip = null;
    function showClusterStats(clusterId, event) {
// 기존 툴팁 제거
if (statsTooltip) {
  statsTooltip.remove();
  statsTooltip = null;
}

const papers = allPapers.filter(p => p.cluster === clusterId);
if (papers.length === 0) return;

// 통계 계산
const years = papers.map(p => p.year).filter(y => y);
const citations = papers.map(p => p.citation_count).filter(c => c !== null && c !== undefined);
const venues = {};
papers.forEach(p => {
  if (p.venue) {
    const v = p.venue.substring(0, 30);
    venues[v] = (venues[v] || 0) + 1;
  }
});
const topVenues = Object.entries(venues)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 3);

const minYear = years.length ? Math.min(...years) : 'N/A';
const maxYear = years.length ? Math.max(...years) : 'N/A';
const avgYear = years.length ? Math.round(years.reduce((a, b) => a + b, 0) / years.length) : 'N/A';
const avgCitations = citations.length ? Math.round(citations.reduce((a, b) => a + b, 0) / citations.length) : 'N/A';
const maxCitations = citations.length ? Math.max(...citations) : 'N/A';
const withNotes = papers.filter(p => p.has_notes).length;

// 툴팁 생성
statsTooltip = document.createElement('div');
statsTooltip.className = 'cluster-stats-tooltip';
statsTooltip.innerHTML = `
  <h4>📊 Cluster ${clusterId}: ${clusterLabels[clusterId] || ''}</h4>
  <div class="stat-row">
    <span class="stat-label">논문 수</span>
    <span class="stat-value">${papers.length}</span>
  </div>
  <div class="stat-row">
    <span class="stat-label">연도 범위</span>
    <span class="stat-value">${minYear} - ${maxYear}</span>
  </div>
  <div class="stat-row">
    <span class="stat-label">평균 연도</span>
    <span class="stat-value">${avgYear}</span>
  </div>
  <div class="stat-row">
    <span class="stat-label">평균 인용수</span>
    <span class="stat-value">${avgCitations}</span>
  </div>
  <div class="stat-row">
    <span class="stat-label">최대 인용수</span>
    <span class="stat-value">${maxCitations}</span>
  </div>
  <div class="stat-row">
    <span class="stat-label">노트 있음</span>
    <span class="stat-value">${withNotes} / ${papers.length}</span>
  </div>
  ${topVenues.length > 0 ? `
    <div class="top-venues">
      <span class="stat-label">주요 Venues:</span>
      ${topVenues.map(([v, c]) => `<div class="venue-item">• ${v} (${c})</div>`).join('')}
    </div>
  ` : ''}
`;

document.body.appendChild(statsTooltip);

// 위치 설정
const rect = event.target.getBoundingClientRect();
let left = rect.right + 10;
let top = rect.top;

// 화면 밖으로 나가면 조정
if (left + 280 > window.innerWidth) {
  left = rect.left - 290;
}
if (top + 300 > window.innerHeight) {
  top = window.innerHeight - 310;
}

statsTooltip.style.left = left + 'px';
statsTooltip.style.top = top + 'px';

// 외부 클릭 시 닫기
setTimeout(() => {
  document.addEventListener('click', closeStatsTooltip);
}, 10);
    }

    function closeStatsTooltip(e) {
if (statsTooltip && !statsTooltip.contains(e.target)) {
  statsTooltip.remove();
  statsTooltip = null;
  document.removeEventListener('click', closeStatsTooltip);
}
    }

    function findIntersectionPapers(cluster1, cluster2, threshold = 0.3) {
// 두 클러스터의 중심점 가져오기
const c1 = clusterCentroids[cluster1];
const c2 = clusterCentroids[cluster2];

if (!c1 || !c2) {
  // centroids가 없으면 papers에서 직접 계산
  const c1Papers = allPapers.filter(p => p.cluster === cluster1);
  const c2Papers = allPapers.filter(p => p.cluster === cluster2);

  const centroid1 = {
    x: c1Papers.reduce((s, p) => s + p.x, 0) / c1Papers.length,
    y: c1Papers.reduce((s, p) => s + p.y, 0) / c1Papers.length
  };
  const centroid2 = {
    x: c2Papers.reduce((s, p) => s + p.x, 0) / c2Papers.length,
    y: c2Papers.reduce((s, p) => s + p.y, 0) / c2Papers.length
  };

  return findPapersNearBothCentroids(centroid1, centroid2, threshold);
}

return findPapersNearBothCentroids(c1, c2, threshold);
    }

    function findPapersNearBothCentroids(c1, c2, threshold) {
// 두 중심점 사이의 거리
const distBetween = Math.sqrt(Math.pow(c2.x - c1.x, 2) + Math.pow(c2.y - c1.y, 2));

// 각 논문에서 두 중심점까지의 거리 계산
return allPapers
  .map(p => {
    const d1 = Math.sqrt(Math.pow(p.x - c1.x, 2) + Math.pow(p.y - c1.y, 2));
    const d2 = Math.sqrt(Math.pow(p.x - c2.x, 2) + Math.pow(p.y - c2.y, 2));
    // 두 거리의 합이 두 중심점 거리의 (1 + threshold) 배 이내면 "교차점"
    // 즉, 두 클러스터 사이 경로에 가까운 논문들
    const ratio = (d1 + d2) / distBetween;
    return { ...p, intersectionScore: ratio, d1, d2 };
  })
  .filter(p => p.intersectionScore <= 1 + threshold)
  .sort((a, b) => a.intersectionScore - b.intersectionScore);
    }

    // 필터 상태 표시
    const filterStatus = document.getElementById('filterStatus');
    let statusTimer = null;

    function showFilterStatus(status) {
filterStatus.className = 'filter-status ' + status;
filterStatus.textContent = status === 'updating' ? '⏳' : '✓';

if (status === 'done') {
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    filterStatus.className = 'filter-status';
    filterStatus.textContent = '';
  }, 800);
}
    }

    // 필터 즉시 적용 함수
    function applyFilters() {
currentFiltered = filterPapers();
render(currentFiltered);
updateStats(currentFiltered);
showFilterStatus('done');
    }

    // Debounce 함수
    function debounce(fn, delay) {
let timer = null;
return function(...args) {
  showFilterStatus('updating');
  clearTimeout(timer);
  timer = setTimeout(() => fn.apply(this, args), delay);
};
    }

    const debouncedApplyFilters = debounce(applyFilters, 200);

    // Event handlers - 필터 변경 시 즉시 적용
    document.getElementById('minYear').addEventListener('change', applyFilters);
    document.getElementById('minVenue').addEventListener('change', applyFilters);
    document.getElementById('papersOnly').addEventListener('change', applyFilters);
    document.getElementById('tagFilter').addEventListener('change', applyFilters);
    document.getElementById('searchFilter').addEventListener('input', debouncedApplyFilters);

    document.getElementById('resetFilter').addEventListener('click', () => {
document.getElementById('minYear').value = '1990';
document.getElementById('minVenue').value = '0';
document.getElementById('papersOnly').checked = false;
document.getElementById('tagFilter').value = '';
document.getElementById('searchFilter').value = '';
document.getElementById('intersectCluster1').value = '';
document.getElementById('intersectCluster2').value = '';
document.getElementById('showCitations').checked = true;
showCitations = true;
highlightCluster = null;
filterMode = 'highlight';
document.querySelectorAll('.mode-option').forEach(o => o.classList.remove('active'));
document.querySelector('.mode-option[data-mode="highlight"]').classList.add('active');
document.querySelectorAll('.cluster-item').forEach(el => el.classList.remove('active'));
selectedPaper = null;
connectedPapers = new Set();
document.getElementById('detailPanel').classList.remove('active');
currentFiltered = [...allPapers];
render(currentFiltered);
updateStats(currentFiltered);
    });

    document.getElementById('showCitations').addEventListener('change', (e) => {
showCitations = e.target.checked;
render(currentFiltered);
    });

    // Mode toggle
    document.querySelectorAll('.mode-option').forEach(opt => {
opt.addEventListener('click', () => {
  filterMode = opt.dataset.mode;
  document.querySelectorAll('.mode-option').forEach(o => o.classList.remove('active'));
  opt.classList.add('active');
  render(currentFiltered);
});
    });
    // 초기 상태 설정
    document.querySelector(`.mode-option[data-mode="${filterMode}"]`).classList.add('active');

    document.getElementById('findIntersection').addEventListener('click', () => {
const c1 = document.getElementById('intersectCluster1').value;
const c2 = document.getElementById('intersectCluster2').value;

if (!c1 || !c2) {
  alert('두 클러스터를 선택하세요');
  return;
}
if (c1 === c2) {
  alert('서로 다른 클러스터를 선택하세요');
  return;
}

const intersectionPapers = findIntersectionPapers(parseInt(c1), parseInt(c2));
if (intersectionPapers.length === 0) {
  alert('교차점 논문이 없습니다');
  return;
}

currentFiltered = intersectionPapers;
render(currentFiltered);
updateStats(currentFiltered);

// 클러스터 라벨 표시
const label1 = clusterLabels[c1] || '';
const label2 = clusterLabels[c2] || '';
document.getElementById('stats').textContent +=
  ` | Intersection: C${c1} ↔ C${c2}`;
    });

    // Theme toggle (dark → light → auto)
    const themeToggle = document.getElementById('themeToggle');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

    function applyTheme(theme) {
const html = document.documentElement;
if (theme === 'auto') {
  html.dataset.theme = systemDark.matches ? '' : 'light';
  themeToggle.textContent = '🔄';
  themeToggle.title = 'Theme: Auto (System)';
} else if (theme === 'light') {
  html.dataset.theme = 'light';
  themeToggle.textContent = '☀️';
  themeToggle.title = 'Theme: Light';
} else {
  html.dataset.theme = '';
  themeToggle.textContent = '🌙';
  themeToggle.title = 'Theme: Dark';
}
    }

    themeToggle.addEventListener('click', () => {
const savedTheme = localStorage.getItem('theme') || 'auto';
let nextTheme;
if (savedTheme === 'auto') nextTheme = 'dark';
else if (savedTheme === 'dark') nextTheme = 'light';
else nextTheme = 'auto';

localStorage.setItem('theme', nextTheme);
applyTheme(nextTheme);
render(currentFiltered);
    });

    // 시스템 테마 변경 감지
    systemDark.addEventListener('change', () => {
if (localStorage.getItem('theme') === 'auto') {
  applyTheme('auto');
  render(currentFiltered);
}
    });

    // Load saved theme (default: auto)
    const savedTheme = localStorage.getItem('theme') || 'auto';
    applyTheme(savedTheme);

    // 사이드패널 닫기 버튼
    document.getElementById('closeDetail').addEventListener('click', clearSelection);

    // 클러스터 패널 접기/펼치기
    const clusterPanel = document.getElementById('clusterPanel');
    if (localStorage.getItem('clusterCollapsed') === 'true') {
clusterPanel.classList.add('collapsed');
    }

    document.getElementById('collapseCluster').addEventListener('click', () => {
clusterPanel.classList.toggle('collapsed');
localStorage.setItem('clusterCollapsed', clusterPanel.classList.contains('collapsed'));
setTimeout(() => Plotly.Plots.resize('plot'), 250);
    });

    // 사이드패널 리사이즈
    const resizeHandle = document.getElementById('resizeHandle');
    const detailPanel = document.getElementById('detailPanel');
    let isResizing = false;

    resizeHandle.addEventListener('mousedown', (e) => {
isResizing = true;
resizeHandle.classList.add('dragging');
document.body.style.cursor = 'ew-resize';
document.body.style.userSelect = 'none';
e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
if (!isResizing) return;
const newWidth = window.innerWidth - e.clientX;
if (newWidth >= 250 && newWidth <= 600) {
  detailPanel.style.width = newWidth + 'px';
  Plotly.Plots.resize('plot');
}
    });

    document.addEventListener('mouseup', () => {
if (isResizing) {
  isResizing = false;
  resizeHandle.classList.remove('dragging');
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  // 너비 저장
  localStorage.setItem('detailPanelWidth', detailPanel.style.width);
}
    });

    // Missing papers modal
    const missingModal = document.getElementById('missingModal');
    const missingList = document.getElementById('missingList');

    // Copy clusters: 클러스터별 논문 목록 복사
    document.getElementById('copyClusters').addEventListener('click', async () => {
const clusters = [...new Set(allPapers.map(p => p.cluster))].sort((a, b) => a - b);

let text = `# 논문 라이브러리 클러스터 구조\n`;
text += `총 ${allPapers.length}개 논문, ${clusters.length}개 클러스터\n\n`;

clusters.forEach(c => {
  const clusterPapers = allPapers.filter(p => p.cluster === c);
  const label = clusterLabels[c] || `Cluster ${c}`;

  text += `## Cluster ${c}: ${label} (${clusterPapers.length}편)\n`;
  clusterPapers.forEach(p => {
    const year = p.year || 'N/A';
    const venue = p.venue ? ` - ${p.venue.substring(0, 30)}` : '';
    text += `- ${p.title} (${year})${venue}\n`;
  });
  text += '\n';
});

try {
  await navigator.clipboard.writeText(text);
  const btn = document.getElementById('copyClusters');
  const orig = btn.textContent;
  btn.textContent = '✅ Copied!';
  setTimeout(() => btn.textContent = orig, 1500);
} catch (e) {
  alert('복사 실패: ' + e.message);
}
    });

    // Copy filtered: 필터된 논문 정보+노트 복사
    document.getElementById('copyFiltered').addEventListener('click', async () => {
const papers = currentFiltered;

let text = `# 논문 목록 (${papers.length}편)\n\n`;

papers.forEach((p, i) => {
  text += `## ${i + 1}. ${p.title}\n`;
  text += `- **Year**: ${p.year || 'N/A'}\n`;
  text += `- **Authors**: ${p.authors || 'N/A'}\n`;
  text += `- **Venue**: ${p.venue || 'N/A'}\n`;
  text += `- **Cluster**: ${p.cluster} (${clusterLabels[p.cluster] || ''})\n`;
  if (p.citation_count) text += `- **Citations**: ${p.citation_count}\n`;
  if (p.doi) text += `- **DOI**: ${p.doi}\n`;
  if (p.tags && p.tags !== 'nan') text += `- **Tags**: ${p.tags}\n`;

  if (p.abstract) {
    text += `\n**Abstract**:\n${p.abstract}\n`;
  }

  if (p.notes) {
    text += `\n**Notes**:\n${p.notes}\n`;
  }

  text += '\n---\n\n';
});

try {
  await navigator.clipboard.writeText(text);
  const btn = document.getElementById('copyFiltered');
  const orig = btn.textContent;
  btn.textContent = '✅ Copied!';
  setTimeout(() => btn.textContent = orig, 1500);
} catch (e) {
  alert('복사 실패: ' + e.message);
}
    });

    // Global stats: 전체 통계
    document.getElementById('showGlobalStats').addEventListener('click', () => {
// 기본 통계
const papers = allPapers.filter(p => p.is_paper);
const apps = allPapers.filter(p => !p.is_paper);
const years = papers.map(p => p.year).filter(y => y);
const citations = papers.map(p => p.citation_count).filter(c => c !== null && c !== undefined);
const withNotes = allPapers.filter(p => p.has_notes).length;

// 클러스터별 개수
const clusterCounts = {};
allPapers.forEach(p => {
  clusterCounts[p.cluster] = (clusterCounts[p.cluster] || 0) + 1;
});

// 연도 분포
const yearCounts = {};
years.forEach(y => {
  const decade = Math.floor(y / 5) * 5;  // 5년 단위
  yearCounts[decade] = (yearCounts[decade] || 0) + 1;
});

let html = '<h4 style="font-size: 14px; margin-bottom: 12px;">📈 Library Statistics</h4>';

// 업데이트 정보
if (dataMeta.csv_updated || dataMeta.map_built) {
  html += '<div style="font-size: 11px; color: var(--text-muted); margin-bottom: 12px; padding: 8px; background: var(--bg-tertiary); border-radius: 4px;">';
  if (dataMeta.csv_updated) html += `📁 CSV: ${dataMeta.csv_updated}<br>`;
  if (dataMeta.map_built) html += `🗺️ Map: ${dataMeta.map_built}`;
  html += '</div>';
}

// 기본 통계
html += `
  <div class="missing-item" style="border-bottom: 1px solid var(--border-color);">
    <div style="flex: 1;">
      <div style="display: flex; justify-content: space-between; padding: 4px 0;">
        <span>Total Items</span><strong>${allPapers.length}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 4px 0;">
        <span>Papers</span><strong>${papers.length}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 4px 0;">
        <span>Apps/Services</span><strong>${apps.length}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 4px 0;">
        <span>With Notes</span><strong>${withNotes} (${Math.round(withNotes/allPapers.length*100)}%)</strong>
      </div>
    </div>
  </div>
`;

// 연도 통계
if (years.length > 0) {
  html += `
    <div class="missing-item" style="border-bottom: 1px solid var(--border-color);">
      <div style="flex: 1;">
        <div style="font-weight: 600; margin-bottom: 6px;">📅 Years</div>
        <div style="display: flex; justify-content: space-between; padding: 4px 0;">
          <span>Range</span><strong>${Math.min(...years)} - ${Math.max(...years)}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 4px 0;">
          <span>Average</span><strong>${Math.round(years.reduce((a,b)=>a+b,0)/years.length)}</strong>
        </div>
      </div>
    </div>
  `;
}

// 인용 통계
if (citations.length > 0) {
  const totalCitations = citations.reduce((a,b) => a+b, 0);
  html += `
    <div class="missing-item" style="border-bottom: 1px solid var(--border-color);">
      <div style="flex: 1;">
        <div style="font-weight: 600; margin-bottom: 6px;">📊 Citations</div>
        <div style="display: flex; justify-content: space-between; padding: 4px 0;">
          <span>Total</span><strong>${totalCitations.toLocaleString()}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 4px 0;">
          <span>Average</span><strong>${Math.round(totalCitations/citations.length)}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 4px 0;">
          <span>Max</span><strong>${Math.max(...citations).toLocaleString()}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 4px 0;">
          <span>Papers with data</span><strong>${citations.length} / ${papers.length}</strong>
        </div>
      </div>
    </div>
  `;
}

// Citation links
html += `
  <div class="missing-item">
    <div style="flex: 1;">
      <div style="font-weight: 600; margin-bottom: 6px;">🔗 Internal Links</div>
      <div style="display: flex; justify-content: space-between; padding: 4px 0;">
        <span>Citation Links</span><strong>${citationLinks.length}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 4px 0;">
        <span>Clusters</span><strong>${Object.keys(clusterCounts).length}</strong>
      </div>
    </div>
  </div>
`;

missingList.innerHTML = html;
missingModal.classList.add('active');
    });

    // Classics: 내 논문들이 많이 인용하는 것
    document.getElementById('showClassics').addEventListener('click', () => {
const myS2Ids = new Set(allPapers.map(p => p.s2_id).filter(Boolean));
const myDOIs = new Set(allPapers.map(p => (p.doi || '').toLowerCase()).filter(Boolean));
const classicCounts = {};

allPapers.forEach(p => {
  (p.references || []).forEach(refId => {
    if (!myS2Ids.has(refId)) {
      classicCounts[`s2:${refId}`] = (classicCounts[`s2:${refId}`] || 0) + 1;
    }
  });
  (p.cr_references || []).forEach(refDoi => {
    if (refDoi && !myDOIs.has(refDoi.toLowerCase())) {
      classicCounts[`doi:${refDoi}`] = (classicCounts[`doi:${refDoi}`] || 0) + 1;
    }
  });
});

const sorted = Object.entries(classicCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20);

let html = '<h4 style="color: #58a6ff; font-size: 14px; margin-bottom: 12px;">📚 Classics</h4>';
html += '<p style="font-size: 11px; color: var(--text-muted); margin-bottom: 12px;">내 논문들이 많이 인용하는 기초 논문</p>';

if (sorted.length > 0) {
  html += sorted.map(([key, count], i) => {
    const type = key.substring(0, key.indexOf(':'));
    const id = key.substring(key.indexOf(':') + 1);
    const url = type === 's2'
      ? `https://www.semanticscholar.org/paper/${id}`
      : `https://doi.org/${id}`;
    const label = type === 's2' ? 'Semantic Scholar →' : id.substring(0, 40) + (id.length > 40 ? '...' : '');
    return `
      <div class="missing-item">
        <div class="missing-rank">${i + 1}</div>
        <div class="missing-info">
          <span class="missing-count">${count}개 논문이 인용</span><br>
          <a class="missing-link" href="${url}" target="_blank">${label}</a>
        </div>
      </div>
    `;
  }).join('');
} else {
  html += '<p style="color: var(--text-muted);">No classics found</p>';
}

missingList.innerHTML = html;
missingModal.classList.add('active');
    });

    // New Work: 내 논문들을 많이 인용하는 것
    document.getElementById('showNewWork').addEventListener('click', () => {
const myS2Ids = new Set(allPapers.map(p => p.s2_id).filter(Boolean));
const newWorkCounts = {};

allPapers.forEach(p => {
  (p.citations || []).forEach(citeId => {
    if (!myS2Ids.has(citeId)) {
      newWorkCounts[citeId] = (newWorkCounts[citeId] || 0) + 1;
    }
  });
});

const sorted = Object.entries(newWorkCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20);

let html = '<h4 style="color: #f97316; font-size: 14px; margin-bottom: 12px;">🆕 New Work</h4>';
html += '<p style="font-size: 11px; color: var(--text-muted); margin-bottom: 12px;">내 논문들을 많이 인용하는 최신 논문</p>';

if (sorted.length > 0) {
  html += sorted.map(([s2Id, count], i) => `
    <div class="missing-item">
      <div class="missing-rank">${i + 1}</div>
      <div class="missing-info">
        <span class="missing-count" style="background: #f9731633; color: #f97316;">${count}개 논문 인용</span><br>
        <a class="missing-link" href="https://www.semanticscholar.org/paper/${s2Id}" target="_blank">
          Semantic Scholar →
        </a>
      </div>
    </div>
  `).join('');
} else {
  html += '<p style="color: var(--text-muted);">No new work found (S2 citations data needed)</p>';
}

missingList.innerHTML = html;
missingModal.classList.add('active');
    });

    document.getElementById('closeMissing').addEventListener('click', () => {
missingModal.classList.remove('active');
    });

    missingModal.addEventListener('click', (e) => {
if (e.target === missingModal) {
  missingModal.classList.remove('active');
}
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
// 입력 필드에서는 단축키 비활성화
if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
  if (e.key === 'Escape') {
    e.target.blur();
  }
  return;
}

switch (e.key) {
  case 'Escape':
    // 모달 닫기 우선
    if (missingModal.classList.contains('active')) {
      missingModal.classList.remove('active');
    } else if (statsTooltip) {
      statsTooltip.remove();
      statsTooltip = null;
    } else if (selectedPaper) {
      clearSelection();
    }
    break;

  case '/':
    // 검색창 포커스
    e.preventDefault();
    document.getElementById('searchFilter').focus();
    break;

  case 'j':
  case 'J':
    // 다음 논문 (선택된 상태에서)
    if (selectedPaper && currentFiltered.length > 0) {
      const currentIdx = currentFiltered.findIndex(p => p.id === selectedPaper.id);
      const nextIdx = (currentIdx + 1) % currentFiltered.length;
      showDetail(currentFiltered[nextIdx]);
    } else if (currentFiltered.length > 0) {
      showDetail(currentFiltered[0]);
    }
    break;

  case 'k':
  case 'K':
    // 이전 논문
    if (selectedPaper && currentFiltered.length > 0) {
      const currentIdx = currentFiltered.findIndex(p => p.id === selectedPaper.id);
      const prevIdx = (currentIdx - 1 + currentFiltered.length) % currentFiltered.length;
      showDetail(currentFiltered[prevIdx]);
    } else if (currentFiltered.length > 0) {
      showDetail(currentFiltered[currentFiltered.length - 1]);
    }
    break;

  case 'r':
  case 'R':
    // 필터 리셋
    if (!e.ctrlKey && !e.metaKey) {
      document.getElementById('resetFilter').click();
    }
    break;

  case 'c':
  case 'C':
    // Citation 토글
    if (!e.ctrlKey && !e.metaKey) {
      const checkbox = document.getElementById('showCitations');
      checkbox.checked = !checkbox.checked;
      showCitations = checkbox.checked;
      render(currentFiltered);
    }
    break;

  case '?':
    // 단축키 도움말
    alert(`⌨️ Keyboard Shortcuts

/     검색창 포커스
Esc   선택 해제 / 모달 닫기
J     다음 논문
K     이전 논문
R     필터 리셋
C     Citation 선 토글
?     이 도움말`);
    break;
}
    });

    // Load data
    loadData();

    // =========================================
    // MOBILE UI FUNCTIONALITY
    // =========================================

    const isMobile = () => window.innerWidth <= 768;

    // Hamburger Menu
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');

    function openMobileMenu() {
mobileMenu.classList.add('active');
mobileMenuOverlay.classList.add('active');
hamburgerBtn.classList.add('active');
document.body.style.overflow = 'hidden';
    }

    function closeMobileMenu() {
mobileMenu.classList.remove('active');
mobileMenuOverlay.classList.remove('active');
hamburgerBtn.classList.remove('active');
document.body.style.overflow = '';
    }

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

    // Bottom Sheet
    const bottomSheet = document.getElementById('bottomSheet');
    const bottomSheetHandle = document.getElementById('bottomSheetHandle');
    const bottomSheetClose = document.getElementById('bottomSheetClose');

    let sheetTouchStartY = 0;
    let sheetTouchCurrentY = 0;
    let isDraggingSheet = false;

    function openBottomSheet() {
bottomSheet.classList.add('active');
    }

    function closeBottomSheet() {
bottomSheet.classList.remove('active');
if (isMobile()) {
  selectedPaper = null;
  connectedPapers = new Set();
  render(currentFiltered);
}
    }

    bottomSheetClose.addEventListener('click', closeBottomSheet);

    // Bottom sheet touch handling
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
  render(currentFiltered);
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
    render(currentFiltered);
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

    // Mobile Detail View (Bottom Sheet)
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

    // Sync mobile controls
    function syncMobileControls() {
document.getElementById('mobileMinYear').value = document.getElementById('minYear').value;
document.getElementById('mobileMinVenue').value = document.getElementById('minVenue').value;
document.getElementById('mobilePapersOnly').checked = document.getElementById('papersOnly').checked;
document.getElementById('mobileTagFilter').value = document.getElementById('tagFilter').value;
document.getElementById('mobileSearchFilter').value = document.getElementById('searchFilter').value;
document.getElementById('mobileShowCitations').checked = document.getElementById('showCitations').checked;
    }

    function syncDesktopControls() {
document.getElementById('minYear').value = document.getElementById('mobileMinYear').value;
document.getElementById('minVenue').value = document.getElementById('mobileMinVenue').value;
document.getElementById('papersOnly').checked = document.getElementById('mobilePapersOnly').checked;
document.getElementById('tagFilter').value = document.getElementById('mobileTagFilter').value;
document.getElementById('searchFilter').value = document.getElementById('mobileSearchFilter').value;
document.getElementById('showCitations').checked = document.getElementById('mobileShowCitations').checked;
showCitations = document.getElementById('mobileShowCitations').checked;
    }

    // Mobile control handlers
    document.getElementById('mobileMinYear').addEventListener('change', () => {
syncDesktopControls();
applyFilters();
    });
    document.getElementById('mobileMinVenue').addEventListener('change', () => {
syncDesktopControls();
applyFilters();
    });
    document.getElementById('mobilePapersOnly').addEventListener('change', () => {
syncDesktopControls();
applyFilters();
    });
    document.getElementById('mobileTagFilter').addEventListener('change', () => {
syncDesktopControls();
applyFilters();
    });
    document.getElementById('mobileSearchFilter').addEventListener('input', debounce(() => {
syncDesktopControls();
applyFilters();
    }, 200));
    document.getElementById('mobileShowCitations').addEventListener('change', () => {
syncDesktopControls();
render(currentFiltered);
    });
    document.getElementById('mobileResetFilter').addEventListener('click', () => {
document.getElementById('resetFilter').click();
syncMobileControls();
closeMobileMenu();
    });
    document.getElementById('mobileShowStats').addEventListener('click', () => {
document.getElementById('showGlobalStats').click();
closeMobileMenu();
    });
    document.getElementById('mobileCopyExport').addEventListener('click', () => {
document.getElementById('copyFiltered').click();
closeMobileMenu();
    });
    document.getElementById('mobileThemeToggle').addEventListener('click', () => {
document.getElementById('themeToggle').click();
document.getElementById('mobileThemeToggle').textContent =
  document.getElementById('themeToggle').textContent;
    });

    // Window resize handler
    window.addEventListener('resize', debounce(() => {
if (!isMobile()) {
  closeMobileMenu();
  closeBottomSheet();
}
Plotly.Plots.resize('plot');
    }, 250));
