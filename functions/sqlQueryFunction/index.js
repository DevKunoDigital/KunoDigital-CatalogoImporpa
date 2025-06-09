'use strict';
const conectarBD = require('./conectarbd');

function convertirUnidad(cantidad, unidad) {
  if (!cantidad) return 0;
  if (!unidad || unidad === 1) return cantidad;
  const entero = Math.trunc(cantidad);
  const decimal = cantidad - entero;
  return (entero * unidad) + Math.round(decimal * unidad);
}

module.exports = async (req, res) => {
  const path = req.url.replace(/\/$/, '');
  if (req.method === 'GET' && (path === '' || path === '/sqlqueryfunction')) {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const pageSize = parseInt(url.searchParams.get('pageSize') || '100', 10);
      const offset = (page - 1) * pageSize;

      // Filtros opcionales
      const group = url.searchParams.get('group') || '';
      const search = url.searchParams.get('search') || '';
      const dateStart = url.searchParams.get('dateStart') || '';
      const dateEnd = url.searchParams.get('dateEnd') || '';

      let where = '1=1';
      if (group) where += ` AND G.NOMBREGRUPO = @group`;
      if (search) where += ` AND (P.PRODNUMERO LIKE @search OR P.PRODNOMBRE LIKE @search OR ISNULL(C1.DESCRIPCION,'') LIKE @search OR ISNULL(C2.DESCRIPCION,'') LIKE @search)`;
      if (dateStart && dateEnd) where += ` AND P.FECHA_CREACION BETWEEN @dateStart AND @dateEnd`;

      const pool = await conectarBD();

      // Total filtrado
      const totalResult = await pool.request()
        .input('group', group)
        .input('search', `%${search}%`)
        .input('dateStart', dateStart)
        .input('dateEnd', dateEnd)
        .query(`
          SELECT COUNT(*) AS total
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
          WHERE ${where}
        `);
      const total = totalResult.recordset[0].total;

      // Consulta paginada y filtrada
      const result = await pool.request()
        .input('group', group)
        .input('search', `%${search}%`)
        .input('dateStart', dateStart)
        .input('dateEnd', dateEnd)
        .query(`
        SELECT *
        FROM (
          SELECT 
            ROW_NUMBER() OVER (ORDER BY P.PRODNUMERO) AS RowNum,
            P.PRODNUMERO AS CodigoBase,
            P.PRODNOMBRE AS NombreProducto,
            P.FECHA_CREACION AS FechaCreacion,
            LTRIM(RTRIM(
              ISNULL(C1.DESCRIPCION, '') + 
              CASE 
                WHEN C1.DESCRIPCION IS NOT NULL AND C2.DESCRIPCION IS NOT NULL THEN ', ' 
                ELSE '' 
              END + 
              ISNULL(C2.DESCRIPCION, '')
            )) AS ColorDescripcion,
            P.CODIGOGRUPO,
            G.NOMBREGRUPO,
            P.UMEDIDA,
            (ISNULL(P.EXISTENCIA1,0) + ISNULL(P.EXISTENCIA2,0) + ISNULL(P.EXISTENCIA3,0) + ISNULL(P.EXISTENCIA4,0) + ISNULL(P.EXISTENCIA5,0)) AS Existencia,
            (ISNULL(P.RESERVADO1,0) + ISNULL(P.RESERVADO2,0) + ISNULL(P.RESERVADO3,0) + ISNULL(P.RESERVADO4,0) + ISNULL(P.RESERVADO5,0)
              + ISNULL(P.PENDIENTE01,0) + ISNULL(P.PENDIENTE02,0) + ISNULL(P.PENDIENTE03,0) + ISNULL(P.PENDIENTE04,0) + ISNULL(P.PENDIENTE05,0)
            ) AS Reservado,
            ((ISNULL(P.EXISTENCIA1,0) + ISNULL(P.EXISTENCIA2,0) + ISNULL(P.EXISTENCIA3,0) + ISNULL(P.EXISTENCIA4,0) + ISNULL(P.EXISTENCIA5,0))
              - 
             (ISNULL(P.RESERVADO1,0) + ISNULL(P.RESERVADO2,0) + ISNULL(P.RESERVADO3,0) + ISNULL(P.RESERVADO4,0) + ISNULL(P.RESERVADO5,0)
              + ISNULL(P.PENDIENTE01,0) + ISNULL(P.PENDIENTE02,0) + ISNULL(P.PENDIENTE03,0) + ISNULL(P.PENDIENTE04,0) + ISNULL(P.PENDIENTE05,0))
            ) AS Disponible,
            (ISNULL(P.CANTIDADMT,0) + ISNULL(P.CANTIDADFS,0) + ISNULL(P.CANT_PEDIDA,0) + ISNULL(P.RESERFUTURO,0)) AS Futuro
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
          WHERE ${where}
        ) AS T
        WHERE T.RowNum > ${offset} AND T.RowNum <= ${offset + pageSize}
        ORDER BY T.RowNum
      `);

      // Conversión de cantidades a piezas según UMEDIDA y limpieza de strings
      const data = result.recordset.map(row => {
        const unidad = Number(row.UMEDIDA) || 1;
        return {
          ...row,
          CodigoBase: typeof row.CodigoBase === 'string' ? row.CodigoBase.trim() : row.CodigoBase,
          NombreProducto: typeof row.NombreProducto === 'string' ? row.NombreProducto.trim() : row.NombreProducto,
          ColorDescripcion: typeof row.ColorDescripcion === 'string' ? row.ColorDescripcion.trim() : row.ColorDescripcion,
          CODIGOGRUPO: typeof row.CODIGOGRUPO === 'string' ? row.CODIGOGRUPO.trim() : row.CODIGOGRUPO,
          NOMBREGRUPO: typeof row.NOMBREGRUPO === 'string' ? row.NOMBREGRUPO.trim() : row.NOMBREGRUPO,
          Existencia: convertirUnidad(Number(row.Existencia), unidad),
          Reservado: convertirUnidad(Number(row.Reservado), unidad),
          Disponible: convertirUnidad(Number(row.Disponible), unidad),
          Futuro: convertirUnidad(Number(row.Futuro), unidad),
        };
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        data,
        total,
        page,
        pageSize
      }));
    } catch (err) {
      console.error('Error BD:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Ruta no encontrada' }));
};
