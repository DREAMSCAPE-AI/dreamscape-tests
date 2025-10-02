# Big Pods Test Suite

Comprehensive test suite for Big Pods automation scripts related to ticket **DR-331**.

## Overview

This test suite validates the Big Pods automation scripts located in `dreamscape-infra/scripts/bigpods/`. It ensures that all scripts are properly configured, executable, and function correctly within the DreamScape hybrid architecture.

## Test Structure

```
tests/bigpods/
├── README.md              # This file
├── run_all_tests.sh       # Main test runner
├── test_common.sh         # Tests for common library functions
└── test_scripts.sh        # Tests for Big Pods scripts
```

## Test Categories

### 1. Common Library Tests (`test_common.sh`)
- **Validation Functions**: Pod name and environment validation
- **Service Health Checks**: Service availability and health monitoring
- **Docker Functions**: Docker availability and operations
- **Kubernetes Functions**: kubectl availability and cluster operations
- **Configuration Functions**: Configuration file loading and validation
- **Git Functions**: Git operations and repository management
- **File Operations**: File backup and manipulation utilities
- **Network Functions**: Service connectivity and waiting utilities

### 2. Script Tests (`test_scripts.sh`)
- **File Validation**: Script existence and permissions
- **Help Options**: Command-line help and usage information
- **Common Library Integration**: Proper sourcing of shared functions
- **Configuration Validation**: YAML configuration file structure
- **Error Handling**: Proper error codes and failure modes
- **Integration**: Cross-script compatibility and dependencies

## Running Tests

### Quick Start
```bash
# Run all tests
./run_all_tests.sh

# Run specific test suite
./run_all_tests.sh common    # Common library tests only
./run_all_tests.sh scripts   # Script tests only
```

### Advanced Usage
```bash
# Verbose output
./run_all_tests.sh --verbose all

# Quiet mode
./run_all_tests.sh --quiet

# Custom scripts path
./run_all_tests.sh --scripts-path /custom/path/to/scripts

# Continue on failure
./run_all_tests.sh --continue-on-failure
```

### Individual Test Files
```bash
# Run individual test files directly
./test_common.sh
./test_scripts.sh
```

## Test Environment Requirements

### Prerequisites
- **Bash 4.0+**: Required for test framework
- **dreamscape-infra**: Must be accessible at `../../dreamscape-infra/`
- **Big Pods Scripts**: All automation scripts must be present
- **Configuration**: `.dreamscape.config.yml` must be properly configured

### Environment Variables
```bash
export SCRIPTS_PATH="/path/to/dreamscape-infra/scripts/bigpods"  # Custom script path
export VERBOSE_MODE=true                                         # Enable verbose output
export QUIET_MODE=true                                          # Enable quiet mode
```

## Test Output

### Success Indicators
- ✓ **Green checkmarks**: Individual test passed
- 🎉 **Success banner**: All tests passed
- **Exit code 0**: Test suite completed successfully

### Failure Indicators
- ✗ **Red X marks**: Individual test failed
- ❌ **Failure banner**: Some tests failed
- **Exit code 1**: Test suite had failures

### Example Output
```
╔══════════════════════════════════════════════════════════════════════════════╗
║                          BIG PODS TEST SUITE                                ║
║                     Comprehensive Testing Framework                         ║
║                         DR-331 - Big Pods Tests                            ║
╚══════════════════════════════════════════════════════════════════════════════╝

[INFO] Performing pre-flight checks...
[SUCCESS] Pre-flight checks completed

┌─────────────────────────────────────────────────────────────────────┐
│ TEST SUITE: Common Library Functions                                 │
└─────────────────────────────────────────────────────────────────────┘

Testing Pod Name Validation
✓ validate_pod_name accepts 'core'
✓ validate_pod_name accepts 'business'
✓ validate_pod_name accepts 'experience'
✓ validate_pod_name rejects 'invalid'

[SUCCESS] Test suite 'Common Library Functions' passed (2s)
```

## Integration with CI/CD

### GitHub Actions
This test suite is designed to integrate with GitHub Actions workflows:

```yaml
- name: Run Big Pods Tests
  run: |
    cd dreamscape-tests/tests/bigpods
    ./run_all_tests.sh --quiet
```

### Local Development
```bash
# Before committing changes
cd dreamscape-tests/tests/bigpods
./run_all_tests.sh

# Quick validation
./run_all_tests.sh scripts
```

## Test Coverage

### Validated Components
- ✅ **9 Big Pods Scripts**: All automation scripts
- ✅ **Common Library**: Shared utility functions
- ✅ **Configuration**: YAML configuration validation
- ✅ **Error Handling**: Proper exit codes and error messages
- ✅ **Integration**: Script interdependencies
- ✅ **Security**: Basic security checks

### Test Metrics
- **Script Files**: Existence, permissions, syntax
- **Help Options**: Command-line interface validation
- **Common Functions**: Library function availability
- **Configuration**: YAML structure and content
- **Error Handling**: Exit codes and error messages
- **Performance**: Execution time within reasonable limits

## Troubleshooting

### Common Issues

#### "Scripts directory not found"
```bash
# Solution: Check scripts path
export SCRIPTS_PATH="/correct/path/to/dreamscape-infra/scripts/bigpods"
```

#### "Test file not found"
```bash
# Solution: Ensure you're in the correct directory
cd dreamscape-tests/tests/bigpods
```

#### "Permission denied"
```bash
# Solution: Make test files executable
chmod +x *.sh
```

### Debug Mode
```bash
# Enable debug output
export VERBOSE_MODE=true
./run_all_tests.sh
```

## Contributing

### Adding New Tests
1. Add test functions to appropriate test file
2. Update test documentation
3. Ensure tests follow existing patterns
4. Test locally before committing

### Test Function Pattern
```bash
test_new_feature() {
    echo -e "\n${YELLOW}Testing New Feature${NC}"

    # Your test logic here
    assert_equals "expected" "actual" "test description"
}
```

## Related Documentation

- **Big Pods Scripts**: `dreamscape-infra/scripts/bigpods/README.md`
- **Configuration**: `dreamscape-infra/.dreamscape.config.yml`
- **Main Project**: `dreamscape-services/CLAUDE.md`
- **Jira Ticket**: [DR-331 - US-INFRA-015 Scripts d'Automatisation Big Pods](https://epitech-team-t7wc668a.atlassian.net/browse/DR-331)

## Support

For issues related to:
- **Test Failures**: Check individual test output and script logs
- **Missing Scripts**: Ensure dreamscape-infra is properly set up
- **Configuration Issues**: Validate `.dreamscape.config.yml`
- **Performance Issues**: Run with `--verbose` for detailed timing

---

**Branch**: `DR-331-bigpods-tests`
**Repository**: `dreamscape-tests`
**Ticket**: DR-331 - US-INFRA-015 Scripts d'Automatisation Big Pods