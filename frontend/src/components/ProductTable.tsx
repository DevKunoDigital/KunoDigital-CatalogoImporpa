import React, { useState, useEffect } from 'react';
import { exportCatalog } from '../utils/exportCatalog';


import {
    Box,
    Paper,
    Typography,
    CircularProgress,
    Alert,
    Tabs,
    Tab,
    IconButton,
    Tooltip,
    Avatar,
    Modal,
    Backdrop,
    Fade,
    FormControl,
    InputLabel,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,

    MenuItem,
    Select,
    SelectChangeEvent,
    Button,
    TextField,
    LinearProgress,
    Menu,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { InputAdornment } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker'; // Asegúrate de usar el nombre correcto
import { es } from 'date-fns/locale'; // Para soporte en español
import { Autocomplete } from '@mui/material'; // Importa Autocomplete
import { Download as DownloadIcon, FilterAlt as FilterIcon, Search as SearchIcon } from '@mui/icons-material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
interface Product {
    CodigoBase: string;
    NombreProducto: string;
    ColorDescripcion: string;
    CODIGOGRUPO: string;
    NOMBREGRUPO: string;
    FechaCreacion: string;
    Existencia: number;
    Reservado: number;
    Disponible: number;
    Futuro: number;
    UMEDIDA?: number;
    ImageUrl?: string;
}

// Mueve estas funciones utilitarias (isCalzadoGroup y excludeVLA) ARRIBA, antes de cualquier uso
const isCalzadoGroup = (group: string) =>
    group === 'CALZADOS FEMENINOS' || group === 'CALZADOS MASCULINOS';

const excludeVLA = (codigo: string) => {
    return /[A-Z]LA(\b|-)/i.test(codigo) || /[A-Z]LB(\b|-)/i.test(codigo);
};


export const ProductTable: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [mainCategory, setMainCategory] = useState<string>(''); // Nueva línea
    const [lineSearchTerm, setLineSearchTerm] = useState('');
    const [error] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<string>('');
    const [showOnlySolicited, setShowOnlySolicited] = useState(false);
    const [showOnlyDisponible, setShowOnlyDisponible] = useState(false);
    const [selectedTab, setSelectedTab] = useState<string>('');
    const [rangeStart, setRangeStart] = useState(''); // Valor "desde"
    const [rangeEnd, setRangeEnd] = useState(''); // Valor "hasta"s
    const [exporting, setExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const [exportStatusMessage, setExportStatusMessage] = useState('');
    const [dateRange, setDateRange] = useState<string>(''); // 30 días, 90 días, etc.
    const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
    const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(100);
    const [total, setTotal] = useState(0);
    const safeProducts: Product[] = Array.isArray(products) ? products : [];
    const safeFilteredProducts: Product[] = Array.isArray(filteredProducts) ? filteredProducts : [];



    // Cargar los datos desde el backend con filtros y paginación
    useEffect(() => {
        const loadProducts = async () => {
            setLoading(true);
            let url = `/server/sqlqueryfunction?page=${page}&pageSize=${pageSize}`;
            if (selectedGroup) url += `&group=${encodeURIComponent(selectedGroup)}`;
            if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
            if (dateRange === 'personalizado' && customStartDate && customEndDate) {
                url += `&dateStart=${customStartDate.toISOString().slice(0, 10)}&dateEnd=${customEndDate.toISOString().slice(0, 10)}`;
            }
            const res = await fetch(url);
            if (!res.ok) {
                setProducts([]);
                setFilteredProducts([]);
                setTotal(0);
                setLoading(false);
                return;
            }
            const json = await res.json();
            const cleanData = Array.isArray(json.data) ? json.data.map(normalizeProduct) : [];
            setProducts(cleanData);
            setFilteredProducts(cleanData);
            setTotal(json.total || 0);
            setLoading(false);
        };
        loadProducts();
    }, [page, pageSize, selectedGroup, searchTerm, dateRange, customStartDate, customEndDate]);


    // Paginación robusta
    const handlePrevPage = () => setPage((p) => Math.max(1, p - 1));
    const handleNextPage = () => setPage((p) => (p * pageSize < total ? p + 1 : p));


    // Exportar todos los datos filtrados (no solo la página actual)
    const handleExport = async (includeImages: boolean) => {
        setExporting(true);
        setExportProgress(0);
        setExportStatusMessage('Iniciando exportación...');

        // Trae todos los datos filtrados (sin paginación)
        let url = `/server/sqlqueryfunction?page=1&pageSize=100000`;
        if (selectedGroup) url += `&group=${encodeURIComponent(selectedGroup)}`;
        if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
        if (dateRange === 'personalizado' && customStartDate && customEndDate) {
            url += `&dateStart=${customStartDate.toISOString().slice(0, 10)}&dateEnd=${customEndDate.toISOString().slice(0, 10)}`;
        }
        const res = await fetch(url);
        const json = await res.json();
        const exportData = json.data || [];

        const tabs = selectedGroup === 'CALZADOS FEMENINOS' ? tabsForCalzadoFemenino : [];

        await exportCatalog(
            exportData,
            includeImages,
            'Catalogo_Filtrado.xlsx',
            (progress, message) => {
                setExportProgress(progress);
                setExportStatusMessage(message);
            },
            tabs
        );

        setExporting(false);
    };
    // Estado para el menú de exportación
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    // Manejar apertura del menú de exportación
    const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    // Manejar cierre del menú de exportación
    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    // Mapeo de grupos por categoría principal
    const ropaGroups = [
        'CONFECCIONES CABALLEROS',
        'CONF. JUVENIL VARONES',
        'CONFECCIONES DAMAS',
        'CONF. JUVENIL NI¥AS'
    ];
    const calzadoGroups = [
        'CALZADOS FEMENINOS',
        'CALZADOS MASCULINOS'
    ];
    const hogarGroups = [
        'HOGAR ACCESORIOS',
        'ACCESORIOS P/CABALLEROS',
        'BISUTERIA',
        'MICELANEO'
    ];
    const bebeGroups = [
        'CONF. BEBES VARONES',
        'CONF. BEBE NI¥AS',
        'CONF. INFANTE NI¥AS',
        'CONF. INFANTE VARONES',
        'CANASTILLA LINEA BLANCA',
        'CANASTILLA ENTRENAMIENTO',
        'CANASTILLA ACCESORIOS',
        'CANASTILLA EQUIPOS',
        'CANASTILLA MUEBLES',
        'CANASTILLA CALZADOS',
        'CANAS. ESTUCHES DE REGALO',
        'SIN CLASIFICAR',
        'CANASTILLA BEBE IMPORT',
        'VASOS,PLATOS,CUBIERTOS',
        'BIBERONES',
        'CHUPON,MORDEDOR,PACIFICADOR',
        'ACC. P/MEDICINA Y ASEO',
        'JUEGOS EDUCATIVOS'
    ];


    const tabsForCalzadoFemenino = [
        'AMAZONA',
        'JESSICA',
        'SOFIA',
        'KANELA',
        'KARLA',
        'MARISSA',
        'SANDRA',
        'LISSA',
        'TOTAL',
    ];
    // Calcular totales por página
    const calculatePageTotals = () => {
        let data = safeFilteredProducts;
        if (isCalzadoGroup(selectedGroup)) {
            data = data.filter(p => !excludeVLA(p.CodigoBase));
        }
        const totalExistencia = Math.round(data.reduce((sum: number, p) => sum + (p.Existencia ?? 0), 0));
        const totalReservado = Math.round(data.reduce((sum: number, p) => sum + (p.Reservado ?? 0), 0));
        const totalDisponible = Math.round(data.reduce((sum: number, p) => sum + (p.Disponible ?? 0), 0));
        const totalFuturo = Math.round(data.reduce((sum: number, p) => sum + (p.Futuro ?? 0), 0));
        return { totalExistencia, totalReservado, totalDisponible, totalFuturo };
    };

    const calculateGroupTotals = () => {
        let filteredGroup = safeProducts.filter((p) => {
            if (selectedTab) {
                return p.CodigoBase.startsWith(selectedTab);
            }
            if (selectedGroup) {
                return p.NOMBREGRUPO?.trim() === selectedGroup;
            }
            return true;
        });
        if (isCalzadoGroup(selectedGroup)) {
            filteredGroup = filteredGroup.filter(p => !excludeVLA(p.CodigoBase));
        }
        const totalExistencia = Math.round(filteredGroup.reduce((sum: number, p) => sum + (p.Existencia ?? 0), 0));
        const totalReservado = Math.round(filteredGroup.reduce((sum: number, p) => sum + (p.Reservado ?? 0), 0));
        const totalDisponible = Math.round(filteredGroup.reduce((sum: number, p) => sum + (p.Disponible ?? 0), 0));
        const totalFuturo = Math.round(filteredGroup.reduce((sum: number, p) => sum + (p.Futuro ?? 0), 0));
        return { totalExistencia, totalReservado, totalDisponible, totalFuturo };
    };

    // Para la tabla de totales por línea/tab
    const calculateTotalsForTabs = () => {
        if (!Array.isArray(tabsForCalzadoFemenino) || !Array.isArray(safeProducts)) return [];
        const totals = tabsForCalzadoFemenino
            .filter(linea => typeof linea === 'string' && linea.length > 0)
            .map((linea) => {
                let filtered = safeProducts.filter((p) => typeof p?.CodigoBase === 'string' && p.CodigoBase.startsWith(linea));
                if (isCalzadoGroup(selectedGroup)) {
                    filtered = filtered.filter(p => p && p.CodigoBase && !excludeVLA(p.CodigoBase));
                }
                const existencia = filtered.reduce((sum: number, p) => sum + (Number(p?.Existencia) || 0), 0);
                const reservado = filtered.reduce((sum: number, p) => sum + (Number(p?.Reservado) || 0), 0);
                const disponible = filtered.reduce((sum: number, p) => sum + (Number(p?.Disponible) || 0), 0);
                const futuro = filtered.reduce((sum: number, p) => sum + (Number(p?.Futuro) || 0), 0);

                return {
                    linea,
                    existencia,
                    reservado,
                    disponible,
                    futuro,
                };
            });

        // Totales generales
        const totalExistencia = safeProducts.reduce((sum: number, p) => sum + (Number(p?.Existencia) || 0), 0);
        const totalReservado = safeProducts.reduce((sum: number, p) => sum + (Number(p?.Reservado) || 0), 0);
        const totalDisponible = safeProducts.reduce((sum: number, p) => sum + (Number(p?.Disponible) || 0), 0);
        const totalFuturo = safeProducts.reduce((sum: number, p) => sum + (Number(p?.Futuro) || 0), 0);

        totals.push({
            linea: 'TOTALES',
            existencia: totalExistencia,
            reservado: totalReservado,
            disponible: totalDisponible,
            futuro: totalFuturo,
        });

        return totals;
    };
    function normalizeProduct(p: any): Product {
        return {
            CodigoBase: p.CodigoBase ?? '',
            NombreProducto: p.NombreProducto ?? '',
            ColorDescripcion: p.ColorDescripcion ?? '',
            CODIGOGRUPO: p.CODIGOGRUPO ?? '',
            NOMBREGRUPO: p.NOMBREGRUPO ?? '',
            FechaCreacion: p.FechaCreacion ?? '',
            Existencia: Number(p.Existencia) || 0,
            Reservado: Number(p.Reservado) || 0,
            Disponible: Number(p.Disponible) || 0,
            Futuro: Number(p.Futuro) || 0,
            UMEDIDA: p.UMEDIDA ? Number(p.UMEDIDA) : undefined,
            ImageUrl: p.ImageUrl ?? undefined,
        };
    }

    const totalsForTabs = calculateTotalsForTabs();
    console.log('Filtered Products:', safeFilteredProducts);
    console.log('Products in Group:', safeProducts.filter((p) => p.NOMBREGRUPO?.trim() === selectedGroup));

    // Filtrar los productos según los filtros aplicados
    useEffect(() => {
        let filtered = products;

        // Filtro por rango predefinido
        if (dateRange && dateRange !== 'personalizado') {
            const today = new Date();
            let startDate = new Date();

            switch (dateRange) {
                case '30 días':
                    startDate.setDate(today.getDate() - 30);
                    break;
                case '90 días':
                    startDate.setDate(today.getDate() - 90);
                    break;
                case '180 días':
                    startDate.setDate(today.getDate() - 180);
                    break;
                case '360 días':
                    startDate.setDate(today.getDate() - 360);
                    break;
                default:
                    break;
            }

            filtered = filtered.filter((product) => {
                const creationDate = new Date(product.FechaCreacion); // Convertir a objeto Date
                return creationDate >= startDate && creationDate <= today;
            });
        }

        // Filtro por rango personalizado
        if (dateRange === 'personalizado' && customStartDate && customEndDate) {
            filtered = filtered.filter((product) => {
                const creationDate = new Date(product.FechaCreacion); // Convertir a objeto Date
                return (
                    creationDate >= new Date(customStartDate) &&
                    creationDate <= new Date(customEndDate)
                );
            });
        }


        // 1) Solo productos con alguna existencia, reservado, disponible o futuro mayor a 0
        filtered = filtered.filter(
            p =>
                Number(p.Existencia) > 0 ||
                Number(p.Reservado) > 0 ||
                Number(p.Disponible) > 0 ||
                Number(p.Futuro) > 0
        );

        // EXCLUSIÓN para calzado femenino y masculino
        if (isCalzadoGroup(selectedGroup)) {
            filtered = filtered.filter(p => !excludeVLA(p.CodigoBase));
        }

        // Filtro por pestaña (solo si el grupo es "Calzado Femenino")
        if (selectedGroup === 'CALZADOS FEMENINOS' && selectedTab) {
            filtered = filtered.filter((p) => p.CodigoBase.startsWith(selectedTab));
        }

        // 2) Búsqueda texto
        if (searchTerm) {
            filtered = filtered.filter(p =>
                Object.values(p)
                    .some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase()))
            );
        }
        // 3) Filtro por término de búsqueda en la línea seleccionada
        if (selectedTab && lineSearchTerm) {
            filtered = filtered.filter((p) =>
                Object.values(p)
                    .some((v) => String(v).toLowerCase().includes(lineSearchTerm.toLowerCase()))
            );
        }

        // 4) Filtro por rango "desde - hasta"
        if (rangeStart && rangeEnd) {
            filtered = filtered.filter((p) => {
                const codigo = p.CodigoBase.trim().toLowerCase();
                const start = rangeStart.trim().toLowerCase();
                const end = rangeEnd.trim().toLowerCase();
                return codigo >= start && codigo <= end;
            });

            // Asegúrate de incluir el valor exacto de rangeEnd si no está incluido
            if (!filtered.some((p) => p.CodigoBase.trim().toLowerCase() === rangeEnd.trim().toLowerCase())) {
                const exactMatch = products.find((p) => p.CodigoBase.trim().toLowerCase() === rangeEnd.trim().toLowerCase());
                if (exactMatch) {
                    filtered.push(exactMatch);
                }
            }
        }
        // 3) Filtro por grupo
        if (selectedGroup) {
            filtered = filtered.filter(p => p.NOMBREGRUPO?.trim() === selectedGroup);
        }

        // 4) Filtro “Sólo reservados”
        if (showOnlySolicited) {
            filtered = filtered.filter(p => (p.Reservado ?? 0) > 0);
        }

        // 5) Filtro “Sólo disponibles”
        if (showOnlyDisponible) {
            filtered = filtered.filter(p => (p.Disponible ?? 0) > 0);
        }



        // 6) Depura en consola si quieres
        console.log('filtered count:', filtered.length);

        // 7) Finalmente, actualiza el estado
        setFilteredProducts(filtered);
        console.log('Productos filtrados:', setFilteredProducts);


    }, [
        products,
        searchTerm,
        selectedGroup,
        showOnlySolicited,
        showOnlyDisponible,
        selectedTab,
        dateRange,
        customStartDate,
        customEndDate,
        rangeStart,
        rangeEnd,
        lineSearchTerm,
    ]);


    // Manejar el cambio del filtro de grupo
    const handleGroupChange = (event: SelectChangeEvent) => {
        setSelectedGroup(event.target.value);
        setSelectedTab('');
        setRangeStart('');
        setRangeEnd('');
        setDateRange(''); // Limpiar el filtro de rango de fechas
        setCustomStartDate(null); // Limpiar la fecha personalizada de inicio
        setCustomEndDate(null); // Limpiar la fecha personalizada de fin
    };
    // Manejar el cambio de pestaña
    const handleTabChange = (event: React.SyntheticEvent, newValue: string) => {
        setSelectedTab(newValue);
        setLineSearchTerm('');
        setRangeStart('');
        setRangeEnd('');
        setDateRange(''); // Limpiar el filtro de rango de fechas
        setCustomStartDate(null); // Limpiar la fecha personalizada de inicio
        setCustomEndDate(null); // Limpiar la fecha personalizada de fin
    };

    // Limpiar todos los filtros
    const handleClearFilters = () => {
        setSearchTerm('');
        setSelectedGroup('');
        setShowOnlySolicited(false);
        setShowOnlyDisponible(false);
        setSelectedTab('');
        setLineSearchTerm('');
        setRangeStart('');
        setRangeEnd('');
        setDateRange(''); // Limpiar el filtro de rango de fechas
        setCustomStartDate(null); // Limpiar la fecha personalizada de inicio
        setCustomEndDate(null); // Limpiar la fecha personalizada de fin
        setFilteredProducts(products); // Restablecer los datos originales
    };




    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <Alert severity="error">{error}</Alert>
            </Box>
        );
    }


    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress />
            </Box>
        );
    }

    const handleOpenModal = (imagePath: string) => {
        setSelectedImage(imagePath);
        setModalOpen(true);
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        setSelectedImage(null);
    };


    const columns: GridColDef[] = [
        {
            field: 'imagen',
            headerName: 'Imagen',
            width: 120,
            align: 'center',
            headerAlign: 'center',
            renderCell: (params) => {
                const imageUrl = `https://sqlserver-proyect-883996440.development.catalystserverless.com/server/imgproxy/${params.row.CodigoBase.trim()}.jpg`;


                return (
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            width: '100%',
                            height: '80px',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            borderRadius: 2,
                            backgroundColor: '#f5f5f5',
                        }}
                        onClick={() => handleOpenModal(imageUrl)}
                    >
                        <Avatar
                            variant="rounded"
                            src={imageUrl}
                            alt={params.row.CodigoBase}
                            sx={{
                                width: 80,
                                height: 80,
                                objectFit: 'contain',
                                '&.MuiAvatar-img': {
                                    objectFit: 'contain'
                                }
                            }}
                            imgProps={{
                                onError: (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                    // Usar una imagen de fallback genérica
                                    const noImageUrl = 'https://via.placeholder.com/150?text=No+Image';
                                    e.currentTarget.src = noImageUrl;
                                }
                            }}
                        />
                    </Box>
                );
            },
        },
        { field: 'CodigoBase', headerName: 'Referencia', width: 140, align: 'center', headerAlign: 'center' },
        { field: 'NombreProducto', headerName: 'Nombre Producto', width: 220, align: 'center', headerAlign: 'center' },
        { field: 'ColorDescripcion', headerName: 'Color', width: 120, align: 'center', headerAlign: 'center' },
        { field: 'Existencia', headerName: 'Existencia', width: 110, align: 'center', headerAlign: 'center' },
        { field: 'Reservado', headerName: 'Reservado', width: 110, align: 'center', headerAlign: 'center' },
        { field: 'Disponible', headerName: 'Disponible', width: 110, align: 'center', headerAlign: 'center' },
        { field: 'Futuro', headerName: 'Futuro', width: 110, align: 'center', headerAlign: 'center' },
    ];


    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <Alert severity="error">{error}</Alert>
            </Box>
        );
    }


    // Justo después de los useState de products y filteredProducts:


    return (
        <>
            {/* Mostrar cartas de selección de categoría cuando no hay categoría principal seleccionada */}
            {!mainCategory && (
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        minHeight: '80vh',
                        width: '100%',
                        background: '#f5f5f5',
                    }}
                >
                    <Paper
                        elevation={4}
                        sx={{
                            width: '100%',
                            maxWidth: '1500px',
                            minHeight: 400,
                            boxShadow: 3,
                            borderRadius: 2,
                            p: 4,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#fff',
                        }}
                    >
                        <Typography variant="h4" color="primary" sx={{ mb: 1, fontWeight: 'bold', textAlign: 'center' }}>
                            CATALOGO IMPORTADORA PANAMA
                        </Typography>
                        <Typography variant="subtitle1" color="textSecondary" sx={{ mb: 4, textAlign: 'center' }}>
                            ELIJA UNA DE LAS CARTAS PARA VISUALIZAR EL CATALOGO
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, width: '100%' }}>
                            <Paper elevation={3} sx={{ p: 3, cursor: 'pointer', minWidth: 200, textAlign: 'center', flex: 1, mx: 1 }}
                                onClick={() => setMainCategory('ropa')}>
                                <Typography variant="h5" color="primary">Ropa</Typography>
                                <Typography variant="body2">Ver todos los grupos de ropa</Typography>
                            </Paper>
                            <Paper elevation={3} sx={{ p: 3, cursor: 'pointer', minWidth: 200, textAlign: 'center', flex: 1, mx: 1 }}
                                onClick={() => setMainCategory('calzado')}>
                                <Typography variant="h5" color="primary">Calzado</Typography>
                                <Typography variant="body2">Ver todos los grupos de calzado</Typography>
                            </Paper>
                            <Paper elevation={3} sx={{ p: 3, cursor: 'pointer', minWidth: 200, textAlign: 'center', flex: 1, mx: 1 }}
                                onClick={() => setMainCategory('hogar')}>
                                <Typography variant="h5" color="primary">HOGAR Y ACCESORIOS</Typography>
                                <Typography variant="body2">Ver todos los grupos de hogar y accesorios</Typography>
                            </Paper>
                            <Paper elevation={3} sx={{ p: 3, cursor: 'pointer', minWidth: 200, textAlign: 'center', flex: 1, mx: 1 }}
                                onClick={() => setMainCategory('bebe')}>
                                <Typography variant="h5" color="primary">Bebé</Typography>
                                <Typography variant="body2">Ver todos los grupos de bebé</Typography>
                            </Paper>
                        </Box>
                    </Paper>
                </Box>
            )}

            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    width: '100%',
                    p: 1
                }}
            >
                <Paper
                    sx={{
                        width: '100%',
                        maxWidth: '1500px',
                        boxShadow: 3,
                        overflow: 'hidden',
                        borderRadius: 2
                    }}
                >
                    {/* Barra de filtros y exportación: solo mostrar si hay categoría principal seleccionada */}
                    {mainCategory && (
                        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eaeaea' }}>
                            <Typography variant="h6">Catálogo de Productos</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Tooltip title="Exportar a Excel">
                                    <IconButton
                                        onClick={handleMenuOpen}
                                        disabled={filteredProducts.length === 0}
                                        aria-haspopup="true"
                                        aria-expanded={open ? 'true' : undefined}
                                        aria-controls={open ? 'export-menu' : undefined}
                                    >
                                        <DownloadIcon />
                                        <ArrowDropDownIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <Menu
                                    id="export-menu"
                                    anchorEl={anchorEl}
                                    open={open}
                                    onClose={handleMenuClose}
                                    MenuListProps={{
                                        'aria-labelledby': 'export-button',
                                    }}
                                >
                                    <MenuItem onClick={() => handleExport(true)}>Exportar con imágenes</MenuItem>
                                    <MenuItem onClick={() => handleExport(false)}>Exportar sin imágenes</MenuItem>
                                </Menu>
                            </Box>
                        </Box>
                    )}

                    {/* Botón para cambiar categoría principal */}
                    {mainCategory && (
                        <Box sx={{ mb: 2 }}>
                            <Button variant="outlined" onClick={() => { setMainCategory(''); setSelectedGroup(''); }}>
                                Cambiar categoría principal
                            </Button>
                        </Box>
                    )}

                    {exporting && (
                        <Box sx={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            width: '100%',
                            flexDirection: 'column',
                            p: 2,
                            mb: 2,
                            boxShadow: 1,
                            borderRadius: 1,
                            bgcolor: 'background.paper'
                        }}>
                            <Box sx={{ width: '100%', mb: 1 }}>
                                <LinearProgress
                                    variant="determinate"
                                    value={exportProgress}
                                    sx={{
                                        height: 10,
                                        borderRadius: 5,
                                        '& .MuiLinearProgress-bar': {
                                            borderRadius: 5,
                                            bgcolor: exportProgress < 100 ? 'primary.main' : 'success.main'
                                        }
                                    }}
                                />
                            </Box>
                            <Box sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                width: '100%',
                                px: 1
                            }}>
                                <Typography variant="body2" color="text.secondary">
                                    {exportStatusMessage}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {`${exportProgress}%`}
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    {/* Filtros y Búsqueda */}
                    {mainCategory && (
                        <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 2, bgcolor: '#f9f9f9', borderBottom: '1px solid #eaeaea' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <FilterIcon color="primary" />
                                <Typography variant="subtitle1">Filtrar por:</Typography>
                            </Box>

                            {/* Campo de búsqueda */}
                            <FormControl sx={{ minWidth: 200 }}>
                                <TextField
                                    size="small"
                                    placeholder="Buscar referencia..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchIcon color="action" />
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                            </FormControl>

                            <FormControl sx={{ minWidth: 200 }}>
                                <InputLabel id="group-select-label">Grupo</InputLabel>
                                <Select
                                    labelId="group-select-label"
                                    id="group-select"
                                    value={selectedGroup}
                                    label="Grupo"
                                    onChange={handleGroupChange}
                                    size="small"
                                >
                                    <MenuItem value="">
                                        <em>Todos los grupos</em>
                                    </MenuItem>
                                    {(mainCategory === 'ropa'
                                        ? ropaGroups
                                        : mainCategory === 'calzado'
                                            ? calzadoGroups
                                            : mainCategory === 'hogar'
                                                ? hogarGroups
                                                : mainCategory === 'bebe'
                                                    ? bebeGroups
                                                    : []
                                    ).map((group) => (
                                        <MenuItem key={group} value={group}>
                                            {group}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>



                            <FormControl>
                                <Button
                                    variant={showOnlySolicited ? 'contained' : 'outlined'}
                                    onClick={() => setShowOnlySolicited(!showOnlySolicited)}
                                >
                                    {showOnlySolicited ? 'Mostrar Todos' : 'Mostrar Solicitados'}
                                </Button>
                            </FormControl>
                            <FormControl>
                                <Button
                                    variant={showOnlyDisponible ? 'contained' : 'outlined'}
                                    onClick={() => setShowOnlyDisponible(!showOnlyDisponible)}
                                >
                                    {showOnlyDisponible ? 'Mostrar Todos' : 'Mostrar Disponibles'}
                                </Button>
                            </FormControl>


                            <Button variant="outlined" onClick={handleClearFilters}>
                                Limpiar filtros
                            </Button>



                            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center' }}>
                                <Typography variant="body2" color="text.secondary">
                                    {`${filteredProducts.length} productos ${selectedGroup ? `en ${selectedGroup}` : 'totales'}${showOnlySolicited ? ' con cantidades solicitadas' : ''}${searchTerm ? ` que coinciden con "${searchTerm}"` : ''}`}
                                </Typography>
                            </Box>

                        </Box>
                    )}

                    {/* Mostrar mensaje si no hay filtros activos */}
                    {mainCategory && !selectedGroup && !searchTerm && !showOnlySolicited && !showOnlyDisponible && (
                        <Box
                            sx={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                minHeight: '400px',
                                flexDirection: 'column',
                            }}
                        >
                            <Typography variant="h6" color="textSecondary">
                                Para visualizar información, elija un filtro.
                            </Typography>
                        </Box>
                    )}

                    {/* Mostrar contenido si hay filtros activos */}
                    {mainCategory && (selectedGroup || searchTerm || showOnlySolicited || showOnlyDisponible) && (
                        <>
                            {/* Pestañas dinámicas para "Calzado Femenino" */}
                            {selectedGroup === 'CALZADOS FEMENINOS' && (
                                <Tabs
                                    value={selectedTab}
                                    onChange={handleTabChange}
                                    indicatorColor="primary"
                                    textColor="primary"
                                    variant="scrollable"
                                    scrollButtons="auto"
                                    sx={{ mb: 2 }}
                                >
                                    {tabsForCalzadoFemenino.map((tab) => (
                                        <Tab key={tab} label={tab} value={tab} />
                                    ))}
                                </Tabs>
                            )}
                            {/* Buscador condicional para la línea seleccionada */}
                            {selectedTab && (
                                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                                    {/* Campo de búsqueda general */}
                                    <FormControl sx={{ minWidth: 200 }}>
                                        <TextField
                                            size="small"
                                            placeholder={`Buscar en ${selectedTab}...`}
                                            value={lineSearchTerm}
                                            onChange={(e) => setLineSearchTerm(e.target.value)}
                                            InputProps={{
                                                startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
                                            }}
                                        />
                                    </FormControl>

                                    {/* Campo "desde" */}
                                    <FormControl sx={{ minWidth: 150 }}>
                                        <Autocomplete
                                            options={safeFilteredProducts.map((p) => p.CodigoBase)}
                                            getOptionLabel={(option) => option}
                                            filterOptions={(options, { inputValue }) =>
                                                options.filter((option) =>
                                                    option.toLowerCase().includes(inputValue.toLowerCase())
                                                )
                                            }
                                            value={rangeStart}
                                            onChange={(event, newValue) => setRangeStart(newValue || '')}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label="Desde"
                                                    placeholder="Ej: AMAZONA045"
                                                    size="small"
                                                />
                                            )}
                                        />
                                    </FormControl>

                                    {/* Campo "hasta" */}
                                    <FormControl sx={{ minWidth: 150 }}>
                                        <Autocomplete
                                            options={safeFilteredProducts.map((p) => p.CodigoBase)}
                                            getOptionLabel={(option) => option}
                                            filterOptions={(options, { inputValue }) =>
                                                options.filter((option) =>
                                                    option.toLowerCase().includes(inputValue.toLowerCase())
                                                )
                                            }
                                            value={rangeEnd}
                                            onChange={(event, newValue) => setRangeEnd(newValue || '')}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label="Hasta"
                                                    placeholder="Ej: AMAZONA050"
                                                    size="small"
                                                />
                                            )}
                                        />
                                    </FormControl>
                                    <Button
                                        variant="outlined"
                                        onClick={() => {
                                            setRangeStart('');
                                            setRangeEnd('');

                                            // Si hay una pestaña seleccionada (como "AMAZONA"), filtrar por esa pestaña
                                            if (selectedTab) {
                                                const filteredByTab = products.filter((p) => p.CodigoBase.startsWith(selectedTab));
                                                setFilteredProducts(filteredByTab);
                                            }
                                            // Si hay un grupo seleccionado (como "CALZADOS FEMENILES"), filtrar por ese grupo
                                            else if (selectedGroup) {
                                                const filteredByGroup = products.filter((p) => p.NOMBREGRUPO?.trim() === selectedGroup);
                                                setFilteredProducts(filteredByGroup);
                                            }
                                            // Si no hay grupo ni pestaña seleccionada, mostrar todos los productos
                                            else {
                                                setFilteredProducts(products);
                                            }
                                        }}
                                    >
                                        Limpiar filtros Desde-Hasta
                                    </Button>
                                </Box>
                            )}
                            {/* Filtro por fecha de ingreso */}
                            <FormControl sx={{ minWidth: 200 }}>
                                <InputLabel id="date-range-label">Fecha Ingreso Inventario</InputLabel>
                                <Select
                                    labelId="date-range-label"
                                    value={dateRange}
                                    onChange={(e) => setDateRange(e.target.value)}
                                    size="small"
                                >
                                    <MenuItem value="">
                                        <em>Sin filtro</em>
                                    </MenuItem>
                                    <MenuItem value="30 días">Últimos 30 días</MenuItem>
                                    <MenuItem value="90 días">Últimos 90 días</MenuItem>
                                    <MenuItem value="180 días">Últimos 180 días</MenuItem>
                                    <MenuItem value="360 días">Últimos 360 días</MenuItem>
                                    <MenuItem value="personalizado">Personalizado</MenuItem>
                                </Select>
                            </FormControl>

                            {dateRange === 'personalizado' && (
                                <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
                                    <Box sx={{ display: 'flex', gap: 2 }}>
                                        <DatePicker
                                            label="Desde"
                                            value={customStartDate}
                                            onChange={(newValue) => setCustomStartDate(newValue)}
                                            slotProps={{
                                                textField: { size: 'small' },
                                            }}
                                        />
                                        <DatePicker
                                            label="Hasta"
                                            value={customEndDate}
                                            onChange={(newValue) => setCustomEndDate(newValue)}
                                            slotProps={{
                                                textField: { size: 'small' },
                                            }}
                                        />
                                    </Box>
                                </LocalizationProvider>
                            )}

                            {/* Totales por grupo y pagina*/}
                            {selectedGroup && (
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                    <Typography variant="subtitle1">
                                        Totales por página: Existencia: {calculatePageTotals().totalExistencia.toLocaleString('es-ES', { maximumFractionDigits: 0 })} | Reservado: {calculatePageTotals().totalReservado.toLocaleString('es-ES', { maximumFractionDigits: 0 })} | Disponible: {calculatePageTotals().totalDisponible.toLocaleString('es-ES', { maximumFractionDigits: 0 })} | Futuro: {calculatePageTotals().totalFuturo.toLocaleString('es-ES', { maximumFractionDigits: 0 })}
                                    </Typography>
                                    <Typography variant="subtitle1">
                                        Totales del grupo: Existencia: {calculateGroupTotals().totalExistencia.toLocaleString('es-ES', { maximumFractionDigits: 0 })} | Reservado: {calculateGroupTotals().totalReservado.toLocaleString('es-ES', { maximumFractionDigits: 0 })} | Disponible: {calculateGroupTotals().totalDisponible.toLocaleString('es-ES', { maximumFractionDigits: 0 })} | Futuro: {calculateGroupTotals().totalFuturo.toLocaleString('es-ES', { maximumFractionDigits: 0 })}
                                    </Typography>
                                </Box>
                            )}

                            {/* Tabla de totales para las líneas específicas */}
                            {selectedTab === 'TOTAL' ? (
                                <TableContainer component={Paper} sx={{ mb: 2 }}>
                                    <Table>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell align="center">LÍNEA</TableCell>
                                                <TableCell align="center">EXISTENCIA</TableCell>
                                                <TableCell align="center">RESERVADO</TableCell>
                                                <TableCell align="center">DISPONIBLE</TableCell>
                                                <TableCell align="center">FUTURO</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {Array.isArray(totalsForTabs) && totalsForTabs
                                                .filter(row => row && typeof row.linea === 'string') // Solo filas válidas
                                                .map((row, idx) => (
                                                    <TableRow key={row.linea || idx}>
                                                        <TableCell align="center" sx={{ fontWeight: row.linea === 'TOTALES' ? 'bold' : 'normal' }}>
                                                            {row.linea}
                                                        </TableCell>
                                                        <TableCell align="center" sx={{ fontWeight: row.linea === 'TOTALES' ? 'bold' : 'normal' }}>
                                                            {Number(row.existencia || 0).toLocaleString('es-ES', { useGrouping: true, minimumFractionDigits: 0 })}
                                                        </TableCell>
                                                        <TableCell align="center" sx={{ fontWeight: row.linea === 'TOTALES' ? 'bold' : 'normal' }}>
                                                            {Number(row.reservado || 0).toLocaleString('es-ES', { useGrouping: true, minimumFractionDigits: 0 })}
                                                        </TableCell>
                                                        <TableCell align="center" sx={{ fontWeight: row.linea === 'TOTALES' ? 'bold' : 'normal' }}>
                                                            {Number(row.disponible || 0).toLocaleString('es-ES', { useGrouping: true, minimumFractionDigits: 0 })}
                                                        </TableCell>
                                                        <TableCell align="center" sx={{
                                                            fontWeight: row.linea === 'TOTALES' ? 'bold' : 'normal',
                                                            color: row.linea === 'TOTALES' ? 'red' : 'inherit',
                                                        }}>
                                                            {Number(row.futuro || 0).toLocaleString('es-ES', { useGrouping: true, minimumFractionDigits: 0 })}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            ) : (
                                <DataGrid
                                    key={`${selectedGroup}_${showOnlySolicited}_${showOnlyDisponible}_${searchTerm}`}
                                    rows={safeFilteredProducts}
                                    columns={columns}
                                    getRowId={(row) => row.CodigoBase.trim()}
                                    disableRowSelectionOnClick
                                    autoHeight
                                    loading={loading}
                                    rowHeight={100}
                                    hideFooterSelectedRowCount
                                    disableColumnMenu
                                    sx={{
                                        '& .MuiDataGrid-cell': {
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '16px',
                                            padding: '8px',
                                        },
                                        '& .MuiDataGrid-columnHeader': {
                                            backgroundColor: '#f5f5f5',
                                            fontWeight: 'bold',
                                        },
                                        '.MuiDataGrid-root': {
                                            width: '100%',
                                        },
                                        '& .MuiLinearProgress-root': {
                                            display: 'none',
                                        },
                                    }}
                                />
                            )}

                            {/* Controles de paginación robustos */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                <Typography variant="body2">
                                    Página {page} de {Math.ceil(total / pageSize)} | Total registros: {total}
                                </Typography>
                                <Box>
                                    <Button onClick={handlePrevPage} disabled={page === 1}>Anterior</Button>
                                    <Button onClick={handleNextPage} disabled={page * pageSize >= total}>Siguiente</Button>
                                </Box>
                            </Box>
                        </>
                    )}
                </Paper>
            </Box>

            {/* Modal para mostrar la imagen en tamaño completo */}
            <Modal
                open={modalOpen}
                onClose={handleCloseModal}
                closeAfterTransition
                slots={{
                    backdrop: Backdrop,
                }}
                slotProps={{
                    backdrop: {
                        timeout: 500,
                    },
                }}
            >
                <Fade in={modalOpen}>
                    <Box sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        maxWidth: '90vw',
                        maxHeight: '90vh',
                        bgcolor: 'background.paper',
                        boxShadow: 24,
                        p: 1,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderRadius: 2
                    }}>
                        {selectedImage && (
                            <img
                                src={selectedImage}
                                alt="Producto"
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    objectFit: 'contain'
                                }}
                                onError={(e) => {
                                    e.currentTarget.src = 'https://via.placeholder.com/500?text=No+Image';
                                }}
                            />
                        )}
                    </Box>
                </Fade>
            </Modal>
        </>
    );
};