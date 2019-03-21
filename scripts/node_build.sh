#!/bin/bash

cd "$(dirname "$0")"
cd ../lib/node
./configure --link-module './nbin.js' --link-module './lib/_third_party_main.js'
make -j8
