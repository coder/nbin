#!/bin/bash

cd "$(dirname "$0")"
cd ..
mkdir -p lib
cd lib
git clone https://github.com/nodejs/node --branch v8.15.0 --depth 1