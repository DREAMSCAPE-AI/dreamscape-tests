# i18n E2E Tests - Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Ensure Web Client is Running
```bash
cd C:\Users\kevco\Documents\EPITECH\DREAMSCAPE GITHUB MICROSERVICE\dreamscape-frontend\web-client
npm run dev
# Wait for: "Local: http://localhost:5173"
```

### Step 2: Run the Tests
```bash
cd C:\Users\kevco\Documents\EPITECH\DREAMSCAPE GITHUB MICROSERVICE\dreamscape-tests

# Option A: Headless (fast)
npm run cypress:run -- --spec "tests/e2e/web-client/language-switching.cy.js"

# Option B: Interactive (visual debugging)
npm run cypress:open
# Then click: tests/e2e/web-client/language-switching.cy.js
```

### Step 3: View Results
**Headless mode**: Results in terminal
**Interactive mode**: Live browser with test runner

---

## 📂 Files Created

All files are in: `C:\Users\kevco\Documents\EPITECH\DREAMSCAPE GITHUB MICROSERVICE\dreamscape-tests\`

1. **tests/e2e/web-client/language-switching.cy.js** (456 lines)
   - Main test suite with 32 tests

2. **cypress/support/language-helpers.js** (275 lines)
   - 21 helper functions for language testing

3. **tests/e2e/web-client/language-switching-example.cy.js** (197 lines)
   - Example tests showing helper usage

4. **I18N_TESTS_README.md**
   - Complete documentation

5. **I18N_TESTS_SUMMARY.md**
   - Implementation summary

6. **I18N_TESTS_QUICKSTART.md** (this file)
   - Quick start guide

---

## ✅ Test Coverage

**32 Tests Total** (30 active, 2 skipped):
- ✅ Language selector visibility (4 tests)
- ✅ Header language switching (8 tests)
- ✅ localStorage persistence (4 tests)
- ✅ Multi-page consistency (4 tests)
- ✅ Footer language selector (3 tests)
- ⏭️ Settings integration (2 tests - requires auth)
- ✅ Edge cases (4 tests)
- ✅ Accessibility (2 tests)
- ✅ Flag display (1 test)

---

## 🎯 What's Being Tested

### 1. **Language Selector**
- Visible in header (globe icon + EN/FR code)
- Clickable dropdown with English/Français options
- Shows checkmark on selected language

### 2. **Language Switching**
- EN → FR: "Flights" becomes "Vols"
- FR → EN: "Vols" becomes "Flights"
- Dropdown closes after selection

### 3. **Persistence**
- Language saved to localStorage (`dreamscape-language`)
- Persists across page reloads
- Persists across page navigation

### 4. **Multi-Page**
- Language maintained when clicking nav links
- Footer and header stay in sync

### 5. **Edge Cases**
- Rapid switching
- Slow network (2s delay)
- Browser back button
- Clicking outside dropdown

---

## 🔧 Common Commands

### Run Specific Test Groups
```bash
# Just visibility tests
npx cypress run --spec "tests/e2e/web-client/language-switching.cy.js" --grep "Visibility"

# Just persistence tests
npx cypress run --spec "tests/e2e/web-client/language-switching.cy.js" --grep "Persistence"

# Just edge cases
npx cypress run --spec "tests/e2e/web-client/language-switching.cy.js" --grep "Edge Cases"
```

### Run Example Tests
```bash
npx cypress run --spec "tests/e2e/web-client/language-switching-example.cy.js"
```

### Debug a Single Test
```bash
npm run cypress:open
# Click: language-switching.cy.js
# Click specific test from list
# Use time-travel debugger
```

---

## 🛠️ Using Helper Functions

### In Your Own Tests
```javascript
import {
  switchToFrench,
  switchToEnglish,
  verifyCurrentLanguage,
  verifyFrenchContent,
  clearLanguagePreference
} from '../../cypress/support/language-helpers';

describe('My Test', () => {
  beforeEach(() => {
    clearLanguagePreference();
    cy.visit('http://localhost:5173');
  });

  it('should work in French', () => {
    switchToFrench();
    verifyFrenchContent();
    verifyCurrentLanguage('fr');
  });
});
```

### Most Useful Helpers
| Function | What It Does |
|----------|--------------|
| `switchToFrench()` | Click selector, choose French |
| `switchToEnglish()` | Click selector, choose English |
| `verifyCurrentLanguage('fr')` | Check FR button visible |
| `verifyFrenchContent()` | Check Vols, Hôtels, etc. |
| `verifyEnglishContent()` | Check Flights, Hotels, etc. |
| `clearLanguagePreference()` | Remove from localStorage |
| `visitWithLanguage(url, 'fr')` | Visit with French pre-set |

See `language-helpers.js` for all 21 functions.

---

## 🐛 Troubleshooting

### "Language selector not found"
**Problem**: Button with EN/FR not appearing
**Solution**:
```javascript
// Add longer wait after visit
cy.visit('http://localhost:5173');
cy.wait(1000); // Increase to 2000
```

### "Translations not loading"
**Problem**: Still showing English after switching to French
**Solution**:
1. Check translation files exist:
```bash
ls C:\Users\kevco\Documents\EPITECH\DREAMSCAPE GITHUB MICROSERVICE\dreamscape-frontend\web-client\public\locales\fr\common.json
```
2. Check browser network tab for 404s
3. Verify i18n initialized in `src/i18n/index.ts`

### "Tests are flaky"
**Problem**: Tests pass sometimes, fail other times
**Solution**:
- Increase waits after language switches
- Check for console errors in test output
- Run with `--headed` to see what's happening

### "localStorage not persisting"
**Problem**: Language resets after reload
**Solution**:
- Check localStorage not being cleared elsewhere
- Verify i18n detection config in `src/i18n/index.ts`
- Use browser DevTools → Application → Local Storage

---

## 📊 Expected Output

### Successful Run
```bash
$ npm run cypress:run -- --spec "tests/e2e/web-client/language-switching.cy.js"

  i18n - Language Switching
    Language Selector Visibility
      ✓ should display language selector in header (523ms)
      ✓ should show current language code (EN by default) (301ms)
      ✓ should display globe icon (278ms)

    Language Switching - Header
      ✓ should open language dropdown when clicking selector (412ms)
      ✓ should switch from English to French (1523ms)
      ✓ should switch from French back to English (2034ms)
      ...

    Language Persistence
      ✓ should persist language selection in localStorage (1312ms)
      ✓ should load page in French after reload (2145ms)
      ...

  30 passing (24s)
  2 pending
```

### Failed Test Example
```bash
  1) should switch from English to French
     AssertionError: Timed out retrying after 4000ms: Expected to find content: 'Vols' but never did.

     at Context.eval (language-switching.cy.js:67:8)
```
**What to do**: Check translation files exist, web client is running, i18n initialized.

---

## 📝 What Happens in a Test

### Example Test Walkthrough
```javascript
it('should switch from English to French', () => {
  // 1. Verify starting in English
  cy.contains('Flights').should('be.visible');  // ✓ English nav
  cy.contains('Hotels').should('be.visible');

  // 2. Click language selector
  cy.get('button').contains('EN', { matchCase: false }).click();
  // → Dropdown opens with English ✓ and Français

  // 3. Click French
  cy.contains('Français').click();
  // → Language changes, dropdown closes

  // 4. Wait for translations to load
  cy.wait(1000);

  // 5. Verify French translations
  cy.contains('Vols').should('be.visible');     // ✓ Was "Flights"
  cy.contains('Hôtels').should('be.visible');   // ✓ Was "Hotels"

  // 6. Verify selector shows FR
  cy.get('button').contains('FR', { matchCase: false }).should('be.visible');
  // ✓ Test passes
});
```

---

## 🎓 Next Steps

### 1. Run All Tests
```bash
npm run cypress:run -- --spec "tests/e2e/web-client/language-switching.cy.js"
```

### 2. Run Example Tests
```bash
npx cypress run --spec "tests/e2e/web-client/language-switching-example.cy.js"
```

### 3. Read Documentation
- **README**: Detailed docs in `I18N_TESTS_README.md`
- **Summary**: Overview in `I18N_TESTS_SUMMARY.md`
- **Helpers**: Check `cypress/support/language-helpers.js` for all functions

### 4. Use Helpers in Your Tests
See `language-switching-example.cy.js` for patterns

### 5. Uncomment Auth Tests
When authentication is ready:
```javascript
// In language-switching.cy.js, line ~185
it.skip('should display language setting in user settings', () => {
// Change to:
it('should display language setting in user settings', () => {
```

---

## 🚨 Prerequisites Checklist

Before running tests, verify:
- [ ] Web client running on http://localhost:5173
- [ ] Translation files exist in `public/locales/en/` and `public/locales/fr/`
- [ ] i18n configured in `src/i18n/index.ts`
- [ ] LanguageSelector component exists
- [ ] Node modules installed (`npm install`)
- [ ] Cypress installed

---

## 💡 Pro Tips

1. **Use Interactive Mode for Debugging**
   ```bash
   npm run cypress:open
   ```
   - See tests run in real browser
   - Use time-travel to debug failures
   - Inspect DOM at each step

2. **Run Specific Test**
   - In interactive mode, click just that test
   - Or use `it.only()` in code temporarily

3. **Check localStorage in Browser**
   - F12 → Application tab → Local Storage
   - Look for `dreamscape-language` key

4. **Slow Down Tests to Watch**
   ```javascript
   cy.wait(2000); // Add temporary waits to see what's happening
   ```

5. **Check Network Requests**
   - Tests intercept `/locales/fr/*.json`
   - Check these load successfully
   - Look for 404 errors

---

## 📞 Support

**Issues?**
- Check `I18N_TESTS_README.md` → Troubleshooting section
- Review `language-switching-example.cy.js` for correct patterns
- Check existing GDPR tests for similar patterns
- Verify web client console for JavaScript errors

**Want to Extend?**
- Add new helper functions to `language-helpers.js`
- Follow existing test patterns
- Update documentation when adding tests

---

**Test Suite**: i18n E2E Tests
**Created**: 2026-02-06
**Total Tests**: 32 (30 active)
**Helper Functions**: 21
**Status**: ✅ Ready to Run

🎉 **You're ready to test i18n!**
