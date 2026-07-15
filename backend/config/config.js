const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'conduit-development', 
  process.env.DB_USER || 'postgres', 
  process.env.DB_PASSWORD || 'mihir',
  {
    host: process.env.DB_HOST || 'postgres_db', // Crucial: resolves to the docker container name
    dialect: 'postgres',
    logging: false
  }
);

module.exports = sequelize;
