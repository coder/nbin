#!/bin/bash

cd "$(dirname "$0")"
set -euxo pipefail

export CC="ccache gcc"
export CXX="ccache g++"
export CCACHE_DIR="/ccache"
./configure --link-module './nbin.js' --link-module './lib/_third_party_main.js' --dest-cpu=x64 --openssl-no-asm
cores=$(cat /proc/cpuinfo | awk '/^processor/{print $3}' | wc -l)
make -j$cores &>/dev/null &
pid=$!
(
	while true; do
		echo Compiling...
		sleep 60
	done
) &
subshell=$!
wait "$pid"
kill -9 $subshell
