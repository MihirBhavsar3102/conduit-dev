require("dotenv").config();

const base = {
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "mihir",
  database: process.env.DB_NAME || "conduit-development",
  host: process.env.DB_HOST || "postgres_db", // resolves to the docker-compose service name
  dialect: process.env.DB_DIALECT || "postgres",
  logging: false,
};

module.exports = {
  development: base,
  test: { ...base, database: process.env.DB_NAME_TEST || "conduit-test" },
  production: base,
};
