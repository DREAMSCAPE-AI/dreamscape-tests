/**
 * Custom Jest transformer that replaces `import.meta.env` with `process.env`
 * before passing the code to ts-jest. This allows Jest to process Vite source files.
 */
const { TsJestTransformer } = require('ts-jest');

class ViteMetaTransformer extends TsJestTransformer {
  process(sourceText, sourcePath, transformOptions) {
    let code = sourceText;
    // Replace import.meta.env with process.env in source files only (not test files)
    if (!sourcePath.includes('.test.') && !sourcePath.includes('__tests__')) {
      code = code.replace(/import\.meta\.env/g, 'process.env');
    }
    return super.process(code, sourcePath, transformOptions);
  }
}

module.exports = {
  createTransformer() {
    return new ViteMetaTransformer({
      diagnostics: false,
      tsconfig: {
        jsx: 'react-jsx',
        module: 'commonjs',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: false,
        skipLibCheck: true,
        paths: {
          '@/*': ['dreamscape-frontend/web-client/src/*'],
        },
      },
    });
  },
};
