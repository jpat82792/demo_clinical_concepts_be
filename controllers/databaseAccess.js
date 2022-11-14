const pgp = require('pg-promise')();

const databaseConfig = {
  user:'postgres',
  host:'localhost',
  database:'test_clinical_concepts',
  password:'test',
  port:5432,
  max:5
};

const db = pgp(databaseConfig);


exports.db = db;
exports.pgp = pgp;