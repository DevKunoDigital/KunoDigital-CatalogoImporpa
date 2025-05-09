import { Container, CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { ProductTable } from './components/ProductTable';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    background: {
      default: '#f5f5f5',
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <ProductTable />
      </Container>
    </ThemeProvider>
  );
}

export default App;
