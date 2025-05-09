const sql = require('mssql');

const config = {
  user: 'dev_externo',
  password: 'dev123',
  server: '63.141.230.5',   // tu IP
  database: 'SAGE',          // apúntalo aquí
  port: 1433,                // 1433 por defecto, cámbialo
  options: {
    encrypt: false,              // ← desactiva cifrado TLS
    trustServerCertificate: true
  }
};

module.exports = async () => {
  try {
    return await sql.connect(config);
  } catch (err) {
    console.error('Error al conectar con la base de datos:', err);
    throw err;
  }
};