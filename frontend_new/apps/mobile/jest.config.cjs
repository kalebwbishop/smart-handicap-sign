module.exports = {
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
  moduleNameMapper: {
    '^expo/virtual/env$': '<rootDir>/test/mocks/expoVirtualEnv.js',
  },
};
