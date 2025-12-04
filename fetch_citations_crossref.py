#!/usr/bin/env python3
"""
CrossRef API를 사용해 논문의 피인용 수와 인용 관계를 가져옴
- 무료, API 키 불필요
- DOI 기반으로 작동
"""

import json
import time
import requests
from pathlib import Path

# CrossRef API (polite pool - add email for better rate limits)
BASE_URL = "https://api.crossref.org/works"
HEADERS = {
    "User-Agent": "ZoteroViz/1.0 (mailto:your-email@example.com)"
}


def get_paper_by_doi(doi: str) -> dict:
    """DOI로 논문 정보 가져오기"""
    url = f"{BASE_URL}/{doi}"

    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        if resp.status_code == 200:
            return resp.json().get("message", {})
        elif resp.status_code == 404:
            return None
        else:
            print(f"  Error {resp.status_code} for DOI {doi}")
            return None
    except Exception as e:
        print(f"  Exception for DOI {doi}: {e}")
        return None


def normalize_doi(doi: str) -> str:
    """DOI 정규화 (소문자, 공백 제거)"""
    if not doi:
        return ""
    doi = doi.strip().lower()
    # URL 형태로 된 DOI 처리
    if doi.startswith("http"):
        if "doi.org/" in doi:
            doi = doi.split("doi.org/")[-1]
    return doi


def extract_reference_dois(references: list) -> list:
    """CrossRef reference 목록에서 DOI 추출"""
    dois = []
    for ref in references or []:
        doi = ref.get("DOI", "")
        if doi:
            dois.append(normalize_doi(doi))
    return dois


def main():
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

    # DOI -> paper index 매핑 (내 라이브러리)
    doi_to_idx = {}
    for p in papers:
        doi = normalize_doi(p.get("doi", ""))
        if doi:
            doi_to_idx[doi] = p["id"]

    print(f"Papers with DOI in library: {len(doi_to_idx)}")

    # 각 논문에 대해 인용 정보 가져오기
    found = 0
    for i, paper in enumerate(papers):
        doi = paper.get("doi", "").strip()
        title = paper.get("title", "")

        if not doi:
            print(f"[{i+1}/{len(papers)}] {title[:50]}... -> No DOI, skipping")
            paper["cr_citation_count"] = None
            paper["cr_references"] = []
            continue

        print(f"[{i+1}/{len(papers)}] {title[:50]}...")

        cr_data = get_paper_by_doi(doi)

        if cr_data:
            # 피인용 수
            citation_count = cr_data.get("is-referenced-by-count", 0)
            paper["cr_citation_count"] = citation_count

            # 이 논문이 인용한 논문들의 DOI
            references = cr_data.get("reference", [])
            ref_dois = extract_reference_dois(references)
            paper["cr_references"] = ref_dois

            found += 1
            print(f"  -> Found! Citations: {citation_count}, Refs: {len(ref_dois)}")
        else:
            paper["cr_citation_count"] = None
            paper["cr_references"] = []
            print(f"  -> Not found in CrossRef")

        # Rate limiting (CrossRef is generous but let's be polite)
        time.sleep(0.5)

    print(f"\nFound {found}/{len(papers)} papers in CrossRef")

    # 내 라이브러리 내 인용 관계 계산 (DOI 기반)
    print("\nCalculating internal citation links...")

    internal_links = []
    for paper in papers:
        paper_id = paper["id"]

        # 이 논문이 인용한 것 중 내 라이브러리에 있는 것
        for ref_doi in paper.get("cr_references", []):
            if ref_doi in doi_to_idx:
                target_id = doi_to_idx[ref_doi]
                if paper_id != target_id:  # 자기 인용 제외
                    link = {"source": paper_id, "target": target_id}
                    if link not in internal_links:
                        internal_links.append(link)

    print(f"Found {len(internal_links)} internal citation links")

    # 기존 S2 데이터와 병합 (있으면)
    # CrossRef 데이터를 메인 필드로 복사 (S2 데이터 없는 경우)
    for paper in papers:
        # citation_count가 없거나 CrossRef 데이터가 더 좋으면 사용
        if paper.get("citation_count") is None and paper.get("cr_citation_count") is not None:
            paper["citation_count"] = paper["cr_citation_count"]

    # 기존 citation_links와 병합
    existing_links = data.get("citation_links", [])

    # 중복 제거하면서 병합
    all_links = existing_links.copy()
    for link in internal_links:
        if link not in all_links:
            all_links.append(link)

    data["citation_links"] = all_links

    # 저장
    output_path = Path("papers.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Updated {output_path}")
    print(f"   - Papers found in CrossRef: {found}")
    print(f"   - New internal links: {len(internal_links)}")
    print(f"   - Total internal links: {len(all_links)}")


if __name__ == "__main__":
    main()
