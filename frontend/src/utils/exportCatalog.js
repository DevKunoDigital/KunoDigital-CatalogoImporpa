import * as ExcelJS from 'exceljs';

/**
 * Exporta el catálogo a un archivo Excel.
 * @param {Array} data - Los datos filtrados a exportar.
 * @param {boolean} includeImages - Si se deben incluir imágenes en la exportación.
 * @param {string} [fileName='Catalogo.xlsx'] - El nombre del archivo Excel.
 * @param {function(number, string): void} onProgress - Callback para actualizar el progreso.
 * @param {Array<string>} tabs - Las pestañas para exportar (opcional).
 */
export const exportCatalog = async (
    data,
    includeImages,
    fileName = 'Catalogo.xlsx',
    onProgress,
    tabs = []
) => {
    if (!data || data.length === 0) {
        alert('No hay datos para exportar.');
        return;
    }

    try {
        if (onProgress) onProgress(0, 'Preparando datos para exportar...');

        const workbook = new ExcelJS.Workbook();

        const fetchImageAsBase64 = async (url) => {
            try {
                const response = await fetch(url);
                const blob = await response.blob();
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                });
            } catch (error) {
                console.error('Error al descargar la imagen:', error);
                return null;
            }
        };

        const createSheet = async (sheetData, sheetName) => {
            const sheet = workbook.addWorksheet(sheetName);

            const columns = [
                { header: 'Referencia', key: 'CodigoBase', width: 20 },
                { header: 'Nombre Producto', key: 'NombreProducto', width: 30 },
                { header: 'Color', key: 'ColorDescripcion', width: 20 },
                { header: 'Disponible', key: 'LA', width: 15 },
                { header: 'Solicitado', key: 'LB', width: 15 },
            ];

            if (includeImages) {
                columns.push({ header: 'Imagen', key: 'Imagen', width: 20 });
            }

            sheet.columns = columns;

            sheet.getRow(1).font = { bold: true, size: 14 };
            sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
            sheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'D9E1F2' },
            };

            for (let i = 0; i < sheetData.length; i++) {
                const item = sheetData[i];

                const imageUrl = includeImages
                    ? `https://sqlserver-proyect-883996440.development.catalystserverless.com/server/imgproxy/${item.CodigoBase.trim()}.jpg`
                    : null;

                const row = sheet.addRow({
                    CodigoBase: item.CodigoBase,
                    NombreProducto: item.NombreProducto,
                    ColorDescripcion: item.ColorDescripcion,
                    LA: item.LA ?? 0,
                    LB: item.LB ?? 0,
                    Imagen: includeImages ? '' : undefined,
                });

                row.height = includeImages ? 80 : 20;

                if (includeImages && imageUrl) {
                    const base64Image = await fetchImageAsBase64(imageUrl);
                    if (base64Image) {
                        const imageId = workbook.addImage({
                            base64: base64Image,
                            extension: 'jpeg',
                        });
                        sheet.addImage(imageId, {
                            tl: { col: 5, row: row.number }, // Coordenadas de la celda
                            ext: { width: 80, height: 80 }, // Tamaño de la imagen
                            editAs: 'oneCell', // Asegura que la imagen se ajuste a la celda
                        });
                    }
                }
                row.height = 80;

                row.eachCell((cell) => {
                    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' },
                    };
                    // Zebra striping
                    if (i % 2 === 0) {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'F2F2F2' },
                        };
                    }
                });

                if (onProgress) {
                    const progress = Math.round(((i + 1) / sheetData.length) * 100);
                    onProgress(progress, `Procesando fila ${i + 1} de ${sheetData.length}...`);
                }
            }

            const totalDisponible = sheetData.reduce((sum, item) => sum + (item.LA ?? 0), 0);
            const totalSolicitado = sheetData.reduce((sum, item) => sum + (item.LB ?? 0), 0);
            const totalRow = sheet.addRow({
                CodigoBase: 'TOTALES',
                LA: totalDisponible,
                LB: totalSolicitado,
            });

            totalRow.font = { bold: true };
            totalRow.eachCell((cell) => {
                cell.alignment = { horizontal: 'center' };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF2CC' },
                };
            });
        };

        if (tabs.length > 0) {
            for (const tab of tabs) {
                const tabData = data.filter((item) => item.CodigoBase.startsWith(tab));
                await createSheet(tabData, tab);
            }
        } else {
            await createSheet(data, 'Catálogo');
        }

        if (onProgress) onProgress(100, 'Generando archivo Excel...');

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();

        if (onProgress) onProgress(100, 'Exportación completada.');
    } catch (error) {
        console.error('Error al exportar:', error);
        if (onProgress) onProgress(0, 'Error al exportar.');
    }
};