#!/bin/bash

cd "$(dirname "$0")"
cd ../lib/node
git diff -w -- lib/module.js lib/internal/bootstrap_node.js src/node.cc --unified=0 > ../../node.patch
