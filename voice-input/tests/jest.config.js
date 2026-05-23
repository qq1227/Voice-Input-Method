const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/** @type {import('jest').Config} */
const config = {
  rootDir: ROOT,
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        target: 'ES2020',
        module: 'commonjs',
        moduleResolution: 'node',
        esModuleInterop: true,
        strict: true,
        skipLibCheck: true,
        resolveJsonModule: true,
        forceConsistentCasingInFileNames: true,
      },
    }],
  },
  moduleNameMapper: {
    '^uuid$': '<rootDir>/node_modules/uuid/dist/index.js',
  },
  clearMocks: true,
  resetMocks: false,
  restoreMocks: false,
  testTimeout: 10000,
  verbose: true,
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'tests/reports',
      outputName: 'junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
    }],
  ],
};

module.exports = config;
