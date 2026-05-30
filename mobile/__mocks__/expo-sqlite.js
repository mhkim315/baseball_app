module.exports = {
  openDatabaseAsync: async () => ({}),
  openDatabaseSync: () => ({}),
  SQLiteProvider: ({ children }) => children,
  useSQLiteContext: () => ({}),
};
