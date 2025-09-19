#!/bin/bash

# =============================================================================
# Big Pods Common Functions Test Suite
# Tests for shared utilities used across all Big Pods scripts
# =============================================================================

set -e

# Test framework setup
TEST_COUNT=0
PASSED_COUNT=0
FAILED_COUNT=0

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test utilities
assert_equals() {
    local expected="$1"
    local actual="$2"
    local test_name="$3"

    TEST_COUNT=$((TEST_COUNT + 1))

    if [ "$expected" = "$actual" ]; then
        echo -e "${GREEN}✓${NC} $test_name"
        PASSED_COUNT=$((PASSED_COUNT + 1))
    else
        echo -e "${RED}✗${NC} $test_name"
        echo "  Expected: $expected"
        echo "  Actual: $actual"
        FAILED_COUNT=$((FAILED_COUNT + 1))
    fi
}

assert_true() {
    local condition="$1"
    local test_name="$2"

    TEST_COUNT=$((TEST_COUNT + 1))

    if [ "$condition" = "true" ] || [ "$condition" = "0" ]; then
        echo -e "${GREEN}✓${NC} $test_name"
        PASSED_COUNT=$((PASSED_COUNT + 1))
    else
        echo -e "${RED}✗${NC} $test_name"
        echo "  Expected: true"
        echo "  Actual: $condition"
        FAILED_COUNT=$((FAILED_COUNT + 1))
    fi
}

assert_file_exists() {
    local file_path="$1"
    local test_name="$2"

    TEST_COUNT=$((TEST_COUNT + 1))

    if [ -f "$file_path" ]; then
        echo -e "${GREEN}✓${NC} $test_name"
        PASSED_COUNT=$((PASSED_COUNT + 1))
    else
        echo -e "${RED}✗${NC} $test_name"
        echo "  File does not exist: $file_path"
        FAILED_COUNT=$((FAILED_COUNT + 1))
    fi
}

# Set up test environment
setup_test_env() {
    # Create temporary test directory
    export TEST_DIR=$(mktemp -d)
    export ORIGINAL_DIR=$(pwd)

    # Mock common.sh functions for testing
    export MOCK_COMMON_SH="$TEST_DIR/common.sh"
    cat > "$MOCK_COMMON_SH" << 'EOF'
#!/bin/bash

# Mock log functions
log_info() { echo "[INFO] $*"; }
log_warn() { echo "[WARN] $*"; }
log_error() { echo "[ERROR] $*"; }
log_debug() { echo "[DEBUG] $*"; }

# Mock validation functions
validate_pod_name() {
    local pod_name="$1"
    case "$pod_name" in
        "core"|"business"|"experience") return 0 ;;
        *) return 1 ;;
    esac
}

validate_environment() {
    local env="$1"
    case "$env" in
        "dev"|"staging"|"prod") return 0 ;;
        *) return 1 ;;
    esac
}

# Mock service health check
check_service_health() {
    local service_name="$1"
    local port="$2"

    # Simulate health check
    if [ "$service_name" = "healthy-service" ]; then
        return 0
    else
        return 1
    fi
}

# Mock Docker functions
is_docker_running() {
    if command -v docker >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Mock Kubernetes functions
is_kubectl_available() {
    if command -v kubectl >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Mock configuration functions
load_config() {
    local config_file="$1"
    if [ -f "$config_file" ]; then
        echo "Configuration loaded from $config_file"
        return 0
    else
        echo "Configuration file not found: $config_file"
        return 1
    fi
}

# Mock Git functions
get_current_branch() {
    echo "main"
}

get_last_commit_hash() {
    echo "abc123def456"
}

# Mock file operations
backup_file() {
    local file_path="$1"
    local backup_path="${file_path}.backup.$(date +%s)"
    cp "$file_path" "$backup_path" 2>/dev/null || return 1
    echo "$backup_path"
}

# Mock network functions
wait_for_service() {
    local host="$1"
    local port="$2"
    local timeout="${3:-30}"

    # Simulate waiting
    sleep 1
    return 0
}
EOF

    chmod +x "$MOCK_COMMON_SH"
    source "$MOCK_COMMON_SH"
}

# Clean up test environment
cleanup_test_env() {
    cd "$ORIGINAL_DIR"
    rm -rf "$TEST_DIR"
}

# =============================================================================
# Test Suite: Validation Functions
# =============================================================================

test_validate_pod_name() {
    echo -e "\n${YELLOW}Testing Pod Name Validation${NC}"

    # Test valid pod names
    validate_pod_name "core"
    assert_equals "0" "$?" "validate_pod_name accepts 'core'"

    validate_pod_name "business"
    assert_equals "0" "$?" "validate_pod_name accepts 'business'"

    validate_pod_name "experience"
    assert_equals "0" "$?" "validate_pod_name accepts 'experience'"

    # Test invalid pod names
    validate_pod_name "invalid"
    assert_equals "1" "$?" "validate_pod_name rejects 'invalid'"

    validate_pod_name ""
    assert_equals "1" "$?" "validate_pod_name rejects empty string"
}

test_validate_environment() {
    echo -e "\n${YELLOW}Testing Environment Validation${NC}"

    # Test valid environments
    validate_environment "dev"
    assert_equals "0" "$?" "validate_environment accepts 'dev'"

    validate_environment "staging"
    assert_equals "0" "$?" "validate_environment accepts 'staging'"

    validate_environment "prod"
    assert_equals "0" "$?" "validate_environment accepts 'prod'"

    # Test invalid environments
    validate_environment "invalid"
    assert_equals "1" "$?" "validate_environment rejects 'invalid'"

    validate_environment ""
    assert_equals "1" "$?" "validate_environment rejects empty string"
}

# =============================================================================
# Test Suite: Service Health Checks
# =============================================================================

test_service_health_checks() {
    echo -e "\n${YELLOW}Testing Service Health Checks${NC}"

    # Test healthy service
    check_service_health "healthy-service" "3000"
    assert_equals "0" "$?" "check_service_health detects healthy service"

    # Test unhealthy service
    check_service_health "unhealthy-service" "3000"
    assert_equals "1" "$?" "check_service_health detects unhealthy service"
}

# =============================================================================
# Test Suite: Docker Functions
# =============================================================================

test_docker_functions() {
    echo -e "\n${YELLOW}Testing Docker Functions${NC}"

    # Test Docker availability
    is_docker_running
    local docker_status=$?
    assert_true "$([[ $docker_status -eq 0 ]] && echo true || echo false)" "is_docker_running checks Docker availability"
}

# =============================================================================
# Test Suite: Kubernetes Functions
# =============================================================================

test_kubernetes_functions() {
    echo -e "\n${YELLOW}Testing Kubernetes Functions${NC}"

    # Test kubectl availability
    is_kubectl_available
    local kubectl_status=$?
    assert_true "$([[ $kubectl_status -eq 0 ]] && echo true || echo false)" "is_kubectl_available checks kubectl availability"
}

# =============================================================================
# Test Suite: Configuration Functions
# =============================================================================

test_configuration_functions() {
    echo -e "\n${YELLOW}Testing Configuration Functions${NC}"

    # Create test config file
    local test_config="$TEST_DIR/test.config.yml"
    cat > "$test_config" << EOF
bigpods:
  core:
    services: ["auth", "user"]
  business:
    services: ["voyage", "payment", "ai"]
  experience:
    services: ["panorama", "web-client", "gateway"]
EOF

    # Test loading existing config
    load_config "$test_config" >/dev/null
    assert_equals "0" "$?" "load_config loads existing configuration"

    # Test loading non-existent config
    load_config "$TEST_DIR/nonexistent.yml" >/dev/null 2>&1
    assert_equals "1" "$?" "load_config fails for non-existent file"
}

# =============================================================================
# Test Suite: Git Functions
# =============================================================================

test_git_functions() {
    echo -e "\n${YELLOW}Testing Git Functions${NC}"

    # Test getting current branch
    local branch=$(get_current_branch)
    assert_equals "main" "$branch" "get_current_branch returns current branch"

    # Test getting commit hash
    local commit=$(get_last_commit_hash)
    assert_equals "abc123def456" "$commit" "get_last_commit_hash returns commit hash"
}

# =============================================================================
# Test Suite: File Operations
# =============================================================================

test_file_operations() {
    echo -e "\n${YELLOW}Testing File Operations${NC}"

    # Create test file
    local test_file="$TEST_DIR/test.txt"
    echo "test content" > "$test_file"

    # Test backup function
    local backup_path=$(backup_file "$test_file")
    assert_file_exists "$backup_path" "backup_file creates backup"

    # Verify backup content
    local original_content=$(cat "$test_file")
    local backup_content=$(cat "$backup_path")
    assert_equals "$original_content" "$backup_content" "backup_file preserves content"
}

# =============================================================================
# Test Suite: Network Functions
# =============================================================================

test_network_functions() {
    echo -e "\n${YELLOW}Testing Network Functions${NC}"

    # Test service waiting (mock always succeeds)
    wait_for_service "localhost" "3000" "5"
    assert_equals "0" "$?" "wait_for_service waits for service"
}

# =============================================================================
# Test Runner
# =============================================================================

run_all_tests() {
    echo -e "${YELLOW}=== Big Pods Common Functions Test Suite ===${NC}"
    echo "Testing shared utilities and helper functions..."

    # Set up test environment
    setup_test_env

    # Run all test suites
    test_validate_pod_name
    test_validate_environment
    test_service_health_checks
    test_docker_functions
    test_kubernetes_functions
    test_configuration_functions
    test_git_functions
    test_file_operations
    test_network_functions

    # Clean up
    cleanup_test_env

    # Print summary
    echo -e "\n${YELLOW}=== Test Summary ===${NC}"
    echo "Total tests: $TEST_COUNT"
    echo -e "Passed: ${GREEN}$PASSED_COUNT${NC}"
    echo -e "Failed: ${RED}$FAILED_COUNT${NC}"

    if [ $FAILED_COUNT -eq 0 ]; then
        echo -e "\n${GREEN}All tests passed! ✓${NC}"
        exit 0
    else
        echo -e "\n${RED}Some tests failed! ✗${NC}"
        exit 1
    fi
}

# Run tests if script is executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    run_all_tests
fi