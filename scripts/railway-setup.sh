#!/bin/bash

# Railway Setup Script - Creates and configures all services
# Usage: ./scripts/railway-setup.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
WORKERS_ENV_FILE="$PROJECT_ROOT/workers/.env"

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

# Worker types that need WORKER_TYPE env var
WORKER_TYPES=(
  "generator"
  "validator"
  "publisher"
  "resolver"
  "scheduler"
  "dispute-agent"
  "crawler"
  "extractor"
)

echo -e "${GREEN}=== Railway Setup ===${NC}"
echo ""

# Get existing services
echo -e "${BLUE}Checking existing services...${NC}"
EXISTING_SERVICES=$(railway service status --all 2>/dev/null | grep -E '^\S+' | awk '{print $1}' || echo "")
echo ""

# Function to check if service exists
service_exists() {
  local service=$1
  echo "$EXISTING_SERVICES" | grep -qw "$service"
}

# Parse .env file and build --variables args
build_env_args() {
  local env_file=$1
  local extra_vars=$2  # Additional vars like WORKER_TYPE=generator
  local args=""

  if [ -f "$env_file" ]; then
    while IFS= read -r line || [ -n "$line" ]; do
      # Skip empty lines and comments
      [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
      # Extract KEY=VALUE (handle values with special chars)
      if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
        key="${BASH_REMATCH[1]}"
        value="${BASH_REMATCH[2]}"
        args="$args --variables \"$key=$value\""
      fi
    done < "$env_file"
  fi

  # Add extra vars
  if [ -n "$extra_vars" ]; then
    args="$args --variables \"$extra_vars\""
  fi

  echo "$args"
}

# Create service if it doesn't exist
create_service_if_needed() {
  local service=$1
  local worker_type=$2  # Optional, for workers
  local is_worker=$3    # "true" if worker

  if service_exists "$service"; then
    echo -e "${BLUE}[EXISTS]${NC} ${service} - skipping"
    return 0
  fi

  echo -e "${YELLOW}[CREATE]${NC} ${service}..."

  if [ "$is_worker" = "true" ]; then
    # Worker service - load env from workers/.env + WORKER_TYPE
    local env_args=$(build_env_args "$WORKERS_ENV_FILE" "WORKER_TYPE=$worker_type")

    # Use eval to properly handle the quoted arguments
    if eval "railway add --service \"$service\" $env_args" 2>/dev/null; then
      echo -e "${GREEN}[OK]${NC} ${service} created with env vars from workers/.env"
    else
      echo -e "${RED}[FAIL]${NC} ${service}"
      return 1
    fi
  else
    # Regular service (backend)
    if railway add --service "$service" 2>/dev/null; then
      echo -e "${GREEN}[OK]${NC} ${service} created"
    else
      echo -e "${RED}[FAIL]${NC} ${service}"
      return 1
    fi
  fi
}

# Check for workers .env file
if [ ! -f "$WORKERS_ENV_FILE" ]; then
  echo -e "${YELLOW}Warning: workers/.env not found${NC}"
  echo "Worker services will be created without environment variables."
  echo "You can add them manually in Railway dashboard."
  echo ""
fi

echo -e "${YELLOW}Setting up services...${NC}"
echo ""

# Create backend
create_service_if_needed "backend" "" "false"

# Create all workers with env vars
for worker in "${WORKER_TYPES[@]}"; do
  create_service_if_needed "$worker" "$worker" "true"
done

echo ""
echo -e "${GREEN}=== Setup complete ===${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Configure Dockerfiles in Railway dashboard:"
echo "     - Backend: Dockerfile.backend"
echo "     - Workers: workers/Dockerfile"
echo "  2. For backend, add its env vars manually (or use railway variables)"
echo ""
echo "To deploy: ./scripts/deploy-all.sh --parallel"
