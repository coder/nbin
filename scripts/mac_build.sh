#!/bin/bash

cd "$(dirname "$0")"
source ./vars.sh
cd ../lib/node

export CCACHE_DIR="/ccache"
./build.sh

ARCH=$(uname -m)
BINARY_NAME="node-${NODE_VERSION}-darwin-x64"

cp ./out/Release/node ../../build/$PACKAGE_VERSION/$BINARY_NAME
