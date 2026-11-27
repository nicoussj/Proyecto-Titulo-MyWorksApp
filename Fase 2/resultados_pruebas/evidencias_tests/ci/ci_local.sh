#!/bin/bash
# Reproduce los pasos de Web & Desktop CI con Node 22 sobre un clon limpio de la rama.
export PATH=$HOME/node22/bin:$PATH
export CI=true
R=/tmp/ci_sim/MyWorksAppProyect
paso() { echo; echo "=== $1 ($(date '+%H:%M:%S'))"; shift; ( "$@" ) 2>&1 | tail -${COLA:-25}; echo "EXIT ${PIPESTATUS[0]}"; }
echo "node $(node --version) / npm $(npm --version) / rama $(git -C /tmp/ci_sim rev-parse --short HEAD)"
echo "##### job web"
paso "shared: npm ci" bash -c "cd $R/shared && npm ci --no-audit --no-fund"
paso "shared: check:domain" bash -c "cd $R/shared && npm run check:domain"
paso "shared: generate:domain" bash -c "cd $R/shared && npm run generate:domain"
paso "shared: npm test" bash -c "cd $R/shared && npm test"
paso "web: npm ci" bash -c "cd $R/myworksapp_web && npm ci --no-audit --no-fund"
paso "web: lint" bash -c "cd $R/myworksapp_web && npm run lint"
COLA=40 paso "web: npm test" bash -c "cd $R/myworksapp_web && npm test"
paso "web: build" bash -c "cd $R/myworksapp_web && npm run build"
COLA=40 paso "web: e2e" bash -c "cd $R/myworksapp_web && npm run test:e2e"
echo "##### job desktop"
paso "desktop: npm ci" bash -c "cd $R/myworksapp_desktop && npm ci --no-audit --no-fund"
paso "desktop: lint" bash -c "cd $R/myworksapp_desktop && npm run lint"
COLA=40 paso "desktop: npm test" bash -c "cd $R/myworksapp_desktop && npm test"
paso "desktop: build" bash -c "cd $R/myworksapp_desktop && npm run build"
