#!/usr/bin/env python3
"""Scan tracked text for credential patterns and prohibited private helpers."""
import argparse
from pathlib import Path
import re
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--plain', action='store_true', help='ASCII labels')
parser.add_argument('--content-only', action='store_true', help='Inspect credentials separately from publication eligibility')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
files = subprocess.check_output(['git', 'ls-files', '-z'], cwd=root).decode().split('\0')
patterns = [r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----', r'gh[pousr]_[A-Za-z0-9]{30,}',
            r'github_pat_[A-Za-z0-9_]{40,}', r'AKIA[0-9A-Z]{16}', r'sk-(?:proj-)?[A-Za-z0-9_-]{40,}']
private = re.compile(r'(^|/)(?:NIGHT_NOTE\.md|review-notes\.md|(?:night|goal|run|task)[^/]*\.(?:txt|log)|\.env(?:\..*)?)$|^\.harness/')
findings = []
for name in filter(None, files):
    p = root / name
    if not args.content_only and private.search(name):
        findings.append((name, 'prohibited private helper tracked'))
    if p.is_file():
        content = p.read_text(errors='replace')
        if any(re.search(pattern, content) for pattern in patterns):
            findings.append((name, 'possible authentication secret; inspect locally'))
icon = '' if args.plain else ('⚠️ ' if findings else '✅ ')
for name, reason in findings:
    print(f'{icon}{name}: {reason}')
print(f'{icon}{"FAIL" if findings else "PASS"}: {len(list(filter(None, files)))} tracked files; {len(findings)} findings. Pattern scan is not exhaustive.')
raise SystemExit(bool(findings))
