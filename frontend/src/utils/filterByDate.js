/**
 * Filtra los productos según la fecha de creación.
 * @param {Array} products - Lista de productos.
 * @param {Date} startDate - Fecha de inicio.
 * @param {Date} endDate - Fecha de fin.
 * @returns {Array} - Productos filtrados.
 */
export const filterByDate = (products, startDate, endDate) => {
    return products.filter((product) => {
        const creationDate = new Date(product.FECHA_CREACION);
        return creationDate >= startDate && creationDate <= endDate;
    });
};