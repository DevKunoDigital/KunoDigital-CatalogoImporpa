'use strict';
const conectarBD = require('./conectarbd');

module.exports = async (req, res) => {
  const path = req.url.replace(/\/$/, '');
  if (req.method === 'GET' && (path === '' || path === '/sqlqueryfunction')) {
    try {
      const pool = await conectarBD();
      const result = await pool.request().query(`
        SELECT 
          -- Extraer código base (antes del guión)
          LEFT(PRODNUMERO, CHARINDEX('-', PRODNUMERO + '-') - 1) AS CodigoBase,
          -- Color: buscamos la parte después del guión en ICCOLOR
          CO.DESCRIPCION AS ColorDescripcion,
          -- Existencia1 y Reservado1
          EXISTENCIA1 AS LA,
          RESERVADO1  AS LB,
          -- Grupo: código y nombre
          P.CODIGOGRUPO,
          G.NOMBREGRUPO
        FROM dbo.ICPROD P
        LEFT JOIN dbo.ICCOLOR CO
          ON CO.CODIGO = RIGHT(P.PRODNUMERO, LEN(P.PRODNUMERO) - CHARINDEX('-', P.PRODNUMERO))
        LEFT JOIN dbo.ICGRUPO G
          ON G.CODIGO_GRUPO = P.CODIGOGRUPO
      `);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(result.recordset));
    } catch (err) {
      console.error('Error BD:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Ruta no encontrada' }));
};
