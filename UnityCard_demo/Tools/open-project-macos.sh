#!/bin/sh
set -eu
project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
editor_version=$(sed -n 's/^m_EditorVersion: //p' "$project_root/ProjectSettings/ProjectVersion.txt" | tr -d '\r')
unity_path=${UNITY_EDITOR_PATH:-"/Applications/Unity/Hub/Editor/$editor_version/Unity.app/Contents/MacOS/Unity"}
if [ ! -x "$unity_path" ]; then
  echo "Install Unity $editor_version through Unity Hub, or set UNITY_EDITOR_PATH." >&2
  exit 1
fi
exec "$unity_path" -projectPath "$project_root"
