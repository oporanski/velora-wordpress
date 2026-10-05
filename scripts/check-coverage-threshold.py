#!/usr/bin/env python3
"""
Coverage threshold ratchet for PHPUnit (Clover XML).

Reads a Clover XML coverage report and fails if line/method coverage
drops below the configured thresholds. Thresholds go UP only, never down.

Usage:
    python3 check-coverage-threshold.py <clover.xml> --lines=38 --methods=61
"""
import sys
import xml.etree.ElementTree as ET


def parse_clover(path: str) -> dict:
    tree = ET.parse(path)
    root = tree.getroot()
    project = root.find('.//project/metrics')
    if project is None:
        print("ERROR: Could not find <project><metrics> in Clover XML")
        sys.exit(2)

    total_methods = int(project.get('methods', 0))
    covered_methods = int(project.get('coveredmethods', 0))
    total_statements = int(project.get('statements', 0))
    covered_statements = int(project.get('coveredstatements', 0))

    return {
        'lines_pct': round(covered_statements / total_statements * 100, 2) if total_statements else 0,
        'lines_covered': covered_statements,
        'lines_total': total_statements,
        'methods_pct': round(covered_methods / total_methods * 100, 2) if total_methods else 0,
        'methods_covered': covered_methods,
        'methods_total': total_methods,
    }


def main():
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <clover.xml> --lines=N --methods=N")
        sys.exit(2)

    clover_path = sys.argv[1]
    thresholds = {'lines': 0, 'methods': 0}

    for arg in sys.argv[2:]:
        if arg.startswith('--lines='):
            thresholds['lines'] = float(arg.split('=')[1])
        elif arg.startswith('--methods='):
            thresholds['methods'] = float(arg.split('=')[1])

    cov = parse_clover(clover_path)
    failures = []

    print(f"  Lines:   {cov['lines_pct']}% ({cov['lines_covered']}/{cov['lines_total']})  threshold: {thresholds['lines']}%")
    print(f"  Methods: {cov['methods_pct']}% ({cov['methods_covered']}/{cov['methods_total']})  threshold: {thresholds['methods']}%")

    if cov['lines_pct'] < thresholds['lines']:
        failures.append(f"Lines coverage {cov['lines_pct']}% < threshold {thresholds['lines']}%")
    if cov['methods_pct'] < thresholds['methods']:
        failures.append(f"Methods coverage {cov['methods_pct']}% < threshold {thresholds['methods']}%")

    if failures:
        print("\n  FAIL: Coverage below threshold!")
        for f in failures:
            print(f"    - {f}")
        print("  Fix: Write more tests. Do NOT lower thresholds.")
        sys.exit(1)
    else:
        print("\n  OK: Coverage thresholds met.")


if __name__ == '__main__':
    main()
