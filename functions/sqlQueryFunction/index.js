// index.js
'use strict';
const conectarBD = require('./conectarbd');

/** Convierte cantidades a piezas según UMEDIDA */
function convertirUnidad(cantidad, unidad) {
  if (!cantidad && cantidad !== 0) return 0;
  if (!unidad || unidad === 1) return cantidad;
  const entero = Math.trunc(cantidad);
  const decimal = cantidad - entero;
  return (entero * unidad) + Math.round(decimal * unidad);
}

/** ---------- CACHÉ EN MEMORIA ---------- */
const CACHE_TTL_MS = parseInt(process.env.CACHE_TTL_MS || '60000', 10); // 60s
const _cache = new Map(); // key -> { ts, data }

function _makeBaseKey({ group, groups, dateStart, dateEnd }) {
  return JSON.stringify({ group, groups, dateStart, dateEnd });
}
function _getFromCache(key) {
  const e = _cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL_MS) {
    _cache.delete(key);
    return null;
  }
  return e.data;
}
function _setCache(key, data) {
  _cache.set(key, { ts: Date.now(), data });
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Ruta no encontrada' }));
  }

  console.time('[API] total');
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // Filtros base (coinciden con tu frontend)
    const group     = (url.searchParams.get('group')     || '').trim();
    const groups    = (url.searchParams.get('groups')    || '').trim();
    const search    = (url.searchParams.get('search')    || '').trim();
    const dateStart = (url.searchParams.get('dateStart') || '').trim();
    const dateEnd   = (url.searchParams.get('dateEnd')   || '').trim();

    // Subcategoría SOLO para calzado masculino (prefijos BRUNO/ENZO)
    const subcat = (url.searchParams.get('subcat') || '').trim().toUpperCase(); // 'BRUNO' | 'ENZO' | ''

    console.log('--- SQL QUERY FUNCTION REQUEST ---');
    console.log('group:', group, '| groups:', groups);
    console.log('search:', search, '| subcat:', subcat);
    console.log('dateStart:', dateStart, '| dateEnd:', dateEnd);

    // 1) Intento resolver vía caché (base key no incluye search/subcat)
    const baseKey = _makeBaseKey({ group, groups, dateStart, dateEnd });
    const cachedBase = _getFromCache(baseKey);
    if (cachedBase) {
      console.log('[CACHE] HIT baseKey:', baseKey, 'TTL(ms):', CACHE_TTL_MS);
      console.time('[API] filtros-memoria');

      let finalData = cachedBase;

      // Subcategorías Calzado Masculino (prefijo en CodigoBase)
      if (subcat === 'BRUNO' || subcat === 'ENZO') {
        const isCalzadoHombre =
          group.toUpperCase() === 'CALZADOS MASCULINOS' ||
          groups.toUpperCase().includes('CALZADOS MASCULINOS');
        if (isCalzadoHombre) {
          finalData = finalData.filter(r =>
            (r.CodigoBase || '').toString().toUpperCase().trim().startsWith(subcat)
          );
        }
      }

      // Búsqueda en memoria
      if (search) {
        const s = search.toUpperCase();
        finalData = finalData.filter(r => {
          const cod = (r.CodigoBase || '').toString().toUpperCase();
          const nom = (r.NombreProducto || '').toString().toUpperCase();
          const col = (r.ColorDescripcion || '').toString().toUpperCase();
          return cod.includes(s) || nom.includes(s) || col.includes(s);
        });
      }

      console.timeEnd('[API] filtros-memoria');
      console.log('[CACHE] Respuesta con caché. total:', finalData.length);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      console.timeEnd('[API] total');
      return res.end(JSON.stringify({
        data: finalData,
        total: finalData.length,
        cache: 'HIT',
        baseKey
      }));
    }
    console.log('[CACHE] MISS baseKey:', baseKey);

    // 2) WHERE base (sin search; eso va en memoria)
    let where = '1=1';
    if (groups) {
      const groupList = groups.split(',').map(g => g.trim()).filter(Boolean);
      if (groupList.length > 0) {
        const groupConditions = groupList.map((_, idx) => `G.NOMBREGRUPO = @group${idx}`);
        where += ` AND (${groupConditions.join(' OR ')})`;
      }
    } else if (group) {
      where += ` AND G.NOMBREGRUPO = @group`;
    }
    if (dateStart && dateEnd) where += ` AND P.FECHA_CREACION BETWEEN @dateStart AND @dateEnd`;

    console.log('SQL WHERE (base):', where);

    // 3) Query DB una sola vez por combinación base
    console.time('[DB] connect+query');
    const pool = await conectarBD();
    const dataRequest = pool.request();

    if (groups) {
      groups.split(',').map(g => g.trim()).filter(Boolean)
        .forEach((g, idx) => dataRequest.input(`group${idx}`, g));
    } else {
      dataRequest.input('group', group);
    }
    dataRequest.input('dateStart', dateStart);
    dataRequest.input('dateEnd', dateEnd);

    const sqlQuery = `
      SELECT 
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
        (ISNULL(P.CANTIDADMT,0) + ISNULL(P.CANTIDADFS,0) + ISNULL(P.CANT_PEDIDA,0) + ISNULL(P.RESERFUTURO,0)) AS Futuro,
        P.COMPOSICION1 AS COMPOSICION1
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
    `;

    console.log('[DB] Ejecutando query...');
    const result = await dataRequest.query(sqlQuery);
    console.timeEnd('[DB] connect+query');
    console.log('[DB] Filas obtenidas:', result.recordset.length);

    // 4) Normalización + cache
    console.time('[API] normalizacion');
    const data = result.recordset.map(row => {
      const unidad = Number(row.UMEDIDA) || 1;
      return {
        ...row,
        CodigoBase: typeof row.CodigoBase === 'string' ? row.CodigoBase.trim() : row.CodigoBase,
        NombreProducto: typeof row.NombreProducto === 'string' ? row.NombreProducto.trim() : row.NombreProducto,
        ColorDescripcion: typeof row.ColorDescripcion === 'string' ? row.ColorDescripcion.trim() : row.ColorDescripcion,
        CODIGOGRUPO: typeof row.CODIGOGRUPO === 'string' ? row.CODIGOGRUPO.trim() : row.CODIGOGRUPO,
        NOMBREGRUPO: typeof row.NOMBREGRURO === 'string' ? row.NOMBREGRURO.trim() : row.NOMBREGRUPO, // tolera typo si existe
        Existencia: convertirUnidad(Number(row.Existencia), unidad),
        Reservado:  convertirUnidad(Number(row.Reservado),  unidad),
        Disponible: convertirUnidad(Number(row.Disponible), unidad),
        Futuro:     convertirUnidad(Number(row.Futuro),     unidad),
        COMPOSICION1: typeof row.COMPOSICION1 === 'string' ? row.COMPOSICION1.trim() : row.COMPOSICION1
      };
    });
    console.timeEnd('[API] normalizacion');

    _setCache(baseKey, data);
    console.log('[CACHE] MISS → almacenado baseKey:', baseKey, 'items:', data.length, 'TTL(ms):', CACHE_TTL_MS);

    // 5) Subcats + búsqueda en memoria
    console.time('[API] filtros-memoria');
    let finalData = data;

    if (subcat === 'BRUNO' || subcat === 'ENZO') {
      const isCalzadoHombre =
        group.toUpperCase() === 'CALZADOS MASCULINOS' ||
        groups.toUpperCase().includes('CALZADOS MASCULINOS');
      if (isCalzadoHombre) {
        finalData = finalData.filter(r =>
          (r.CodigoBase || '').toString().toUpperCase().trim().startsWith(subcat)
        );
      }
    }

    if (search) {
      const s = search.toUpperCase();
      finalData = finalData.filter(r => {
        const cod = (r.CodigoBase || '').toString().toUpperCase();
        const nom = (r.NombreProducto || '').toString().toUpperCase();
        const col = (r.ColorDescripcion || '').toString().toUpperCase();
        return cod.includes(s) || nom.includes(s) || col.includes(s);
      });
    }
    console.timeEnd('[API] filtros-memoria');

    res.writeHead(200, { 'Content-Type': 'application/json' });
    console.log('[API] Respuesta enviada. total:', finalData.length, '| cache: MISS');
    console.timeEnd('[API] total');
    return res.end(JSON.stringify({
      data: finalData,
      total: finalData.length,
      cache: 'MISS',
      baseKey
    }));
  } catch (err) {
    console.error('[API] Error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    console.timeEnd('[API] total');
    return res.end(JSON.stringify({
      error: err.message || 'Error interno',
      stack: process.env.NODE_ENV === 'production' ? undefined : (err.stack || '')
    }));
  }
};
