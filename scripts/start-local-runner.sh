#!/usr/bin/env bash

set -euo pipefail

runner_home="${NEW_TECH_RUNNER_HOME:-/home/seunghyuk/actions-runner-new-tech}"
session_name="new-tech-cd-runner"
log_path="/tmp/${session_name}.log"

if tmux has-session -t "$session_name" 2>/dev/null; then
  echo "${session_name} is already running"
  exit 0
fi

[[ -x "${runner_home}/run.sh" ]] || {
  echo "runner is not installed: ${runner_home}/run.sh" >&2
  exit 1
}

tmux new-session -d -s "$session_name" -c "$runner_home" "./run.sh 2>&1 | tee ${log_path}"
echo "started ${session_name}; log: ${log_path}"
