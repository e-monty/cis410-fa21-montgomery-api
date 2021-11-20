const sql = require("mssql");

const montgomeryConfig = require("./config.js");

const config = {
  user: montgomeryConfig.DB.user,
  password: montgomeryConfig.DB.password,
  server: montgomeryConfig.DB.server,
  database: montgomeryConfig.DB.database,
};

async function executeQuery(aQuery) {
  let connection = await sql.connect(config);
  let result = await connection.query(aQuery);

  return result.recordset;
}

module.exports = { executeQuery: executeQuery };
