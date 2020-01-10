#!/usr/bin/env bash
# cacher.bash -- Restore and rebuild cache.
# Cache paths are designed to work with multi-arch builds and are organized
# based on the branch or tag. The master branch cache is used as a fallback.
# This will download and package the cache but it will not upload it.

set -Eeuo pipefail

# Try restoring from each argument in turn until we get something.
function restore-cache() {
  while (( $# )) ; do
    local branch=$1 ; shift
    if [[ -n $branch ]] ; then
      local cache_path="https://nbin.cdr.sh/cache/$branch/$platform-$arch.tar.gz"
      echo "Trying $cache_path..."
      if wget "$cache_path" ; then
        echo "Unpacking $platform-$arch.tar.gz"
        tar xzvf "$platform-$arch.tar.gz"
      fi
    fi
  done
}

# We only need to cache the ccache directory. Everything inside the cache
# directory will be uploaded as-is to the nbin bucket.
function package-cache() {
  mkdir -p "gcs-cache-upload/cache/$1"
  tar czfv "gcs-cache-upload/cache/$1/$platform-$arch.tar.gz" .cache/ccache
}

function main() {
  cd "$(dirname "$0")/.."

  # Get the branch for this build. We can ignore the master branch since we'll
  # fall back to it below anyway.
  local branch=${DRONE_BRANCH:-${DRONE_SOURCE_BRANCH:-${DRONE_TAG:-""}}}
  [[ $branch == "$DRONE_REPO_BRANCH" ]] && branch=""

  # The cache will be named based on the arch, platform, and libc.
  local arch=${ARCH:-$DRONE_STAGE_ARCH}
  local platform=${PLATFORM:-linux}
  local libc=${LIBC:-}
  if [[ -z $libc ]] ; then
    [[ $DRONE_STAGE_NAME == *alpine* ]] && libc=musl || libc=gcc
  fi

  # The action is determined by the name of the step.
  case $DRONE_STEP_NAME in
    *restore*) restore-cache "$branch" "$DRONE_REPO_BRANCH" ;;
    *rebuild*|*package*) package-cache "$branch" ;;
    *) exit 1 ;;
  esac
}

main "$@"
