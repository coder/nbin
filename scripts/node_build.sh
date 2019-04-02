#!/bin/bash

cd "$(dirname "$0")"
source ./vars.sh
cd ../lib/node

export CC="ccache gcc-7"
export CXX='ccache g++-7'
echo "Configuring with --dest-cpu=x64"
./configure --link-module './nbin.js' --link-module './lib/_third_party_main.js' --dest-cpu=x64
make -j2 &>/dev/null &
pid=$!
(
	while true; do
		echo still running
		sleep 60
	done
) &
wait "$pid"
cd ../../

mkdir -p ./build/$PACKAGE_VERSION


if [[ "$OSTYPE" == "linux-gnu" ]]; then
	OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
	OS="darwin"
fi

ARCH=$(uname -m)
BINARY_NAME="node-${NODE_VERSION}-${OS}-${ARCH}"

cp ./lib/node/out/Release/node ./build/$PACKAGE_VERSION/$BINARY_NAME
