// conectarbd.js
const sql = require('mssql');

// ⚠️ Tal cual me pediste (kunoadmin/kunoadmin + TLS off)
const config = {
  user: 'kunoadmin',
  password: 'kunoadmin',
  server: '40.75.105.29',
  database: 'SAGE',
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  connectionTimeout: 15000,
  requestTimeout: 30000
};

// Pool singleton (evita reconectar por request)
let poolPromise = null;

module.exports = async () => {
  try {
    if (!poolPromise) {
      console.log('[DB] Creando nueva conexión/pool a SQL...');
      poolPromise = sql.connect(config);
      poolPromise
        .then(pool => {
          console.log('[DB] Pool conectado. Versión driver:', sql.TYPES ? 'ok' : 'n/a');
          pool.on('error', (err) => {
            console.error('[DB] Error en el pool:', err);
            poolPromise = null; // fuerza recreo en próximo request
          });
        })
        .catch(err => {
          console.error('[DB] Error inicial conectando pool:', err);
          poolPromise = null;
        });
    }
    return await poolPromise;
  } catch (err) {
    console.error('[DB] Error al conectar con la base de datos:', err);
    poolPromise = null;
    throw err;
  }
};
