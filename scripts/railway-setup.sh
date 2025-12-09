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

# Worker types
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

# Set variable on a service
set_service_var() {
  local service=$1
  local key=$2
  local value=$3
  railway variables set "$key=$value" --service "$service" 2>/dev/null
}

# Update existing service with all env vars
update_service_vars() {
  local service=$1
  local is_worker=$2
  local worker_type=$3

  echo -e "${YELLOW}[UPDATE]${NC} ${service} - setting variables..."

  # Set Dockerfile path
  if [ "$is_worker" = "true" ]; then
    set_service_var "$service" "RAILWAY_DOCKERFILE_PATH" "workers/Dockerfile"
    set_service_var "$service" "WORKER_TYPE" "$worker_type"

    # Load env vars from workers/.env
    if [ -f "$WORKERS_ENV_FILE" ]; then
      while IFS= read -r line || [ -n "$line" ]; do
        [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
        if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
          key="${BASH_REMATCH[1]}"
          value="${BASH_REMATCH[2]}"
          set_service_var "$service" "$key" "$value"
        fi
      done < "$WORKERS_ENV_FILE"
    fi
  else
    set_service_var "$service" "RAILWAY_DOCKERFILE_PATH" "Dockerfile.backend"
  fi

  echo -e "${GREEN}[OK]${NC} ${service} variables updated"
}

# Create service with env vars
create_service() {
  local service=$1
  local is_worker=$2
  local worker_type=$3

  echo -e "${YELLOW}[CREATE]${NC} ${service}..."

  # Create the service first (empty)
  if railway add --service "$service" 2>/dev/null; then
    # Then update its variables
    update_service_vars "$service" "$is_worker" "$worker_type"
  else
    echo -e "${RED}[FAIL]${NC} ${service} - could not create"
    return 1
  fi
}

# Setup service (create or update)
setup_service() {
  local service=$1
  local is_worker=$2
  local worker_type=$3

  if service_exists "$service"; then
    update_service_vars "$service" "$is_worker" "$worker_type"
  else
    create_service "$service" "$is_worker" "$worker_type"
  fi
}

# Check for workers .env file
if [ ! -f "$WORKERS_ENV_FILE" ]; then
  echo -e "${YELLOW}Warning: workers/.env not found${NC}"
  echo "Worker services will only have WORKER_TYPE and RAILWAY_DOCKERFILE_PATH set."
  echo ""
fi

echo -e "${YELLOW}Setting up services...${NC}"
echo ""

# Setup backend
setup_service "backend" "false" ""

# Setup all workers
for worker in "${WORKER_TYPES[@]}"; do
  setup_service "$worker" "true" "$worker"
done

echo ""
echo -e "${GREEN}=== Setup complete ===${NC}"
echo ""
echo "All services have RAILWAY_DOCKERFILE_PATH configured."
echo ""
echo "To deploy: ./scripts/deploy-all.sh --parallel"
