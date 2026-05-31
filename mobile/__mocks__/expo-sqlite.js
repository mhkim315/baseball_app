// In-memory SQLite mock for testing
const tables = {};

function getTable(name) {
  if (!tables[name]) {
    tables[name] = { rows: [], autoInc: 1 };
  }
  return tables[name];
}

const mockDb = {
  execAsync: async (sql) => {
    // CREATE TABLE — just register it
    const createMatch = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
    if (createMatch) {
      getTable(createMatch[1]);
      return;
    }
    // DELETE FROM
    const deleteMatch = sql.match(/DELETE FROM (\w+)/);
    if (deleteMatch) {
      getTable(deleteMatch[1]).rows = [];
      return;
    }
  },
  runAsync: async (sql, ...params) => {
    const insertMatch = sql.match(/INSERT OR REPLACE INTO (\w+).*\((\w+), (\w+)\).*VALUES.*\?.*\?/);
    if (insertMatch) {
      const table = getTable(insertMatch[1]);
      const key = params[0];
      const value = params[1];
      const existing = table.rows.findIndex(r => r.key === key);
      if (existing >= 0) {
        table.rows[existing].value = value;
      } else {
        table.rows.push({ key, value });
      }
      return;
    }
    // Generic INSERT OR REPLACE
    const genericInsert = sql.match(/INSERT OR REPLACE INTO (\w+)/);
    if (genericInsert) {
      const table = getTable(genericInsert[1]);
      if (params.length >= 2) {
        const key = params[0];
        const value = params[1];
        const existing = table.rows.findIndex(r => r.key === key);
        if (existing >= 0) {
          table.rows[existing].value = value;
        } else {
          table.rows.push({ key, value });
        }
      }
      return;
    }
    // DELETE
    const deleteMatch = sql.match(/DELETE FROM (\w+)/);
    if (deleteMatch) {
      getTable(deleteMatch[1]).rows = [];
      return;
    }
  },
  getFirstAsync: async (sql, ...params) => {
    // SELECT value FROM user_settings WHERE key = ?
    const selectMatch = sql.match(/SELECT (.+) FROM (\w+) WHERE (\w+) = \?/);
    if (selectMatch) {
      const tableName = selectMatch[2];
      const keyCol = selectMatch[3];
      const keyVal = params[0];
      const table = tables[tableName];
      if (!table) return null;
      const row = table.rows.find(r => r[keyCol] === keyVal);
      if (!row) return null;
      // Return only the selected columns
      const cols = selectMatch[1].split(",").map(c => c.trim());
      const result = {};
      for (const col of cols) {
        result[col] = row[col];
      }
      return result;
    }
    // PRAGMA table_info
    const pragmaMatch = sql.match(/PRAGMA table_info\((\w+)\)/);
    if (pragmaMatch) {
      return []; // No columns to migrate
    }
    return null;
  },
  getAllAsync: async (sql, ...params) => {
    const pragmaMatch = sql.match(/PRAGMA table_info\((\w+)\)/);
    if (pragmaMatch) {
      return [];
    }
    const selectMatch = sql.match(/SELECT (.+) FROM (\w+)/);
    if (selectMatch) {
      const tableName = selectMatch[2];
      const table = tables[tableName];
      if (!table) return [];
      return table.rows;
    }
    return [];
  },
};

module.exports = {
  openDatabaseAsync: async () => mockDb,
  openDatabaseSync: () => mockDb,
  SQLiteProvider: ({ children }) => children,
  useSQLiteContext: () => mockDb,
};
