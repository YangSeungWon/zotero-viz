#!/usr/bin/env python3
"""
Semantic Scholar API를 사용해 논문의 피인용 수와 인용 관계를 가져옴
"""

import argparse
import json
import os
import time
import requests
from pathlib import Path

# Load .env if exists
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    for line in env_path.read_text().strip().split("\n"):
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

# Semantic Scholar API
BASE_URL = "https://api.semanticscholar.org/graph/v1"
FIELDS = "citationCount,citations.paperId,citations.title,references.paperId,references.title"
API_KEY = os.environ.get("S2_API_KEY")
HEADERS = {"x-api-key": API_KEY} if API_KEY else {}

def get_paper_by_doi(doi: str, retry=3) -> dict:
    """DOI로 논문 정보 가져오기"""
    url = f"{BASE_URL}/paper/DOI:{doi}"
    params = {"fields": FIELDS}

    for attempt in range(retry):
        try:
            resp = requests.get(url, params=params, headers=HEADERS, timeout=15)
            if resp.status_code == 200:
                return resp.json()
            elif resp.status_code == 404:
                return None
            elif resp.status_code == 429:
                wait = 10 * (attempt + 1)
                print(f"  Rate limited, waiting {wait}s...")
                time.sleep(wait)
                continue
            else:
                print(f"  Error {resp.status_code} for DOI {doi}")
                return None
        except Exception as e:
            if attempt < retry - 1:
                print(f"  Retry {attempt+1}/{retry} for DOI {doi}")
                time.sleep(5)
            else:
                print(f"  Exception for DOI {doi}: {e}")
                return None
    return None


def normalize_title(title: str) -> str:
    """Normalize title for comparison"""
    import re
    # Lowercase, remove punctuation, collapse whitespace
    t = title.lower()
    t = re.sub(r'[^\w\s]', '', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t

def title_similarity(t1: str, t2: str) -> float:
    """Simple word overlap similarity"""
    words1 = set(normalize_title(t1).split())
    words2 = set(normalize_title(t2).split())
    if not words1 or not words2:
        return 0.0
    intersection = words1 & words2
    return len(intersection) / max(len(words1), len(words2))

def get_paper_by_title(title: str, retry=3) -> dict:
    """제목으로 논문 검색 (with title verification)"""
    url = f"{BASE_URL}/paper/search"
    params = {
        "query": title[:200],  # 제목 길이 제한
        "fields": FIELDS + ",title",
        "limit": 10  # Get more results to find best match
    }

    for attempt in range(retry):
        try:
            resp = requests.get(url, params=params, headers=HEADERS, timeout=15)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("data") and len(data["data"]) > 0:
                    # Find best matching title
                    best_match = None
                    best_score = 0.0
                    for paper in data["data"]:
                        paper_title = paper.get("title", "")
                        score = title_similarity(title, paper_title)
                        if score > best_score:
                            best_score = score
                            best_match = paper
                    # Require at least 50% word overlap
                    if best_match and best_score >= 0.5:
                        return best_match
                    elif best_match:
                        print(f"    Low match ({best_score:.0%}): {best_match.get('title', '')[:50]}...")
                return None
            elif resp.status_code == 429:
                wait = 10 * (attempt + 1)
                print(f"  Rate limited, waiting {wait}s...")
                time.sleep(wait)
                continue
        except Exception as e:
            if attempt < retry - 1:
                print(f"  Retry {attempt+1}/{retry} for title search")
                time.sleep(5)
            else:
                print(f"  Exception for title search: {e}")
                return None
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--verify', action='store_true',
                        help='Re-verify existing S2 ID matches by title comparison')
    args = parser.parse_args()

    # papers.json 로드
    papers_path = Path("papers.json")
    if not papers_path.exists():
        print("papers.json not found")
        return

    with open(papers_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 새 포맷 vs 기존 포맷
    if isinstance(data, dict) and "papers" in data:
        papers = data["papers"]
    else:
        papers = data
        data = {"papers": papers}

    print(f"Processing {len(papers)} papers...")
    if args.verify:
        print("(--verify mode: re-checking existing S2 IDs)")

    # S2 paper ID 매핑 (내 라이브러리 DOI -> S2 ID)
    doi_to_s2id = {}

    # 각 논문에 대해 인용 정보 가져오기
    found = 0
    skipped = 0
    for i, paper in enumerate(papers):
        doi = paper.get("doi", "").strip()
        title = paper.get("title", "")

        if not doi and not title:
            continue

        # 이미 S2 ID가 있으면 스킵 (--verify 모드가 아닐 때)
        existing_s2_id = paper.get("s2_id")
        if existing_s2_id and not args.verify:
            skipped += 1
            found += 1
            continue

        print(f"[{i+1}/{len(papers)}] {title[:50]}...")

        # DOI로 먼저 시도
        s2_data = None
        if doi:
            s2_data = get_paper_by_doi(doi)

        # DOI 없거나 못 찾으면 제목으로 검색
        if not s2_data and title:
            s2_data = get_paper_by_title(title)

        if s2_data:
            new_s2_id = s2_data.get("paperId", "")

            # In verify mode, check if S2 ID changed
            if args.verify and existing_s2_id and existing_s2_id != new_s2_id:
                print(f"  ⚠️  S2 ID CORRECTED: {existing_s2_id[:12]}... -> {new_s2_id[:12]}...")

            paper["citation_count"] = s2_data.get("citationCount", 0)
            paper["s2_id"] = new_s2_id

            # 인용하는 논문들 (이 논문이 인용한 것)
            refs = s2_data.get("references", []) or []
            paper["references"] = [r["paperId"] for r in refs if r and r.get("paperId")]

            # 인용된 논문들 (이 논문을 인용한 것)
            cites = s2_data.get("citations", []) or []
            paper["citations"] = [c["paperId"] for c in cites if c and c.get("paperId")]

            if doi:
                doi_to_s2id[doi] = new_s2_id

            found += 1
            print(f"  -> Found! Citations: {paper['citation_count']}")
        else:
            paper["citation_count"] = None
            paper["s2_id"] = ""
            paper["references"] = []
            paper["citations"] = []
            print(f"  -> Not found")

        # Rate limiting - 5초 대기
        time.sleep(5)

    print(f"\nFound {found}/{len(papers)} papers in Semantic Scholar (skipped {skipped} already cached)")

    # 내 라이브러리 내 인용 관계 계산
    print("\nCalculating internal citation links...")
    s2id_to_idx = {p.get("s2_id"): p["id"] for p in papers if p.get("s2_id")}

    internal_links = []
    for paper in papers:
        paper_id = paper["id"]
        s2_id = paper.get("s2_id", "")

        # 이 논문이 인용한 것 중 내 라이브러리에 있는 것
        for ref_s2id in paper.get("references", []):
            if ref_s2id in s2id_to_idx:
                target_id = s2id_to_idx[ref_s2id]
                internal_links.append({"source": paper_id, "target": target_id})

        # 이 논문을 인용한 것 중 내 라이브러리에 있는 것
        for cite_s2id in paper.get("citations", []):
            if cite_s2id in s2id_to_idx:
                source_id = s2id_to_idx[cite_s2id]
                # 중복 방지 (source -> target 방향으로 통일)
                link = {"source": source_id, "target": paper_id}
                if link not in internal_links:
                    internal_links.append(link)

    print(f"Found {len(internal_links)} internal citation links")

    # 데이터에 추가
    data["citation_links"] = internal_links

    # Top external references 캐싱 (Classics용)
    print("\nCaching top external references...")
    myS2Ids = set(p.get("s2_id") for p in papers if p.get("s2_id"))
    ref_counts = {}
    for paper in papers:
        for ref_id in paper.get("references", []):
            if ref_id and ref_id not in myS2Ids:
                ref_counts[ref_id] = ref_counts.get(ref_id, 0) + 1

    # Top 500 가져오기 (S2 batch API 최대 500개)
    top_refs = sorted(ref_counts.items(), key=lambda x: -x[1])[:500]
    top_ref_ids = [r[0] for r in top_refs]

    if top_ref_ids:
        print(f"Fetching details for top {len(top_ref_ids)} external references...")
        ref_cache = {}
        for attempt in range(3):
            try:
                resp = requests.post(
                    f"{BASE_URL}/paper/batch",
                    json={"ids": top_ref_ids},
                    params={"fields": "title,citationCount"},
                    timeout=60
                )
                if resp.status_code == 200:
                    for p in resp.json():
                        if p and p.get("paperId"):
                            ref_cache[p["paperId"]] = {
                                "title": p.get("title", ""),
                                "citations": p.get("citationCount", 0)
                            }
                    print(f"Cached {len(ref_cache)} reference details")
                    break
                elif resp.status_code == 429:
                    wait = 30 * (attempt + 1)
                    print(f"  Rate limited on batch, waiting {wait}s... (attempt {attempt+1}/3)")
                    time.sleep(wait)
                else:
                    print(f"Failed to fetch reference details: {resp.status_code}")
                    break
            except Exception as e:
                print(f"Error fetching reference details: {e}")
                if attempt < 2:
                    time.sleep(10)

        if ref_cache:
            data["reference_cache"] = ref_cache

    # 저장
    output_path = Path("papers.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Updated {output_path}")
    print(f"   - Papers with citations: {found}")
    print(f"   - Internal links: {len(internal_links)}")


if __name__ == "__main__":
    main()
