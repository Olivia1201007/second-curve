#!/usr/bin/env bash
set -euo pipefail
if [[ $# -ne 1 ]]; then
  echo "用法: $0 <已创建的 Gitee 仓库 HTTPS 或 SSH URL>" >&2
  exit 2
fi
url="$1"
if git remote get-url gitee >/dev/null 2>&1; then
  git remote set-url gitee "$url"
else
  git remote add gitee "$url"
fi
git push --mirror gitee
echo "Gitee mirror pushed: $url"
