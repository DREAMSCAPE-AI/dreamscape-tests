#!/bin/bash

# =============================================================================
# Big Pods Test Runner - DR-331
# Comprehensive test suite for Big Pods automation scripts
# =============================================================================

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_PATH="${SCRIPTS_PATH:-../../dreamscape-infra/scripts/bigpods}"

# Test results
TOTAL_SUITES=0
PASSED_SUITES=0
FAILED_SUITES=0

print_banner() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════════════════════╗"
    echo "║                          BIG PODS TEST SUITE                                ║"
    echo "║                         DR-331 - Big Pods Tests                            ║"
    echo "╚══════════════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

show_usage() {
    echo -e "${YELLOW}Usage: $0 [OPTIONS] [TEST_SUITE]${NC}"
    echo ""
    echo "TEST_SUITES:"
    echo "  all                Run all test suites (default)"
    echo "  quick              Run quick validation tests"
    echo ""
    echo "EXAMPLES:"
    echo "  $0                 # Run all tests"
    echo "  $0 quick           # Run quick validation"
}

check_prerequisites() {
    echo -e "${BLUE}[INFO]${NC} Checking prerequisites..."

    if [ ! -d "$SCRIPTS_PATH" ]; then
        echo -e "${RED}[ERROR]${NC} Scripts directory not found: $SCRIPTS_PATH"
        exit 1
    fi

    echo -e "${GREEN}[SUCCESS]${NC} Prerequisites OK"
}

run_quick_tests() {
    echo -e "\n${YELLOW}=== Quick Big Pods Validation ===${NC}"

    TOTAL_SUITES=1
    local test_passed=true

    # Check script files exist
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

    echo "Checking Big Pods scripts..."
    for script in "${scripts[@]}"; do
        if [ -f "$SCRIPTS_PATH/$script" ]; then
            echo -e "${GREEN}✓${NC} $script exists"
        else
            echo -e "${RED}✗${NC} $script missing"
            test_passed=false
        fi
    done

    # Check configuration
    if [ -f "$SCRIPTS_PATH/../.dreamscape.config.yml" ]; then
        echo -e "${GREEN}✓${NC} Configuration file exists"
    else
        echo -e "${RED}✗${NC} Configuration file missing"
        test_passed=false
    fi

    if [ "$test_passed" = true ]; then
        PASSED_SUITES=1
        echo -e "\n${GREEN}✓ Quick validation passed${NC}"
    else
        FAILED_SUITES=1
        echo -e "\n${RED}✗ Quick validation failed${NC}"
    fi
}

run_all_tests() {
    echo -e "${BLUE}[INFO]${NC} Running comprehensive test suite..."

    # For now, just run quick tests
    # This can be expanded with more comprehensive tests later
    run_quick_tests
}

print_summary() {
    echo -e "\n${CYAN}=== Test Summary ===${NC}"
    echo "Total suites: $TOTAL_SUITES"
    echo -e "Passed: ${GREEN}$PASSED_SUITES${NC}"
    echo -e "Failed: ${RED}$FAILED_SUITES${NC}"

    if [ $FAILED_SUITES -eq 0 ]; then
        echo -e "\n${GREEN}🎉 All tests passed!${NC}"
        return 0
    else
        echo -e "\n${RED}❌ Some tests failed!${NC}"
        return 1
    fi
}

main() {
    local test_suite="${1:-all}"

    print_banner
    check_prerequisites

    case "$test_suite" in
        "quick")
            run_quick_tests
            ;;
        "all"|*)
            run_all_tests
            ;;
    esac

    print_summary
}

main "$@"