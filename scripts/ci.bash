#!/usr/bin/env bash
# ci.bash -- Build from CI.

set -Eeuo pipefail

function docker-build() {
  local image="$1" ; shift

  local cache="$HOME/.cache"
  if [[ -n ${XDG_CACHE_HOME:-} ]] ; then
    cache="$XDG_CACHE_HOME"
  elif [[ $OSTYPE == "darwin"* ]]; then
    cache="$HOME/Library/Caches"
  fi

  local containerId
  containerId=$(docker create --network=host --rm -it -v "$(pwd)":/src -v "$cache/ccache/$image:/root/.cache/ccache" "$image")
  docker start "$containerId"

  function docker-exec() {
    docker exec "$containerId" bash -c "$@"
  }

  function docker-exec-build() {
    docker-exec "cd /src && ${1:-} ./scripts/node_build.bash"
  }

  case $image in
    *armv7hf* | *aarch64*)
      docker-exec "cross-build-start"
      docker-exec-build
      docker-exec "cross-build-end"
      ;;
    *centos*)
      # `__STDC_FORMAT_MACROS` is required on some older systems for access to
      # some macros used by Node like `PRIx64`. In newer versions of Node this
      # will already be set and we can remove it here.
      local cpp_flags="-D __STDC_FORMAT_MACROS"

      # `-lrt` provides clock_*; required for gcc < 2.17 (in 2.17 they became
      # part of the main C library).
      local ld_flags="-lrt"

      docker-exec-build ". /opt/rh/devtoolset-6/enable && . /opt/rh/python27/enable && CPPFLAGS='$cpp_flags' LDFLAGS='$ld_flags'"
      ;;
    *)
      docker-exec-build
      ;;
  esac

  docker-exec "cd /src && ./node_modules/.bin/mocha"

  docker kill "$containerId"
}

function mac-build() {
  yarn build:node
  yarn test
}

function main() {
  cd "$(dirname "$0")/.."

  local node_version=12.14.0
  local version
  version=$(grep version ./package.json | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[:space:]')

  yarn build:nbin
  yarn build:bundle

  local binary_name="node-$node_version-${TARGET:-darwin}"
  if [[ $OSTYPE == "darwin"* ]]; then
    binary_name="$binary_name-x86_64"
    mac-build
  else
    local image="codercom/nbin-$TARGET"
    case $TARGET in
      "alpine") binary_name="$binary_name-x86_64" ;;
      "centos")
        binary_name="$binary_name-x86_64"
        ;;
    esac
    docker-build "$image"
  fi

  mkdir -p "./build/$version"
  cp ./lib/node/node "./build/$version/$binary_name"
}

main "$@"
