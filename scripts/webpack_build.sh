#!/bin/bash

cd "$(dirname "$0")"
cd ..
npx webpack --config webpack.config.js $*