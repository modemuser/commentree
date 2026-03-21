#!/bin/sh
rm -rf dist
mkdir -p dist/js
cp index.html style.css dist/
cp js/*.js dist/js/
npx wrangler deploy
