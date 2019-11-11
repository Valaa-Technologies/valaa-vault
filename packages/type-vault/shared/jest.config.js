module.exports = {
  collectCoverage: false,
  coveragePathIgnorePatterns: [
    ".*/node_modules",
    ".*/dist",
    ".*/valma",
    ".*/valma.bin",
    ".*/test",
  ],
  verbose: true,
  testRegex: "packages.*\\.test\\.js$",
  testPathIgnorePatterns: [
    "/node_modules/",
    "<rootDir>/dist/",
  ],
  modulePathIgnorePatterns: [
    "<rootDir>/dist/",
  ],
  moduleNameMapper: {
    "\\.(css|less)$": "<rootDir>/node_modules/@valos/type-vault/jest/styleMock.js",
  },
  setupFiles: [
    "<rootDir>/node_modules/@valos/type-vault/jest/init.js",
  ],
  transform: {
    ".*": "<rootDir>/node_modules/babel-jest",
  }
};
