#!/usr/bin/env bash
set -e

VPS_HOST="root@139.224.15.203"
VPS_APP_DIR="/root/ham-exam-web"
TARBALL="/tmp/ham-exam-deploy.tar.gz"

echo "==> Building..."
npm run build

echo "==> Packaging..."
tar -czf "$TARBALL" .next public package.json package-lock.json next.config.ts

echo "==> Uploading..."
scp "$TARBALL" "$VPS_HOST:/root/"

echo "==> Deploying on VPS..."
ssh "$VPS_HOST" "
  cd $VPS_APP_DIR &&
  tar -xzf /root/ham-exam-deploy.tar.gz &&
  npm ci --omit=dev &&
  pm2 restart ham-exam
"

echo "==> Done! http://139.224.15.203"
