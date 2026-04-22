#!/usr/bin/env python3
"""
run_experiments.py — Python wrapper for Altara A2A negotiation experiments
Calls the Node.js experiment runner and generates charts from CSVs.

Usage:
  python3 run_experiments.py          # run all experiments + charts
  python3 run_experiments.py 1        # run experiment 1 only
  python3 run_experiments.py charts   # generate charts from existing CSVs
"""

import subprocess
import sys
import os
import csv

RESULTS_DIR = os.path.join(os.path.dirname(__file__), "results")


def run_node_experiments(exp_num="all"):
    """Run the Node.js experiment runner."""
    print(f"\n🚀 Running experiment(s): {exp_num}\n")
    result = subprocess.run(
        ["node", "run_experiments.js", str(exp_num)],
        cwd=os.path.dirname(__file__) or ".",
        capture_output=False,
    )
    if result.returncode != 0:
        print(f"❌ Node experiments failed with code {result.returncode}")
        sys.exit(1)
    print("✅ Node experiments completed successfully")


def generate_charts():
    """Generate ASCII charts from CSV results (no matplotlib needed)."""
    print("\n📊 Generating result summaries...\n")

    # Experiment 1 chart
    exp1_csv = os.path.join(RESULTS_DIR, "exp1_rfp_vs_auction", "exp1_summary.csv")
    if os.path.exists(exp1_csv):
        print("━━━ Experiment 1: RFP vs Reverse Auction ━━━")
        with open(exp1_csv) as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        for row in rows:
            mode = row["mode"].upper()
            total = float(row["grand_total"])
            bar = "█" * int(total / 500)
            print(f"  {mode:8s} ${total:>10,.0f} {bar}")
        print()

    # Experiment 2 chart
    exp2_csv = os.path.join(RESULTS_DIR, "exp2_scale_latency", "exp2_results.csv")
    if os.path.exists(exp2_csv):
        print("━━━ Experiment 2: Scale & Latency ━━━")
        with open(exp2_csv) as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        print(f"  {'Vendors':>8s} {'Sequential':>12s} {'Parallel':>12s} {'Speedup':>8s}")
        print(f"  {'─' * 8} {'─' * 12} {'─' * 12} {'─' * 8}")
        for row in rows:
            n = row["vendor_count"]
            seq = float(row["sequential_sec"])
            par = float(row["parallel_sec"])
            speedup = float(row["speedup"])
            print(f"  {n:>8s} {seq:>10.1f}s {par:>10.1f}s {speedup:>6.1f}x")
        print()

    # Experiment 3 chart
    exp3_csv = os.path.join(RESULTS_DIR, "exp3_failure_recovery", "exp3_results.csv")
    if os.path.exists(exp3_csv):
        print("━━━ Experiment 3: Failure Recovery ━━━")
        with open(exp3_csv) as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        for row in rows:
            scenario = row["scenario"]
            total = float(row["grand_total"])
            elapsed = float(row["elapsed_sec"])
            failed = row.get("failed", 0)
            recovered = row.get("recovered", 0)
            print(f"  {scenario:20s} total=${total:>10,.0f}  time={elapsed:>6.1f}s  failed={failed} recovered={recovered}")
        print()


def try_matplotlib_charts():
    """Try to generate PNG charts using matplotlib (optional)."""
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        print("  ℹ️  matplotlib not installed — skipping PNG chart generation")
        print("     Install with: pip3 install matplotlib")
        return

    # Experiment 2: latency bar chart
    exp2_csv = os.path.join(RESULTS_DIR, "exp2_scale_latency", "exp2_results.csv")
    if os.path.exists(exp2_csv):
        with open(exp2_csv) as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        vendors = [r["vendor_count"] for r in rows]
        seq = [float(r["sequential_sec"]) for r in rows]
        par = [float(r["parallel_sec"]) for r in rows]

        x = range(len(vendors))
        fig, ax = plt.subplots(figsize=(8, 5))
        ax.bar([i - 0.2 for i in x], seq, 0.4, label="Sequential", color="#4A90D9")
        ax.bar([i + 0.2 for i in x], par, 0.4, label="Parallel", color="#50C878")
        ax.set_xlabel("Number of Vendors")
        ax.set_ylabel("Time (seconds)")
        ax.set_title("Experiment 2: Negotiation Latency at Scale")
        ax.set_xticks(list(x))
        ax.set_xticklabels(vendors)
        ax.legend()
        chart_path = os.path.join(RESULTS_DIR, "exp2_scale_latency", "exp2_chart.png")
        fig.savefig(chart_path, dpi=150, bbox_inches="tight")
        print(f"  📈 Saved {chart_path}")

    # Experiment 1: comparison bar chart
    exp1_csv = os.path.join(RESULTS_DIR, "exp1_rfp_vs_auction", "exp1_summary.csv")
    if os.path.exists(exp1_csv):
        with open(exp1_csv) as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        modes = [r["mode"].upper() for r in rows]
        totals = [float(r["grand_total"]) for r in rows]
        times = [float(r["elapsed_sec"]) for r in rows]

        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 4))
        ax1.bar(modes, totals, color=["#4A90D9", "#E8833A"])
        ax1.set_ylabel("Grand Total ($)")
        ax1.set_title("Wedding Cost by Mode")

        ax2.bar(modes, times, color=["#4A90D9", "#E8833A"])
        ax2.set_ylabel("Time (seconds)")
        ax2.set_title("Negotiation Time by Mode")

        fig.suptitle("Experiment 1: RFP vs Reverse Auction")
        chart_path = os.path.join(RESULTS_DIR, "exp1_rfp_vs_auction", "exp1_chart.png")
        fig.savefig(chart_path, dpi=150, bbox_inches="tight")
        print(f"  📈 Saved {chart_path}")


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else "all"

    if arg == "charts":
        generate_charts()
        try_matplotlib_charts()
    else:
        run_node_experiments(arg)
        generate_charts()
        try_matplotlib_charts()
