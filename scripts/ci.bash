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

  docker-exec "cd /src && ./scripts/node_build.bash"
  docker-exec "cd /src && ./node_modules/.bin/mocha"

  node_version=$(docker-exec "NBIN_BYPASS=true /src/lib/node/node --version | sed 's/^v//'")

  docker kill "$containerId"
}

function local-build() {
  yarn build:node
  yarn test
  node_version=$(NBIN_BYPASS=true ./lib/node/node --version | sed 's/^v//')
}

function main() {
  cd "$(dirname "$0")/.."

  local version
  version=$(grep version ./package.json | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[:space:]')

  yarn build:nbin
  yarn build:bundle

  local node_version="unknown"
  local platform="${PLATFORM:-linux}"
  local arch="${ARCH:-x86_64}"
  echo "Building $platform-$arch"

  case $platform in
    "alpine") docker-build "codercom/nbin-$platform" ;;
    *       ) local-build ;;
  esac

  mkdir -p "./build/$version"
  function copy-binary() {
    binary_name=$1
    cp ./lib/node/node "./build/$version/$binary_name"
    echo "Copied binary to ./build/$version/$binary_name"
  }

  copy-binary "node-$node_version-$platform-$arch"
  if [[ $arch == "amd64" ]] ; then
    copy-binary "node-$node_version-$platform-x86_64"
  fi
}

main "$@"
