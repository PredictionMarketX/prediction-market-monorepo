#!/bin/bash

# Deploy all services to Railway
# Usage: ./scripts/deploy-all.sh [--parallel] [--workers-only] [--backend-only]

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# All services
BACKEND="backend"
WORKERS=(
  "generator"
  "validator"
  "publisher"
  "resolver"
  "scheduler"
  "dispute-agent"
  "crawler"
  "extractor"
)

# Check prerequisites
if ! command -v railway &> /dev/null; then
  echo -e "${RED}Error: Railway CLI is not installed${NC}"
  echo "Install with: npm install -g @railway/cli"
  exit 1
fi

if ! railway whoami &> /dev/null; then
  echo -e "${RED}Error: Not logged in to Railway${NC}"
  echo "Run: railway login"
  exit 1
fi

# Parse arguments
PARALLEL=false
WORKERS_ONLY=false
BACKEND_ONLY=false

for arg in "$@"; do
  case $arg in
    --parallel)
      PARALLEL=true
      ;;
    --workers-only)
      WORKERS_ONLY=true
      ;;
    --backend-only)
      BACKEND_ONLY=true
      ;;
  esac
done

echo -e "${GREEN}=== Deploying to Railway ===${NC}"
echo ""

deploy_service() {
  local service=$1
  echo -e "${YELLOW}Deploying ${service}...${NC}"

  if railway up --service "$service" --detach 2>&1; then
    echo -e "${GREEN}${service} deployment started${NC}"
    return 0
  else
    echo -e "${RED}Failed to deploy ${service} (service may not exist)${NC}"
    return 1
  fi
}

# Build list of services to deploy
SERVICES_TO_DEPLOY=()

if ! $WORKERS_ONLY; then
  SERVICES_TO_DEPLOY+=("$BACKEND")
fi

if ! $BACKEND_ONLY; then
  SERVICES_TO_DEPLOY+=("${WORKERS[@]}")
fi

if $PARALLEL; then
  echo -e "${YELLOW}Running deployments in parallel...${NC}"
  echo ""

  pids=()
  for service in "${SERVICES_TO_DEPLOY[@]}"; do
    deploy_service "$service" &
    pids+=($!)
  done

  failed=0
  for pid in "${pids[@]}"; do
    if ! wait $pid; then
      failed=$((failed + 1))
    fi
  done

  if [ $failed -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}$failed deployment(s) failed or service doesn't exist${NC}"
    echo "Run ./scripts/railway-setup.sh to create missing services"
  fi
else
  # Deploy sequentially
  failed=0
  for service in "${SERVICES_TO_DEPLOY[@]}"; do
    if ! deploy_service "$service"; then
      failed=$((failed + 1))
    fi
    echo ""
  done

  if [ $failed -gt 0 ]; then
    echo -e "${YELLOW}$failed deployment(s) failed or service doesn't exist${NC}"
    echo "Run ./scripts/railway-setup.sh to create missing services"
  fi
fi

echo ""
echo -e "${GREEN}=== Deployments initiated ===${NC}"
echo ""
echo "Check status at: https://railway.app/dashboard"
echo "Or run: railway logs --service <service-name>"
