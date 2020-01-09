#!/usr/bin/env bash
# cache.bash -- Restore and rebuild cache.

set -Eeuo pipefail

function main() {
  cd "$(dirname "$0")/.."

  local action=$1 ; shift
  local cache=$1 ; shift
  local branch=$1 ; shift

  local platform="linux"
  [[ ${OSTYPE:-} == darwin* ]] && platform="darwin"

  local arch
  arch=$(uname -m)

  local libc="glibc"
  local output
  output=$(ldd --version 2>&1 || :)
  [[ $output == musl* ]] && libc="musl"

  local gcs_path="gs://cdr-drone-cache/nbin/$branch/$platform-$arch-$libc"
  local fallback_gcs_path="gs://cdr-drone-cache/nbin/master/$platform-$arch-$libc"

  echo "$KEY_FILE_CONTENTS" | base64 -d > key.json

  case $action in
    "restore")
      echo "Restoring $gcs_path"
      if ! gsutil -o "Credentials:gs_service_key_file=key.json" cp "$gcs_path" cache-download.tar.gz ; then
        echo "Not found; trying $fallback_gcs_path"
        if ! gsutil -o "Credentials:gs_service_key_file=key.json" cp "$fallback_gcs_path" cache-download.tar.gz ; then
          echo "No cache found"
        fi
      fi
      if [[ -f cache-download.tar.gz ]] ; then
        echo "Unpacking cache"
        tar xzf cache-download.tar.gz
        rm cache-download.tar.gz
      fi
      ;;
    "rebuild")
      echo "Packaging $cache"
      tar czf cache-upload.tar.gz "$cache"
      echo "Uploading cache to $gcs_path"
      gsutil -o "Credentials:gs_service_key_file=key.json" cp cache-upload.tar.gz "$gcs_path"
      rm cache-upload.tar.gz
      ;;
    *)
      exit 1
      ;;
  esac

  rm key.json
}

main "$@"
