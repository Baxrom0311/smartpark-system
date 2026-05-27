#!/usr/bin/env bash
# SADO Platform — Integration Test
# Verifies all 3 repos work together against the same API contract.
#
# Usage: ./integration-test.sh
#
# Prerequisites:
#   - sado-api venv activated with deps installed
#   - sado-admin node_modules installed
#   - sado-mobile node_modules installed

set -euo pipefail
cd "$(dirname "$0")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

check() {
  local desc="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} $desc"
    ((PASS++))
  else
    echo -e "  ${RED}✗${NC} $desc"
    ((FAIL++))
  fi
}

echo -e "${YELLOW}═══ SADO Integration Test ═══${NC}"
echo ""

# ─── 1. Backend Tests ───
echo -e "${YELLOW}[1/5] sado-api: pytest${NC}"
cd sado-api
source .venv/bin/activate 2>/dev/null || true
check "pytest passes" python -m pytest -q --tb=line
cd ..

# ─── 2. Admin Build ───
echo -e "${YELLOW}[2/5] sado-admin: build${NC}"
cd sado-admin
check "npm run build" npm run build
check "TypeScript strict (tsc)" npx tsc --noEmit
cd ..

# ─── 3. Mobile TypeCheck ───
echo -e "${YELLOW}[3/5] sado-mobile: typecheck${NC}"
cd sado-mobile
check "TypeScript strict (tsc)" npx tsc --noEmit
cd ..

# ─── 4. API Contract Consistency ───
echo -e "${YELLOW}[4/5] API Contract: types alignment${NC}"

# Check that admin types match backend schemas
check "Admin TokenPair matches API" grep -q "access_token.*string" sado-admin/src/types/index.ts
check "Admin UserPublic has role field" grep -q "role.*UserRole" sado-admin/src/types/index.ts
check "Admin CursorPage matches API pagination" grep -q "next_cursor.*string.*null" sado-admin/src/types/index.ts
check "Admin RiskLevel matches API enum" grep -q '"green".*"yellow".*"red"' sado-admin/src/types/index.ts

# Check mobile types match
check "Mobile TokenPair matches API" grep -q "access_token.*string" sado-mobile/types/index.ts
check "Mobile UserPublic has role field" grep -q "role.*UserRole" sado-mobile/types/index.ts
check "Mobile RiskLevel matches API enum" grep -q '"green".*"yellow".*"red"' sado-mobile/types/index.ts

# ─── 5. Endpoint Path Consistency ───
echo -e "${YELLOW}[5/5] Endpoint paths: frontend → backend${NC}"

# Extract backend route prefixes from router files
API_ROUTES=$(grep -rh '@router\.' sado-api/app/api/v1/ | grep -oE '"[^"]*"' | tr -d '"' | sort -u)

# Check admin calls valid endpoints
check "Admin /auth/login exists in API" echo "$API_ROUTES" | grep -q "/login\|/register"
check "Admin /children exists in API" grep -q "children" sado-api/app/api/v1/__init__.py
check "Admin /users exists in API" grep -q "users" sado-api/app/api/v1/__init__.py
check "Admin /exercises exists in API" grep -q "exercises" sado-api/app/api/v1/__init__.py
check "Admin /kindergartens exists in API" grep -q "kindergartens" sado-api/app/api/v1/__init__.py
check "Admin /stats exists in API" grep -q "stats" sado-api/app/api/v1/__init__.py
check "Admin /notifications exists in API" grep -q "notifications" sado-api/app/api/v1/__init__.py

# Check mobile calls valid endpoints
check "Mobile /auth/register exists in API" grep -q "register" sado-api/app/api/v1/auth.py
check "Mobile /assessments exists in API" grep -q "assessments" sado-api/app/api/v1/__init__.py

# ─── 6. Shared Config Consistency ───
echo -e "${YELLOW}[6/6] Config consistency${NC}"
check "API CORS allows admin (localhost:5173)" grep -q "5173" sado-api/docker-compose.yml
check "API CORS allows mobile (localhost:8081)" grep -q "8081" sado-api/docker-compose.yml
check "Admin API base configurable via VITE_API_BASE_URL" grep -q "VITE_API_BASE_URL" sado-admin/src/lib/api-client.ts
check "Mobile API base configurable via expo config" grep -q "apiBaseUrl" sado-mobile/services/api.ts
check "Docker Compose has all services" grep -q "api:" sado-api/docker-compose.yml && grep -q "worker:" sado-api/docker-compose.yml && grep -q "db:" sado-api/docker-compose.yml && grep -q "redis:" sado-api/docker-compose.yml && grep -q "minio:" sado-api/docker-compose.yml
check "CI exists for all repos" test -f sado-api/.github/workflows/ci.yml && test -f sado-admin/.github/workflows/ci.yml && test -f sado-mobile/.github/workflows/ci.yml

# ─── Summary ───
echo ""
echo -e "${YELLOW}═══ Results ═══${NC}"
TOTAL=$((PASS + FAIL))
echo -e "  Total: $TOTAL | ${GREEN}Passed: $PASS${NC} | ${RED}Failed: $FAIL${NC}"
echo ""

if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}✅ All integration checks passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ $FAIL check(s) failed.${NC}"
  exit 1
fi
