#!/usr/bin/env python3
"""Refresh public dashboard snapshots without losing the last good data."""

import csv
import io
import json
import re
import urllib.request
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "hugo/static/data/dashboards.json"
NOW = datetime.now(timezone.utc)
HEADERS = {"User-Agent": "PKUfudawei.github.io dashboard updater (GitHub Actions)"}
GROUPS = {
    "AI": [("NeurIPS", "nips"), ("ICLR", "iclr"), ("ICML", "icml")],
    "CV": [("CVPR", "cvpr"), ("ICCV", "iccv"), ("ECCV", "eccv")],
    "NLP": [("ACL", "acl"), ("EMNLP", "emnlp"), ("NAACL", "naacl")],
}


def fetch(url):
    request = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=25) as response:
        return response.read().decode("utf-8")


def stamp():
    return NOW.isoformat(timespec="seconds").replace("+00:00", "Z")


def parse_deadline(value, zone):
    if not value or not isinstance(value, str):
        return None
    match = re.fullmatch(r"(?:UTC([+-]\d{1,2})|AoE)", zone or "")
    if not match:
        return None
    hours = int(match.group(1)) if match.group(1) else -12
    try:
        dt = datetime.fromisoformat(value).replace(tzinfo=timezone(timedelta(hours=hours)))
        return dt.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    except ValueError:
        return None


def conferences():
    rows = []
    for group, items in GROUPS.items():
        for name, slug in items:
            url = f"https://raw.githubusercontent.com/ccfddl/ccf-deadlines/main/conference/AI/{slug}.yml"
            document = yaml.safe_load(fetch(url))[0]
            editions = []
            for conf in document.get("confs", []):
                for timeline in conf.get("timeline", []):
                    paper = parse_deadline(timeline.get("deadline"), conf.get("timezone"))
                    if paper:
                        editions.append({
                            "year": conf["year"],
                            "url": conf.get("link", ""),
                            "timezone": conf.get("timezone", ""),
                            "abstract": parse_deadline(timeline.get("abstract_deadline"), conf.get("timezone")),
                            "paper": paper,
                        })
            upcoming = [edition for edition in editions
                        if datetime.fromisoformat(edition["paper"].replace("Z", "+00:00")) > NOW]
            selected = min(upcoming, key=lambda row: row["paper"]) if upcoming else None
            previous = max(editions, key=lambda row: row["paper"]) if editions and not selected else None
            rows.append({"name": name, "group": group, "next": selected, "last": previous,
                         "source": url, "latest_year": max((e["year"] for e in document.get("confs", [])), default=None)})
    return {"updated_at": stamp(), "items": rows}


class Scripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_script = False
        self.scripts = []

    def handle_starttag(self, tag, attrs):
        self.in_script = tag == "script"

    def handle_endtag(self, tag):
        if tag == "script":
            self.in_script = False

    def handle_data(self, data):
        if self.in_script and "initialModels" in data:
            self.scripts.append(data)


def artificial_analysis():
    url = "https://artificialanalysis.ai/leaderboards/models"
    parser = Scripts()
    parser.feed(fetch(url))
    models = []
    decoder = json.JSONDecoder()
    for script in parser.scripts:
        for encoded in re.findall(r"self\.__next_f\.push\((\[1,.*?\])\)", script, re.S):
            payload = json.loads(encoded)[1]
            if '"initialModels":' in payload:
                found, _ = decoder.raw_decode(payload.split('"initialModels":', 1)[1])
                models.extend(found)
    if not models:
        raise ValueError("Artificial Analysis page contained no model data")
    ranked = sorted((m for m in models if isinstance(m.get("intelligenceIndex"), (int, float))
                     and not m.get("deprecated")), key=lambda m: m["intelligenceIndex"], reverse=True)
    return {"updated_at": stamp(), "source_date": None, "url": url,
            "metric": "Intelligence Index", "items": [
                {"rank": i, "name": m["name"], "score": round(m["intelligenceIndex"], 1),
                 "company": m.get("modelCreatorName") or "",
                 "url": f"https://artificialanalysis.ai/models/{m['slug']}"}
                for i, m in enumerate(ranked, 1)]}


def arena():
    # Arena blocks direct automated requests and cannot be embedded. Jina's
    # public text rendering exposes the official page without requiring a key.
    source = "https://arena.ai/leaderboard/text"
    markdown = fetch("https://r.jina.ai/" + source)
    pattern = (r"(?m)^(\d{1,3})\n\t\n\d+\n\d+\n\t\n"
               r"([^\n]+)\n([^\n]+)\n\t\n(\d{3,4})\n±")
    matches = re.findall(pattern, markdown)
    if len(matches) < 50 or int(matches[0][0]) != 1:
        raise ValueError("Arena text page did not contain a complete ranking")
    date_match = re.search(r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4}\b", markdown)
    if not date_match:
        raise ValueError("Arena leaderboard date was not found")
    source_date = datetime.strptime(date_match.group(), "%b %d, %Y").date().isoformat()
    items = []
    for rank, name, lab, score in matches:
        company = lab.split(" · ", 1)[0] if " · " in lab else lab
        if re.match(r"^(?:Apache|MIT$|CC-|Proprietary$|Jamba Open$)", company):
            company = ""
        items.append({"rank": int(rank), "name": name.strip(), "company": company,
                      "score": int(score), "url": source})
    return {"updated_at": stamp(), "source_date": source_date, "url": source,
            "metric": "Arena score", "items": items}


def livebench():
    url = "https://livebench.ai/"
    page = fetch(url)
    bundle = re.search(r'src="\./(static/js/main\.[^\"]+\.js)"', page)
    if not bundle:
        raise ValueError("LiveBench bundle was not found")
    js = fetch(url + bundle.group(1))
    organizations = {
        quoted or bare: organization
        for quoted, bare, organization in re.findall(
            r'(?:"([^"]+)"|([A-Za-z_$][\w$-]*)):\{[^{}]*?organization:"([^"]+)"', js)
    }
    releases = re.search(r'_e=\[([^\]]+)\]', js)
    if not releases:
        raise ValueError("LiveBench release list was not found")
    latest = json.loads("[" + releases.group(1) + "]")[-1]
    base = f"{url}data/{latest}/"
    categories = json.loads(fetch(base + "categories.json"))
    columns = [column for values in categories.values() for column in values]
    rows = list(csv.DictReader(io.StringIO(fetch(base + "table.csv"))))
    ranked = []
    for row in rows:
        values = [float(row[c]) for c in columns if row.get(c) not in (None, "", "-")]
        if len(values) == len(columns):
            ranked.append((row["model"], sum(values) / len(values)))
    ranked.sort(key=lambda row: row[1], reverse=True)
    if not ranked:
        raise ValueError("LiveBench table contained no complete model scores")
    return {"updated_at": stamp(), "source_date": f"{latest[:4]}-{latest[4:6]}-{latest[6:]}",
            "url": url, "metric": "Overall score", "items": [
                {"rank": i, "name": name, "company": organizations.get(name, ""),
                 "score": round(score, 1), "url": url}
                for i, (name, score) in enumerate(ranked, 1)]}


def main():
    previous = json.loads(OUTPUT.read_text()) if OUTPUT.exists() else {}
    result = dict(previous)
    failures = []
    for key, task in (("conferences", conferences), ("artificial_analysis", artificial_analysis),
                      ("arena", arena), ("livebench", livebench)):
        try:
            result[key] = task()
            print(f"Updated {key}")
        except Exception as exc:
            failures.append(key)
            print(f"Failed {key}: {exc}")
    result["attempted_at"] = stamp()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    if failures:
        print("Kept previous data for:", ", ".join(failures))
    if not any(key in result for key in ("conferences", "artificial_analysis", "arena", "livebench")):
        raise SystemExit("No dashboard data available")


if __name__ == "__main__":
    main()
