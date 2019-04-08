#!/bin/bash

cd "$(dirname "$0")"
cd ../lib/node
git diff -w -- lib/internal/modules/cjs/loader.js lib/internal/bootstrap/node.js src/node.cc --unified=0 > ../../node.patch
