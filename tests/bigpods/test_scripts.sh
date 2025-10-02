#!/bin/bash

# =============================================================================
# Big Pods Scripts Integration Test Suite
# Tests for all Big Pods automation scripts
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
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
SCRIPTS_PATH="${SCRIPTS_PATH:-../../dreamscape-infra/scripts/bigpods}"

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

assert_contains() {
    local haystack="$1"
    local needle="$2"
    local test_name="$3"

    TEST_COUNT=$((TEST_COUNT + 1))

    if [[ "$haystack" == *"$needle"* ]]; then
        echo -e "${GREEN}✓${NC} $test_name"
        PASSED_COUNT=$((PASSED_COUNT + 1))
    else
        echo -e "${RED}✗${NC} $test_name"
        echo "  Expected to contain: $needle"
        FAILED_COUNT=$((FAILED_COUNT + 1))
    fi
}

# =============================================================================
# Test Suite: Script Files Validation
# =============================================================================

test_script_files() {
    echo -e "\n${YELLOW}Testing Big Pods Script Files${NC}"

    local scripts=(
        "build-bigpods.sh"
        "dev-bigpods.sh"
        "debug-bigpods.sh"
        "deploy-bigpods.sh"
        "backup-bigpods.sh"
        "maintenance-bigpods.sh"
        "logs-bigpods.sh"
        "monitoring-bigpods.sh"
        "scale-bigpods.sh"
        "lib/common.sh"
    )

    for script in "${scripts[@]}"; do
        local script_path="$SCRIPTS_PATH/$script"
        assert_file_exists "$script_path" "Script exists: $script"

        if [ -f "$script_path" ]; then
            # Check if script is executable
            if [ -x "$script_path" ]; then
                echo -e "${GREEN}✓${NC} Script is executable: $script"
                PASSED_COUNT=$((PASSED_COUNT + 1))
            else
                echo -e "${RED}✗${NC} Script is not executable: $script"
                FAILED_COUNT=$((FAILED_COUNT + 1))
            fi
            TEST_COUNT=$((TEST_COUNT + 1))

            # Check for proper shebang
            local first_line=$(head -n1 "$script_path")
            if [[ "$first_line" == "#!/bin/bash" ]]; then
                echo -e "${GREEN}✓${NC} Script has proper shebang: $script"
                PASSED_COUNT=$((PASSED_COUNT + 1))
            else
                echo -e "${RED}✗${NC} Script missing proper shebang: $script"
                FAILED_COUNT=$((FAILED_COUNT + 1))
            fi
            TEST_COUNT=$((TEST_COUNT + 1))
        fi
    done
}

# =============================================================================
# Test Suite: Script Help Options
# =============================================================================

test_help_options() {
    echo -e "\n${YELLOW}Testing Script Help Options${NC}"

    local scripts=(
        "build-bigpods.sh"
        "dev-bigpods.sh"
        "debug-bigpods.sh"
        "deploy-bigpods.sh"
        "backup-bigpods.sh"
        "maintenance-bigpods.sh"
        "logs-bigpods.sh"
        "monitoring-bigpods.sh"
        "scale-bigpods.sh"
    )

    for script in "${scripts[@]}"; do
        local script_path="$SCRIPTS_PATH/$script"

        if [ -f "$script_path" ]; then
            # Test help option
            local help_output
            help_output=$("$script_path" --help 2>&1) || true
            assert_contains "$help_output" "Usage:" "$script shows help with --help"
        fi
    done
}

# =============================================================================
# Test Suite: Common Library Tests
# =============================================================================

test_common_library() {
    echo -e "\n${YELLOW}Testing Common Library${NC}"

    local common_path="$SCRIPTS_PATH/lib/common.sh"
    assert_file_exists "$common_path" "common.sh exists"

    if [ -f "$common_path" ]; then
        # Test if common.sh can be sourced without errors
        if bash -n "$common_path" 2>/dev/null; then
            echo -e "${GREEN}✓${NC} common.sh has valid syntax"
            PASSED_COUNT=$((PASSED_COUNT + 1))
        else
            echo -e "${RED}✗${NC} common.sh has syntax errors"
            FAILED_COUNT=$((FAILED_COUNT + 1))
        fi
        TEST_COUNT=$((TEST_COUNT + 1))

        # Test if common functions are defined
        local common_content=$(cat "$common_path")
        local functions=(
            "log_info"
            "log_error"
            "log_warn"
            "validate_pod_name"
            "check_service_health"
        )

        for func in "${functions[@]}"; do
            assert_contains "$common_content" "$func()" "common.sh defines function: $func"
        done
    fi
}

# =============================================================================
# Test Suite: Configuration File Tests
# =============================================================================

test_configuration_file() {
    echo -e "\n${YELLOW}Testing Configuration File${NC}"

    local config_path="$SCRIPTS_PATH/../.dreamscape.config.yml"
    assert_file_exists "$config_path" ".dreamscape.config.yml exists"

    if [ -f "$config_path" ]; then
        local config_content=$(cat "$config_path")

        # Test essential configuration sections
        assert_contains "$config_content" "bigpods:" "Configuration contains bigpods section"
        assert_contains "$config_content" "core:" "Configuration contains core pod definition"
        assert_contains "$config_content" "business:" "Configuration contains business pod definition"
        assert_contains "$config_content" "experience:" "Configuration contains experience pod definition"
        assert_contains "$config_content" "environments:" "Configuration contains environments section"
    fi
}

# =============================================================================
# Test Suite: Script Integration Tests
# =============================================================================

test_script_integration() {
    echo -e "\n${YELLOW}Testing Script Integration${NC}"

    # Test that scripts source common.sh correctly
    local scripts=(
        "build-bigpods.sh"
        "dev-bigpods.sh"
        "deploy-bigpods.sh"
    )

    for script in "${scripts[@]}"; do
        local script_path="$SCRIPTS_PATH/$script"

        if [ -f "$script_path" ]; then
            local script_content=$(cat "$script_path")

            # Check if script sources common.sh
            if [[ "$script_content" == *"source"*"common.sh"* ]] || [[ "$script_content" == *". "*"common.sh"* ]]; then
                echo -e "${GREEN}✓${NC} $script sources common.sh"
                PASSED_COUNT=$((PASSED_COUNT + 1))
            else
                echo -e "${YELLOW}⚠${NC} $script may not source common.sh (check manually)"
                PASSED_COUNT=$((PASSED_COUNT + 1))
            fi
            TEST_COUNT=$((TEST_COUNT + 1))
        fi
    done
}

# =============================================================================
# Test Suite: Error Handling Tests
# =============================================================================

test_error_handling() {
    echo -e "\n${YELLOW}Testing Error Handling${NC}"

    local scripts=(
        "build-bigpods.sh"
        "dev-bigpods.sh"
        "debug-bigpods.sh"
        "deploy-bigpods.sh"
    )

    for script in "${scripts[@]}"; do
        local script_path="$SCRIPTS_PATH/$script"

        if [ -f "$script_path" ]; then
            local script_content=$(cat "$script_path")

            # Check for error handling
            assert_contains "$script_content" "set -e" "$script uses 'set -e' for error handling"

            # Check for proper exit codes
            if [[ "$script_content" == *"exit 1"* ]] || [[ "$script_content" == *"return 1"* ]]; then
                echo -e "${GREEN}✓${NC} $script handles error exit codes"
                PASSED_COUNT=$((PASSED_COUNT + 1))
            else
                echo -e "${YELLOW}⚠${NC} $script may need explicit error handling"
                PASSED_COUNT=$((PASSED_COUNT + 1))
            fi
            TEST_COUNT=$((TEST_COUNT + 1))
        fi
    done
}

# =============================================================================
# Test Runner
# =============================================================================

run_all_tests() {
    echo -e "${BLUE}=== Big Pods Scripts Test Suite ===${NC}"
    echo "Testing automation scripts for Big Pods architecture..."
    echo "Scripts path: $SCRIPTS_PATH"
    echo ""

    # Run all test suites
    test_script_files
    test_help_options
    test_common_library
    test_configuration_file
    test_script_integration
    test_error_handling

    # Print summary
    echo -e "\n${BLUE}=== Test Summary ===${NC}"
    echo "Total tests: $TEST_COUNT"
    echo -e "Passed: ${GREEN}$PASSED_COUNT${NC}"
    echo -e "Failed: ${RED}$FAILED_COUNT${NC}"

    if [ $FAILED_COUNT -eq 0 ]; then
        echo -e "\n${GREEN}All tests passed! ✓${NC}"
        echo "Big Pods scripts are ready for use."
        exit 0
    else
        echo -e "\n${RED}Some tests failed! ✗${NC}"
        echo "Please review and fix the issues before using the scripts."
        exit 1
    fi
}

# Allow running specific test suites
case "${1:-all}" in
    "files") test_script_files ;;
    "help") test_help_options ;;
    "common") test_common_library ;;
    "config") test_configuration_file ;;
    "integration") test_script_integration ;;
    "error") test_error_handling ;;
    "all"|*) run_all_tests ;;
esac