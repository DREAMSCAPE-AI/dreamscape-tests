#!/usr/bin/env node

/**
 * Validation Script for i18n E2E Test Setup
 *
 * Checks that all prerequisites are in place before running i18n tests:
 * - Web client is running
 * - Translation files exist
 * - Test files are present
 * - Helper functions are available
 *
 * Usage: node validate-i18n-setup.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.bold}${msg}${colors.reset}`),
};

let hasErrors = false;
let hasWarnings = false;

// Helper to check if file exists
function checkFile(filePath, name, critical = true) {
  const fullPath = path.resolve(__dirname, filePath);
  if (fs.existsSync(fullPath)) {
    log.success(`${name} exists`);
    return true;
  } else {
    if (critical) {
      log.error(`${name} not found at: ${fullPath}`);
      hasErrors = true;
    } else {
      log.warning(`${name} not found at: ${fullPath}`);
      hasWarnings = true;
    }
    return false;
  }
}

// Helper to check if web client is running
function checkWebClient() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:5173', (res) => {
      if (res.statusCode === 200 || res.statusCode === 304) {
        log.success('Web client is running on port 5173');
        resolve(true);
      } else {
        log.error(`Web client responded with status ${res.statusCode}`);
        hasErrors = true;
        resolve(false);
      }
    });

    req.on('error', (err) => {
      log.error('Web client is not running on port 5173');
      log.info('Start it with: cd dreamscape-frontend/web-client && npm run dev');
      hasErrors = true;
      resolve(false);
    });

    req.setTimeout(2000, () => {
      req.destroy();
      log.error('Web client connection timeout');
      hasErrors = true;
      resolve(false);
    });
  });
}

// Helper to check directory exists
function checkDirectory(dirPath, name, critical = true) {
  const fullPath = path.resolve(__dirname, dirPath);
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
    log.success(`${name} directory exists`);
    return true;
  } else {
    if (critical) {
      log.error(`${name} directory not found at: ${fullPath}`);
      hasErrors = true;
    } else {
      log.warning(`${name} directory not found at: ${fullPath}`);
      hasWarnings = true;
    }
    return false;
  }
}

// Main validation function
async function validate() {
  console.log(`${colors.bold}${colors.blue}
╔═══════════════════════════════════════════╗
║   i18n E2E Tests - Setup Validation      ║
╚═══════════════════════════════════════════╝
${colors.reset}`);

  // 1. Check test files
  log.section('1. Test Files');
  checkFile(
    'tests/e2e/web-client/language-switching.cy.js',
    'Main test suite',
    true
  );
  checkFile(
    'tests/e2e/web-client/language-switching-example.cy.js',
    'Example tests',
    false
  );

  // 2. Check helper files
  log.section('2. Helper Functions');
  checkFile(
    'cypress/support/language-helpers.js',
    'Language helpers',
    true
  );

  // 3. Check documentation
  log.section('3. Documentation');
  checkFile('I18N_TESTS_README.md', 'README', false);
  checkFile('I18N_TESTS_SUMMARY.md', 'Summary', false);
  checkFile('I18N_TESTS_QUICKSTART.md', 'Quick Start', false);

  // 4. Check Cypress config
  log.section('4. Cypress Configuration');
  checkFile('cypress.config.js', 'Cypress config', true);

  // 5. Check web client is running
  log.section('5. Web Client');
  await checkWebClient();

  // 6. Check translation files (optional but recommended)
  log.section('6. Translation Files (Frontend)');
  const webClientPath = path.resolve(__dirname, '../dreamscape-frontend/web-client');

  if (fs.existsSync(webClientPath)) {
    log.success('Web client directory found');

    const enCommon = path.join(webClientPath, 'public/locales/en/common.json');
    const frCommon = path.join(webClientPath, 'public/locales/fr/common.json');

    if (fs.existsSync(enCommon)) {
      log.success('English translations found');
    } else {
      log.warning('English translations not found');
      log.info(`Expected at: ${enCommon}`);
      hasWarnings = true;
    }

    if (fs.existsSync(frCommon)) {
      log.success('French translations found');
    } else {
      log.warning('French translations not found');
      log.info(`Expected at: ${frCommon}`);
      hasWarnings = true;
    }
  } else {
    log.warning('Web client directory not found');
    log.info('Translation files cannot be validated');
    hasWarnings = true;
  }

  // 7. Check i18n setup in frontend
  log.section('7. i18n Configuration (Frontend)');
  const i18nConfig = path.join(webClientPath, 'src/i18n/index.ts');
  if (fs.existsSync(i18nConfig)) {
    log.success('i18n configuration found');
  } else {
    log.warning('i18n configuration not found');
    log.info(`Expected at: ${i18nConfig}`);
    hasWarnings = true;
  }

  const languageSelector = path.join(
    webClientPath,
    'src/components/common/LanguageSelector.tsx'
  );
  if (fs.existsSync(languageSelector)) {
    log.success('LanguageSelector component found');
  } else {
    log.error('LanguageSelector component not found');
    log.info(`Expected at: ${languageSelector}`);
    hasErrors = true;
  }

  // 8. Check node_modules
  log.section('8. Dependencies');
  checkDirectory('node_modules', 'Node modules', true);
  checkDirectory('node_modules/cypress', 'Cypress', true);

  // Summary
  log.section('Validation Summary');
  if (hasErrors) {
    console.log(`${colors.red}${colors.bold}✗ Validation failed with errors${colors.reset}`);
    console.log(
      `\n${colors.yellow}Please fix the errors above before running tests.${colors.reset}\n`
    );
    process.exit(1);
  } else if (hasWarnings) {
    console.log(`${colors.yellow}${colors.bold}⚠ Validation passed with warnings${colors.reset}`);
    console.log(
      `\n${colors.yellow}Tests can run, but some features may not work correctly.${colors.reset}\n`
    );
    process.exit(0);
  } else {
    console.log(`${colors.green}${colors.bold}✓ All checks passed!${colors.reset}`);
    console.log(
      `\n${colors.green}You're ready to run i18n tests:${colors.reset}`
    );
    console.log(
      `  ${colors.blue}npm run cypress:run -- --spec "tests/e2e/web-client/language-switching.cy.js"${colors.reset}\n`
    );
    process.exit(0);
  }
}

// Run validation
validate().catch((err) => {
  console.error(`${colors.red}Validation error: ${err.message}${colors.reset}`);
  process.exit(1);
});
