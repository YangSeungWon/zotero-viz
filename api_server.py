#!/usr/bin/env python3
"""
Flask API Server for Zotero Tag Management
- API Key authentication for write operations
- Tag CRUD operations via Zotero API
"""

import os
import json
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS

from zotero_api import (
    get_zotero_client,
    add_tags_to_item,
    set_tags_on_item,
    fetch_all_items,
    item_to_row
)

# Load .env
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    for line in env_path.read_text().strip().split("\n"):
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

app = Flask(__name__)
CORS(app)

# API Key authentication
API_KEY = os.environ.get("APP_API_KEY")


@app.before_request
def check_api_key():
    """Check API key for write operations"""
    if request.method in ['POST', 'PUT', 'DELETE']:
        if not API_KEY:
            return jsonify({"error": "Server API key not configured"}), 500

        key = request.headers.get('X-API-Key')
        if key != API_KEY:
            return jsonify({"error": "Invalid API key"}), 401


# ============================================================
# API Endpoints
# ============================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "ok"})


@app.route('/api/tags/paper/<zotero_key>', methods=['GET'])
def get_paper_tags(zotero_key):
    """Get tags for a specific paper"""
    try:
        zot = get_zotero_client()
        item = zot.item(zotero_key)
        tags = [t['tag'] for t in item['data'].get('tags', [])]
        return jsonify({"success": True, "tags": tags})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/tags/paper/<zotero_key>', methods=['POST'])
def update_paper_tags(zotero_key):
    """Update tags for a specific paper (replace all tags)"""
    try:
        data = request.json
        tags = data.get('tags', [])

        zot = get_zotero_client()
        success = set_tags_on_item(zot, zotero_key, tags)

        if success:
            # Update local papers.json
            update_papers_json_tags(zotero_key, tags)
            return jsonify({"success": True, "tags": tags})
        else:
            return jsonify({"success": False, "error": "Failed to update tags"}), 500
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/tags/paper/<zotero_key>/add', methods=['POST'])
def add_paper_tags(zotero_key):
    """Add tags to a paper (preserves existing)"""
    try:
        data = request.json
        new_tags = data.get('tags', [])

        zot = get_zotero_client()
        success = add_tags_to_item(zot, zotero_key, new_tags)

        if success:
            # Get updated tags
            item = zot.item(zotero_key)
            all_tags = [t['tag'] for t in item['data'].get('tags', [])]
            update_papers_json_tags(zotero_key, all_tags)
            return jsonify({"success": True, "tags": all_tags})
        else:
            return jsonify({"success": False, "error": "Failed to add tags"}), 500
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/tags/batch', methods=['POST'])
def batch_tag_operation():
    """Batch add/remove tags for multiple papers"""
    try:
        data = request.json
        action = data.get('action')  # 'add' or 'remove'
        tag = data.get('tag')
        zotero_keys = data.get('zotero_keys', [])

        if not action or not tag or not zotero_keys:
            return jsonify({"error": "Missing required fields"}), 400

        zot = get_zotero_client()
        results = {"success": 0, "failed": 0}

        for key in zotero_keys:
            try:
                item = zot.item(key)
                existing_tags = [t['tag'] for t in item['data'].get('tags', [])]

                if action == 'add':
                    if tag not in existing_tags:
                        existing_tags.append(tag)
                elif action == 'remove':
                    existing_tags = [t for t in existing_tags if t != tag]

                item['data']['tags'] = [{'tag': t} for t in existing_tags]
                zot.update_item(item)

                # Update local papers.json
                update_papers_json_tags(key, existing_tags)

                results["success"] += 1
            except Exception as e:
                print(f"Error processing {key}: {e}")
                results["failed"] += 1

        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/tags/sync-clusters', methods=['POST'])
def sync_cluster_tags():
    """Sync cluster labels as tags to Zotero"""
    try:
        data = request.json
        prefix = data.get('prefix', 'cluster:')
        cluster_labels = data.get('cluster_labels', {})

        # Load papers.json to get cluster mapping
        papers_path = Path(__file__).parent / "papers.json"
        with open(papers_path, 'r', encoding='utf-8') as f:
            papers_data = json.load(f)

        papers = papers_data.get('papers', papers_data)

        zot = get_zotero_client()
        results = {"success": 0, "failed": 0, "skipped": 0}

        for paper in papers:
            zotero_key = paper.get('zotero_key')
            cluster_id = paper.get('cluster')

            if not zotero_key:
                results["skipped"] += 1
                continue

            # Get cluster label
            label = cluster_labels.get(str(cluster_id), cluster_labels.get(cluster_id, f"Cluster {cluster_id}"))
            tag = f"{prefix}{label}"

            try:
                if add_tags_to_item(zot, zotero_key, [tag]):
                    results["success"] += 1
                else:
                    results["failed"] += 1
            except Exception as e:
                print(f"Error syncing {zotero_key}: {e}")
                results["failed"] += 1

        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/papers/reload', methods=['POST'])
def reload_papers():
    """Reload papers from Zotero API and update papers.json"""
    try:
        zot = get_zotero_client()
        items = fetch_all_items(zot)

        # This would need the full build_map logic
        # For now, just return the count
        return jsonify({
            "success": True,
            "message": f"Fetched {len(items)} items. Run build_map.py --source api to regenerate papers.json"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================================
# Helper Functions
# ============================================================

def update_papers_json_tags(zotero_key: str, tags: list):
    """Update tags in papers.json for a specific paper"""
    papers_path = Path(__file__).parent / "papers.json"

    try:
        with open(papers_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        papers = data.get('papers', data)

        for paper in papers:
            if paper.get('zotero_key') == zotero_key:
                paper['tags'] = ', '.join(tags)
                break

        if 'papers' in data:
            data['papers'] = papers
        else:
            data = papers

        with open(papers_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    except Exception as e:
        print(f"Error updating papers.json: {e}")


# ============================================================
# Main
# ============================================================

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'

    print(f"Starting API server on port {port}")
    print(f"API Key configured: {'Yes' if API_KEY else 'No'}")

    app.run(host='0.0.0.0', port=port, debug=debug)
