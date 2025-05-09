import React, { useState, useEffect } from 'react';
import { exportCatalog } from '../utils/exportCatalog';
import { filterByDate } from '../utils/filterByDate';


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
import { Autocomplete } from '@mui/material'; // Importa Autocomplete
import { Download as DownloadIcon, FilterAlt as FilterIcon, Search as SearchIcon } from '@mui/icons-material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
interface Product {
    CodigoBase: string;
    NombreProducto: string;
    ColorDescripcion: string;
    LA: number | null;
    LB: number | null;
    CODIGOGRUPO: string; // Código del grupo
    NOMBREGRUPO: string; // Nombre del grupo
    ImageUrl?: string;
}





export const ProductTable: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [lineSearchTerm, setLineSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<string>('');
    const [groups, setGroups] = useState<string[]>([]);
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


    const handleExport = async (includeImages: boolean) => {
        setExporting(true);
        setExportProgress(0);
        setExportStatusMessage('Iniciando exportación...');

        const tabs = selectedGroup === 'CALZADOS FEMENINOS' ? tabsForCalzadoFemenino : [];

        await exportCatalog(
            filteredProducts,
            includeImages,
            'Catalogo_Filtrado.xlsx',
            (progress, message) => {
                setExportProgress(progress);
                setExportStatusMessage(message);
            },
            tabs // Pasar las pestañas si corresponde
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
        const totalDisponible = Math.round(filteredProducts.reduce((sum, p) => sum + (p.LA ?? 0), 0));
        const totalSolicitado = Math.round(filteredProducts.reduce((sum, p) => sum + (p.LB ?? 0), 0));
        return { totalDisponible, totalSolicitado };
    };

    const calculateGroupTotals = () => {
        const filteredGroup = products.filter((p) => {
            if (selectedTab) {
                return p.CodigoBase.startsWith(selectedTab);
            }
            if (selectedGroup) {
                return p.NOMBREGRUPO?.trim() === selectedGroup;
            }
            return true;
        });

        const totalDisponible = Math.round(filteredGroup.reduce((sum, p) => sum + (p.LA ?? 0), 0));
        const totalSolicitado = Math.round(filteredGroup.reduce((sum, p) => sum + (p.LB ?? 0), 0));
        return { totalDisponible, totalSolicitado };
    };

    const calculateTotalsForTabs = () => {
        const totals = tabsForCalzadoFemenino.map((linea) => {
            const filtered = products.filter((p) => p.CodigoBase.startsWith(linea));
            const disponible = filtered.reduce((sum, p) => sum + (p.LA ?? 0), 0);
            const solicitado = filtered.reduce((sum, p) => sum + (p.LB ?? 0), 0);
            const total = disponible + solicitado;

            return {
                linea,
                disponible,
                solicitado,
                total,
            };
        });

        // Calcular totales generales
        const totalDisponible = totals.reduce((sum, t) => sum + t.disponible, 0);
        const totalSolicitado = totals.reduce((sum, t) => sum + t.solicitado, 0);
        const totalGeneral = totals.reduce((sum, t) => sum + t.total, 0);

        totals.push({
            linea: 'TOTALES',
            disponible: totalDisponible,
            solicitado: totalSolicitado,
            total: totalGeneral,
        });

        return totals;
    };

    const totalsForTabs = calculateTotalsForTabs();
    console.log('Filtered Products:', filteredProducts);
    console.log('Products in Group:', products.filter((p) => p.NOMBREGRUPO?.trim() === selectedGroup));

    // Cargar los datos desde el backend
    useEffect(() => {
        const loadProducts = async () => {
            try {
                setLoading(true);
                const res = await fetch('/server/sqlqueryfunction');
                if (!res.ok) throw new Error(`Error ${res.status}`);
                const json: Product[] = await res.json();

                setProducts(json);
                setFilteredProducts(json);
                // Carga de grupos
                setGroups(
                    Array.from(
                        new Set(
                            json
                                .map((r) => r.NOMBREGRUPO?.trim())
                                .filter((g): g is string => !!g)
                        )
                    )
                );

                setError(null);
            } catch (e: any) {
                console.error(e);
                setError(e.message || 'Error al cargar los productos');
            } finally {
                setLoading(false);
            }
        };

        loadProducts();
    }, []);

    // Filtrar los productos según los filtros aplicados
    useEffect(() => {
        let filtered = products;

        // Filtro por rango predefinido
        if (dateRange) {
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

            filtered = filterByDate(filtered, startDate, today);
        }

        // Filtro por rango personalizado
        if (customStartDate && customEndDate) {
            filtered = filterByDate(filtered, customStartDate, customEndDate);
        }

        // 1) Sólo productos con algo en LA o LB
        filtered = filtered.filter(p => Number(p.LA) > 0 || Number(p.LB) > 0);

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

        // 4) Filtro “Sólo solicitados”
        if (showOnlySolicited) {
            filtered = filtered.filter(p => (p.LB ?? 0) > 0);
        }

        if (showOnlyDisponible) {
            filtered = filtered.filter(p => (p.LA ?? 0) > 0);
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
        rangeStart, // Dependencia para el rango "desde"
        rangeEnd,
        lineSearchTerm,

    ]);


    // Manejar el cambio del filtro de grupo
    const handleGroupChange = (event: SelectChangeEvent) => {
        setSelectedGroup(event.target.value);
        setSelectedTab('');
        setRangeStart('');
        setRangeEnd('');
    };
    // Manejar el cambio de pestaña
    const handleTabChange = (event: React.SyntheticEvent, newValue: string) => {
        setSelectedTab(newValue);
        setLineSearchTerm('');
        setRangeStart('');
        setRangeEnd('');
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

    if (error) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <Alert severity="error">{error}</Alert>
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
            width: 320,
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
                            height: '200px', // Altura fija para el contenedor de la imagen
                            cursor: 'pointer',
                            overflow: 'hidden', // Asegura que la imagen no se desborde
                            borderRadius: 2, // Opcional: bordes redondeados
                            backgroundColor: '#f5f5f5', // Fondo gris claro para imágenes que no cargan
                        }}
                        onClick={() => handleOpenModal(imageUrl)}
                    >
                        <Avatar
                            variant="rounded"
                            src={imageUrl}
                            alt={params.row.codigoArticulo}
                            sx={{
                                width: 300,
                                height: 300,
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
        {
            field: 'CodigoBase',
            headerName: 'Referencia',
            width: 180,
            align: 'center',
            headerAlign: 'center',
        },
        {
            field: 'NombreProducto',
            headerName: 'Nombre Producto',
            width: 250,
            align: 'center',
            headerAlign: 'center',
        },
        {
            field: 'ColorDescripcion',
            headerName: 'Color',
            width: 220,
            align: 'center',
            headerAlign: 'center',
        },
        {
            field: 'LA',
            headerName: 'Disponible',
            width: 120,
            align: 'center',
            headerAlign: 'center',
        },
        {
            field: 'LB',
            headerName: 'Solicitado',
            width: 120,
            align: 'center',
            headerAlign: 'center',
        },
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

    return (
        <>
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
                                {groups.map((group) => (
                                    <MenuItem key={group} value={group}>
                                        {group}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
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
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <TextField
                                    label="Desde"
                                    type="date"
                                    InputLabelProps={{ shrink: true }}
                                    value={customStartDate ? customStartDate.toISOString().split('T')[0] : ''}
                                    onChange={(e) => setCustomStartDate(new Date(e.target.value))}
                                />
                                <TextField
                                    label="Hasta"
                                    type="date"
                                    InputLabelProps={{ shrink: true }}
                                    value={customEndDate ? customEndDate.toISOString().split('T')[0] : ''}
                                    onChange={(e) => setCustomEndDate(new Date(e.target.value))}
                                />
                            </Box>
                        )}



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
                    {/* Mostrar mensaje si no hay filtros activos */}
                    {!selectedGroup && !searchTerm && !showOnlySolicited && !showOnlyDisponible && (
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
                    {(selectedGroup || searchTerm || showOnlySolicited || showOnlyDisponible) && (
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
                                            options={products.map((p) => p.CodigoBase)} // Lista de opciones basada en los productos
                                            getOptionLabel={(option) => option} // Muestra el texto de la opción
                                            filterOptions={(options, { inputValue }) =>
                                                options.filter((option) =>
                                                    option.toLowerCase().includes(inputValue.toLowerCase())
                                                )
                                            } // Filtra las opciones según lo que escribe el usuario
                                            value={rangeStart}
                                            onChange={(event, newValue) => setRangeStart(newValue || '')} // Actualiza el estado
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
                                            options={products.map((p) => p.CodigoBase)} // Lista de opciones basada en los productos
                                            getOptionLabel={(option) => option} // Muestra el texto de la opción
                                            filterOptions={(options, { inputValue }) =>
                                                options.filter((option) =>
                                                    option.toLowerCase().includes(inputValue.toLowerCase())
                                                )
                                            } // Filtra las opciones según lo que escribe el usuario
                                            value={rangeEnd}
                                            onChange={(event, newValue) => setRangeEnd(newValue || '')} // Actualiza el estado
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
                                            // Si hay un grupo seleccionado (como "CALZADOS FEMENINOS"), filtrar por ese grupo
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

                            {/* Totales por grupo y pagina*/}
                            {selectedGroup && (
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                    <Typography variant="subtitle1">
                                        Totales por página: Disponible: {calculatePageTotals().totalDisponible.toLocaleString('es-ES', { maximumFractionDigits: 0 })} | Solicitado: {calculatePageTotals().totalSolicitado.toLocaleString('es-ES', { maximumFractionDigits: 0 })}
                                    </Typography>
                                    <Typography variant="subtitle1">
                                        Totales del grupo: Disponible: {calculateGroupTotals().totalDisponible.toLocaleString('es-ES', { maximumFractionDigits: 0 })} | Solicitado: {calculateGroupTotals().totalSolicitado.toLocaleString('es-ES', { maximumFractionDigits: 0 })}
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
                                                <TableCell align="center">DISPONIBLE</TableCell>
                                                <TableCell align="center">SOLICITADO</TableCell>
                                                <TableCell align="center">TOTAL</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {totalsForTabs.map((row) => (
                                                <TableRow key={row.linea}>
                                                    <TableCell
                                                        align="center"
                                                        sx={{
                                                            fontWeight:
                                                                row.linea === 'TOTALES'
                                                                    ? 'bold'
                                                                    : 'normal',
                                                        }}
                                                    >
                                                        {row.linea}
                                                    </TableCell>
                                                    <TableCell
                                                        align="center"
                                                        sx={{
                                                            fontWeight:
                                                                row.linea === 'TOTALES'
                                                                    ? 'bold'
                                                                    : 'normal',
                                                        }}
                                                    >
                                                        {row.disponible.toLocaleString('es-ES', {
                                                            useGrouping: true,
                                                            minimumFractionDigits: 0,
                                                        })}
                                                    </TableCell>
                                                    <TableCell
                                                        align="center"
                                                        sx={{
                                                            fontWeight:
                                                                row.linea === 'TOTALES'
                                                                    ? 'bold'
                                                                    : 'normal',
                                                        }}
                                                    >
                                                        {row.solicitado.toLocaleString('es-ES', {
                                                            useGrouping: true,
                                                            minimumFractionDigits: 0,
                                                        })}
                                                    </TableCell>
                                                    <TableCell
                                                        align="center"
                                                        sx={{
                                                            fontWeight:
                                                                row.linea === 'TOTALES'
                                                                    ? 'bold'
                                                                    : 'normal',
                                                            color:
                                                                row.linea === 'TOTALES'
                                                                    ? 'red'
                                                                    : 'inherit',
                                                        }}
                                                    >
                                                        {row.total.toLocaleString('es-ES', {
                                                            useGrouping: true,
                                                            minimumFractionDigits: 0,
                                                        })}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            ) : (
                                <DataGrid
                                    key={`${selectedGroup}_${showOnlySolicited}_${showOnlyDisponible}_${searchTerm}`}
                                    rows={filteredProducts}
                                    columns={columns}
                                    getRowId={(row) => row.CodigoBase.trim()}
                                    disableRowSelectionOnClick
                                    autoHeight
                                    loading={loading}
                                    rowHeight={260}
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