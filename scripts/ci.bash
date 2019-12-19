#!/usr/bin/env bash
# ci.bash

set -Eeuo pipefail

function docker-build() {
  local image="$1" ; shift
  local binary_name="$1" ; shift
  local prebuild_command="$1" ; shift

  local containerId
  containerId=$(docker create --network=host --rm -it -v "$(pwd)":/src -v "$HOME/.cache:/ccache" "$image")
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

  docker cp "$containerId:/src/lib/node/node" "./build/$version/$binary_name"
  docker kill "$containerId"
}

function mac-build() {
  local version="$1" ; shift
  local node_version="$1" ; shift
  yarn build
  cp ./lib/node/node "./build/$version/node-$node_version-darwin-x86_64"
}

function main() {
  cd "$(dirname "$0")/.."

  local node_version=12.13.1
  local version
  version=$(grep version ./package.json | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[:space:]')

  mkdir -p "./build/$version"

  if [[ $OSTYPE == "darwin"* ]]; then
    mac-build "$version" "$node_version"
  else
    local image="codercom/nbin-$TARGET"
    local binary_name="node-$node_version-$TARGET"
    local prebuild_command=""
    case $TARGET in
      "alpine"        ) binary_name="$binary_name-x86_64" ;;
      "aarch64-alpine") image="codercom/nbin-alpine-aarch64-alpine" ;;
      "armv7hf-alpine") image="codercom/nbin-alpine-armv7hf-alpine" ;;
      "centos")
        prebuild_command="source /opt/rh/devtoolset-6/enable"
        binary_name="$binary_name-x86_64"
        ;;
    esac
    docker-build "$image" "$binary_name" "$prebuild_command"
  fi
}

main "$@"
