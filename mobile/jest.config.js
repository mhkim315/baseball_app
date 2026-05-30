/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/lib/__tests__"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^@shared/(.*)$": "<rootDir>/../shared/$1",
    "^expo-sqlite$": "<rootDir>/__mocks__/expo-sqlite",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {
      tsconfig: "<rootDir>/tsconfig.json",
    }],
  },
};
