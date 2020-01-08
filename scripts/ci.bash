#!/usr/bin/env bash
# travis.bash -- Build from CI.

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
      docker-exec-build ". /opt/rh/devtoolset-6/enable &&"
      docker-exec "cd /src && npm rebuild" # So the native module works.
      ;;
    *)
      docker-exec-build
      ;;
  esac

  docker-exec "cd /src && ./node_modules/.bin/mocha"

  docker kill "$containerId"
}

function local-build() {
  yarn build:node
  yarn test
}

function main() {
  cd "$(dirname "$0")/.."

  local version
  version=$(grep version ./package.json | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[:space:]')

  yarn build:nbin
  yarn build:bundle

  local platform="${PLATFORM:-linux}"
  local arch="${ARCH:-x86_64}"
  echo "Building $platform-$arch"

  case $platform in
    "alpine"|"centos") docker-build "codercom/nbin-$platform" ;;
    *                ) local-build ;;
  esac

  local node_version
  node_version=$(NBIN_BYPASS=true ./lib/node/node --version | sed 's/^v//')
  local binary_name="node-$node_version-$platform-$arch"

  mkdir -p "./build/$version"
  cp ./lib/node/node "./build/$version/$binary_name"

  echo "Copied binary to ./build/$version/$binary_name"

  yarn verify
}

main "$@"
