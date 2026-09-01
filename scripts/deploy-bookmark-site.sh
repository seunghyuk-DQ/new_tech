#!/usr/bin/env bash

set -euo pipefail

mode="${1:-update}"
base_url="${BOOKMARK_BASE_URL:-}"
entry_path="${BOOKMARK_ENTRY_PATH:-new_tech.html}"
directory_name="${BOOKMARK_DIRECTORY_NAME:-new_tech}"
site_id="${BOOKMARK_SITE_ID:-}"
project_id="${BOOKMARK_PROJECT_ID:-}"
title="${BOOKMARK_TITLE:-new_tech}"
description="${BOOKMARK_DESCRIPTION:-새로운 추론 기술을 날짜별·개념별로 정리한 기술 공유 사이트}"

fail() {
  echo "bookmark deploy: $*" >&2
  exit 1
}

[[ -n "$base_url" ]] || fail "BOOKMARK_BASE_URL is required"
[[ "$mode" == "create" || "$mode" == "update" ]] || fail "mode must be create or update"
[[ -f "$entry_path" ]] || fail "entry file does not exist: $entry_path"
command -v curl >/dev/null || fail "curl is required"
command -v jq >/dev/null || fail "jq is required"

base_url="${base_url%/}"

curl_common=(
  --silent
  --show-error
  --fail-with-body
  --location
)

if [[ "${BOOKMARK_INSECURE_TLS:-0}" == "1" ]]; then
  curl_common+=(--insecure)
fi

if [[ -n "${BOOKMARK_AUTH_TOKEN:-}" ]]; then
  curl_common+=(--header "Authorization: Bearer ${BOOKMARK_AUTH_TOKEN}")
fi

site_files=(index.html new_tech.html)
while IFS= read -r -d '' path; do
  site_files+=("$path")
done < <(find assets content -type f -print0 | sort -z)

file_count="${#site_files[@]}"
(( file_count <= 500 )) || fail "site contains more than 500 files"

total_bytes=0
for path in "${site_files[@]}"; do
  [[ -f "$path" ]] || fail "site file does not exist: $path"
  file_bytes="$(stat -c '%s' "$path")"
  (( file_bytes <= 10 * 1024 * 1024 )) || fail "file exceeds 10 MiB: $path"
  total_bytes=$((total_bytes + file_bytes))
done
(( total_bytes <= 25 * 1024 * 1024 )) || fail "site exceeds 25 MiB"

manifest="$({ printf '%s\n' "${site_files[@]}"; } | jq -Rsc 'split("\n") | map(select(length > 0) | {path: .})')"

multipart=(
  --form-string "directoryName=${directory_name}"
  --form-string "manifest=${manifest}"
)
for path in "${site_files[@]}"; do
  multipart+=(--form "files=@${path};filename=$(basename "$path")")
done

if [[ "$mode" == "create" ]]; then
  [[ -n "$project_id" ]] || fail "BOOKMARK_PROJECT_ID is required for create"
  response="$(curl "${curl_common[@]}" \
    --request POST \
    --form-string "bookmarkProjectId=${project_id}" \
    --form-string "title=${title}" \
    --form-string "description=${description}" \
    --form-string "entryPath=${entry_path}" \
    "${multipart[@]}" \
    "${base_url}/api/bookmark-sites")"
  site_id="$(jq -er '.id' <<<"$response")"
  revision="$(jq -er '.source.revision' <<<"$response")"
  site_path="$(jq -er '.url' <<<"$response")"
  if [[ "$site_path" == http://* || "$site_path" == https://* ]]; then
    site_url="$site_path"
  else
    site_url="${base_url}${site_path}"
  fi
else
  [[ -n "$site_id" ]] || fail "BOOKMARK_SITE_ID is required for update"
  status="$(curl "${curl_common[@]}" \
    --header 'Accept: application/json' \
    "${base_url}/api/bookmark-sites/${site_id}/status")"
  expected_revision="$(jq -er '.revision' <<<"$status")"
  response="$(curl "${curl_common[@]}" \
    --request PUT \
    --form-string "expectedRevision=${expected_revision}" \
    --form-string "entryPath=${entry_path}" \
    "${multipart[@]}" \
    "${base_url}/api/bookmark-sites/${site_id}")"
  revision="$(jq -er '.revision' <<<"$response")"
  (( revision > expected_revision )) || fail "server did not advance the site revision"
  site_url="${base_url}/api/bookmark-sites/${site_id}/files/${entry_path}?revision=${revision}"
fi

verified_status="$(curl "${curl_common[@]}" \
  --header 'Accept: application/json' \
  "${base_url}/api/bookmark-sites/${site_id}/status")"
jq -e \
  --argjson expected_revision "$revision" \
  --arg expected_entry "$entry_path" \
  '.revision == $expected_revision and .entryPath == $expected_entry' \
  <<<"$verified_status" >/dev/null || fail "deployed status does not match the upload"

page="$(curl "${curl_common[@]}" "$site_url")"
grep -q '<html' <<<"$page" || fail "deployed entry is not HTML"
grep -q 'NEW_TECH' <<<"$page" || fail "deployed entry does not contain NEW_TECH"

echo "bookmark_site_id=${site_id}"
echo "bookmark_revision=${revision}"
echo "bookmark_url=${site_url}"
echo "bookmark_files=${file_count}"
echo "bookmark_bytes=${total_bytes}"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "site_id=${site_id}"
    echo "revision=${revision}"
    echo "url=${site_url}"
  } >>"$GITHUB_OUTPUT"
fi

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo "### Bookmark HTML deployment"
    echo
    echo "- Site ID: \`${site_id}\`"
    echo "- Revision: \`${revision}\`"
    echo "- Entry: \`${entry_path}\`"
    echo "- Files: \`${file_count}\`"
    echo "- Bytes: \`${total_bytes}\`"
    echo "- URL: ${site_url}"
  } >>"$GITHUB_STEP_SUMMARY"
fi
