#!/usr/bin/env bash
# Regression test for .gitleaks.toml — proves `make secret-scan` can go RED.
#
# Why this exists: in the Velora monorepo this file's ancestor held an allowlist and
# nothing else until 2026-08-22. gitleaks passed `--config` starts from an EMPTY rule
# set unless the file extends the defaults, so the commit gate reported OK on every
# commit while being incapable of finding anything. The file looked fine; only a
# planted secret exposed it. This repository is PUBLIC, so a scan that cannot fail is
# worse here than it was there.
#
# The test plants credentials in throwaway repositories and runs this repository's
# config against them. Every planted credential must be found.
#
# Usage: scripts/test-gitleaks-config.sh   (or: make secret-scan-test)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="$REPO_ROOT/.gitleaks.toml"

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "SKIP: gitleaks not installed (brew install gitleaks)"
  exit 0
fi

WORKDIR="$(mktemp -d)"
EXPORT_DIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR" "$EXPORT_DIR"' EXIT

failures=0

# Each case: <name>|<file name>|<planted line>
run_case() {
  local name="$1" filename="$2" content="$3"
  local dir="$WORKDIR/$name"

  mkdir -p "$(dirname "$dir/$filename")"
  (
    cd "$dir"
    git init -q .
    git config user.email gitleaks-test@velora.invalid
    git config user.name "gitleaks config test"
    printf '%s\n' "$content" > "$filename"
    git add "$filename"
  )

  # A non-zero exit is NOT enough evidence: an unloadable config also exits non-zero.
  # The report has to actually contain a finding.
  local report="$dir/report.json"
  local stderr_log="$dir/stderr.log"
  (cd "$dir" && gitleaks protect --staged --config "$CONFIG" --report-path "$report" \
    >/dev/null 2>"$stderr_log") || true

  if [ -s "$report" ] && grep -q '"RuleID"' "$report"; then
    echo "  ok:   $name — detected"
  else
    echo "  FAIL: $name — planted credential was NOT detected"
    sed 's/^/        /' "$stderr_log"
    failures=$((failures + 1))
  fi
}

# The planted values are ASSEMBLED AT RUNTIME from fragments, never written out
# whole. Reason, measured 2026-10-05: with the four credentials as plain literals
# this file scored 7 findings the moment it was committed — `make secret-scan`
# scans commits and the self-check below scans `git archive HEAD`, so BOTH miss
# the file while it is untracked and BOTH hit it afterwards. The gate that guards
# every push would have been permanently red, and a file that looks like a leak
# would sit in this PUBLIC repository's history. Fragments keep the runtime value
# the right shape (the test still proves the scan can go red) while leaving no
# matchable literal on disk. Re-verify after editing:
#   git archive HEAD | tar -x -C /tmp/gl && cp scripts/test-gitleaks-config.sh /tmp/gl/scripts/
#   gitleaks detect --source /tmp/gl --no-git --config .gitleaks.toml   # must be clean
A='AKIA'; B='IOSFODNN7EX'; C='AMPLZ'
G='ghp'; H='_016C7ceF7f0A1bB2cC3dD4'; I='eE5fF6a7B8c9D0e'
S='sk'; T='_live_51H8xQzKm3NpQ'; U='rStUvWxYzAbCdEfGhIjK'
K='-----BEGIN RSA PRIVATE'; L=' KEY-----'
M='MIIEowIBAAKCAQEAx7Vn9SkAqLT'; N='PvUvhLDy0mQ8jdKqR3PbYwT1sZ2hFgN4uJcXaB'

echo "Testing that .gitleaks.toml can detect planted credentials..."
run_case aws-access-key    creds.txt  "aws_access_key_id = \"${A}${B}${C}\""
run_case github-pat        deploy.sh  "GITHUB_TOKEN=${G}${H}${I}"
run_case private-key       server.pem "$(printf -- '%s\n%s\n%s' "${K}${L}" "${M}${N}" "${K/BEGIN/END}${L}")"
run_case stripe-secret-key billing.ts "const stripe = new Stripe(\"${S}${T}${U}\");"

# The waiver in .gitleaks.toml silences `generic-api-key` under tests/, because the
# PHPUnit suite feeds the plugins fabricated keys shaped like real ones. A waiver
# scoped one directory too wide would make tests/ a blind spot in a PUBLIC repository.
# This case proves the waiver is narrow: a REAL provider rule still fires there.
echo "Testing that the tests/ waiver does not blind the scan..."
run_case waiver-scope-tests tests/leak.php "GITHUB_TOKEN=${G}${H}${I}"

# The gate must also stay quiet on what this repository legitimately contains,
# otherwise it gets switched off. A clean tree is the other half of "it works".
#
# Scanned through `git archive HEAD` rather than the checkout directory. Pointing
# gitleaks at the directory scans everything on disk — vendor/, node_modules/,
# dist/, a developer's stray files — none of which is committed and none of which
# this gate can do anything about. A check that is red on every machine is the
# surest way to get the gate switched off.
echo "Testing that the committed tree scans clean (no false positives)..."
git -C "$REPO_ROOT" archive HEAD | tar -x -C "$EXPORT_DIR"
if gitleaks detect --source "$EXPORT_DIR" --no-git --config "$CONFIG" --no-banner >/dev/null 2>&1; then
  echo "  ok:   committed tree is clean"
else
  echo "  FAIL: committed files report findings — triage them, do not widen the allowlist blindly:"
  echo "        git archive HEAD | tar -x -C /tmp/gl && gitleaks detect --source /tmp/gl --no-git --config .gitleaks.toml --verbose"
  failures=$((failures + 1))
fi

if [ "$failures" -ne 0 ]; then
  echo "RESULT: $failures check(s) failed — the secret gate is not trustworthy."
  exit 1
fi
echo "RESULT: all checks passed."
