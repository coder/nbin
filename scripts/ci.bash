#!/usr/bin/env bash
# ci.bash -- Build from CI.

set -Eeuo pipefail

function docker-build() {
  local image="$1" ; shift
  local prebuild_command="$1" ; shift

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

  [[ -n $prebuild_command ]] && docker-exec "$prebuild_command"

  case $image in
    *armv7hf* | *aarch64*)
      docker-exec "cross-build-start"
      docker-exec "cd /src && yarn build"
      docker-exec "cd /src && yarn test"
      docker-exec "cross-build-end"
      ;;
    *)
      docker-exec "cd /src && yarn build"
      docker-exec "cd /src && yarn test"
      ;;
  esac

  docker kill "$containerId"
}

function mac-build() {
  yarn build
  yarn test
}

function main() {
  cd "$(dirname "$0")/.."

  local node_version=12.14.0
  local version
  version=$(grep version ./package.json | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[:space:]')

  local binary_name="node-$node_version-${TARGET:-darwin}"
  if [[ $OSTYPE == "darwin"* ]]; then
    binary_name="$binary_name-x86_64"
    mac-build
  else
    local image="codercom/nbin-$TARGET"
    local prebuild_command=""
    case $TARGET in
      "alpine") binary_name="$binary_name-x86_64" ;;
      "centos")
        prebuild_command="source /opt/rh/devtoolset-6/enable"
        binary_name="$binary_name-x86_64"
        ;;
    esac
    docker-build "$image" "$prebuild_command"
  fi

  mkdir -p "./build/$version"
  cp ./lib/node/node "./build/$version/$binary_name"
}

main "$@"
