'use strict';
const conectarBD = require('./conectarbd');

module.exports = async (req, res) => {
  const path = req.url.replace(/\/$/, '');
  if (req.method === 'GET' && (path === '' || path === '/sqlqueryfunction')) {
    try {
      const pool = await conectarBD();
      const result = await pool.request().query(` 
        SELECT 
            P.PRODNUMERO AS CodigoBase,
            P.PRODNOMBRE AS NombreProducto,
            LTRIM(RTRIM(
                ISNULL(C1.DESCRIPCION, '') + 
                CASE 
                    WHEN C1.DESCRIPCION IS NOT NULL AND C2.DESCRIPCION IS NOT NULL THEN ', ' 
                    ELSE '' 
                END + 
                ISNULL(C2.DESCRIPCION, '')
            )) AS ColorDescripcion,
            EXISTENCIA1 AS LA,
            RESERVADO1 AS LB,
            P.CODIGOGRUPO,
            G.NOMBREGRUPO,
            P.FECHA_CREACION -- Agregar la columna de fecha de creación
        FROM dbo.ICPROD P
        LEFT JOIN dbo.ICGRUPO G ON G.CODIGOGRUPO = P.CODIGOGRUPO
        LEFT JOIN dbo.ICCOLOR C1 ON C1.CODIGO = 
            CASE 
                WHEN CHARINDEX('-', P.PRODNUMERO) > 0 
                THEN SUBSTRING(
                    P.PRODNUMERO,
                    CHARINDEX('-', P.PRODNUMERO) + 1,
                    CHARINDEX('-', P.PRODNUMERO + '-', CHARINDEX('-', P.PRODNUMERO) + 1) - CHARINDEX('-', P.PRODNUMERO) - 1
                )
                ELSE NULL 
            END
        LEFT JOIN dbo.ICCOLOR C2 ON C2.CODIGO = 
            CASE 
                WHEN CHARINDEX('-', P.PRODNUMERO + '-', CHARINDEX('-', P.PRODNUMERO) + 1) > 0 
                THEN SUBSTRING(
                    P.PRODNUMERO,
                    CHARINDEX('-', P.PRODNUMERO + '-', CHARINDEX('-', P.PRODNUMERO) + 1) + 1,
                    LEN(P.PRODNUMERO)
                )
                ELSE NULL 
            END
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
