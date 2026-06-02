module.exports = {
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
  moduleNameMapper: {
    '^expo/virtual/env$': '<rootDir>/test/mocks/expoVirtualEnv.js',
    '^.+\\.(wav|mp3|m4a|aac|caf)$': '<rootDir>/test/mocks/fileMock.js',
  },
};
