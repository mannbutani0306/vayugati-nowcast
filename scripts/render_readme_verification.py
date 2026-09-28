"""Fill the README verification table from the generated JSON artifact."""

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
README_PATH = ROOT / "README.md"
RESULTS_PATH = ROOT / "verification" / "results.json"
START = "<!-- VERIFICATION_TABLE_START -->"
END = "<!-- VERIFICATION_TABLE_END -->"


def render() -> int:
    readme = README_PATH.read_text(encoding="utf-8")
    if readme.count(START) != 1 or readme.count(END) != 1:
        raise ValueError("README must contain exactly one verification marker pair")
    result = json.loads(RESULTS_PATH.read_text(encoding="utf-8"))
    rows = [row for row in result["cases"] if row["lead_minutes"] == 60]
    table = [
        "| Synthetic case | Nowcast CSI (mean +/- std) | Persistence CSI (mean +/- std) |",
        "|---|---:|---:|",
    ]
    for row in rows:
        nowcast = row["nowcast"]["CSI"]
        persistence = row["persistence"]["CSI"]
        table.append(
            f"| {row['case']} | {nowcast['mean']:.3f} +/- {nowcast['std']:.3f} "
            f"| {persistence['mean']:.3f} +/- {persistence['std']:.3f} |"
        )
    before, remaining = readme.split(START, 1)
    _, after = remaining.split(END, 1)
    README_PATH.write_text(f"{before}{START}\n" + "\n".join(table) + f"\n{END}{after}", encoding="utf-8")
    print(f"Rendered {len(rows)} synthetic verification rows from verification/results.json.")
    return len(rows)


if __name__ == "__main__":
    render()