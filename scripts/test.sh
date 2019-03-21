#!/bin/bash

cd "$(dirname "$0")"
cd ..
rm lib/node/test/fixtures/packages/invalid/package.json
npm run test
