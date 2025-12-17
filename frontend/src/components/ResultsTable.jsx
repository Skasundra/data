import { Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Box, Button, IconButton, Tooltip, Chip, alpha } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import LanguageIcon from '@mui/icons-material/Language';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useState } from 'react';

const ResultsTable = ({ results, scraperId }) => {
  const [page, setPage] = useState(0);
  const rowsPerPage = 10;

  if (!results || results.length === 0) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 6,
          textAlign: 'center',
          background: 'rgba(30, 41, 59, 0.7)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 3,
        }}
      >
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'rgba(99, 102, 241, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <DownloadIcon sx={{ fontSize: 40, color: '#818cf8' }} />
        </Box>
        <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
          No Results Yet
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Select a scraper and start scraping to see results here
        </Typography>
      </Paper>
    );
  }

  const allColumns = results[0] && typeof results[0] === 'object' ? Object.keys(results[0]) : [];

  if (allColumns.length === 0) {
    return (
      <Paper elevation={0} sx={{ p: 4, textAlign: 'center', background: 'rgba(30, 41, 59, 0.7)', borderRadius: 3 }}>
        <Typography variant="h6" color="error">
          Invalid data format received
        </Typography>
      </Paper>
    );
  }

  const columnConfig = {
    'google-maps': ['storeName', 'category', 'phone', 'googleUrl', 'bizWebsite'],
    'yellow-pages': ['storeName', 'category', 'phone', 'website', 'address'],
    'yelp': ['storeName', 'category', 'phone', 'website', 'stars', 'numberOfReviews'],
    'bbb': ['storeName', 'category', 'phone', 'website', 'rating'],
    'angi': ['storeName', 'category', 'phone', 'website', 'rating'],
    'justdial': ['storeName', 'category', 'phone', 'website', 'address'],
    'indiamart': ['storeName', 'category', 'phone', 'website', 'address'],
    'sulekha': ['storeName', 'category', 'phone', 'website', 'address'],
    'tradeindia': ['storeName', 'category', 'phone', 'website', 'address'],
    'exportersindia': ['storeName', 'category', 'phone', 'website', 'address'],
    'manta': ['storeName', 'category', 'phone', 'website', 'address'],
    'yellowpages-ca': ['storeName', 'category', 'phone', 'website', 'address'],
    'superpages': ['storeName', 'category', 'phone', 'website', 'address'],
    'citysearch': ['storeName', 'category', 'phone', 'website', 'address']
  };

  const displayColumns = columnConfig[scraperId] || allColumns;
  const columns = displayColumns.filter(col => allColumns.includes(col));
  const paginatedResults = results.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  const isUrlField = (columnName) => {
    const urlFields = ['website', 'bizWebsite', 'googleUrl', 'url', 'yelpUrl'];
    return urlFields.includes(columnName);
  };

  const formatColumnName = (columnName) => {
    const nameMap = {
      'storeName': 'Business Name',
      'category': 'Category',
      'phone': 'Phone',
      'googleUrl': 'Google Maps',
      'bizWebsite': 'Website',
      'website': 'Website',
      'address': 'Address',
      'stars': 'Rating',
      'numberOfReviews': 'Reviews',
      'rating': 'Rating',
      'yelpUrl': 'Yelp URL'
    };
    return nameMap[columnName] || columnName.charAt(0).toUpperCase() + columnName.slice(1);
  };

  const handleDownload = () => {
    const csv = [
      columns.join(','),
      ...results.map(row => columns.map(col => `"${row[col] || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scrape-results-${Date.now()}.csv`;
    a.click();
  };

  return (
    <Paper
      elevation={0}
      sx={{
        background: 'rgba(30, 41, 59, 0.7)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 3,
        overflow: 'hidden',
        height: '700px', // Fixed height for 10 rows + header + footer
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, flexShrink: 0 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(45deg, #6366f1 30%, #ec4899 90%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Results
            </Typography>
            <Chip
              icon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
              label={`${results.length} Records`}
              size="small"
              sx={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#10b981',
                fontWeight: 600,
                fontSize: '0.75rem',
                height: 24,
                '& .MuiChip-icon': {
                  color: '#10b981',
                }
              }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            Showing {page * rowsPerPage + 1} - {Math.min((page + 1) * rowsPerPage, results.length)} of {results.length}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleDownload}
          sx={{
            borderColor: 'rgba(99, 102, 241, 0.3)',
            color: '#818cf8',
            fontWeight: 600,
            borderRadius: 2,
            px: 3,
            '&:hover': {
              borderColor: '#6366f1',
              background: 'rgba(99, 102, 241, 0.1)',
              transform: 'translateY(-2px)',
            },
            transition: 'all 0.2s',
          }}
        >
          Export CSV
        </Button>
      </Box>

      <TableContainer sx={{ flexGrow: 1, overflow: 'auto' }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column}
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    backdropFilter: 'blur(12px)',
                    borderBottom: '2px solid rgba(99, 102, 241, 0.3)',
                    color: '#94a3b8',
                    py: 2,
                  }}
                >
                  {formatColumnName(column)}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedResults.map((row, index) => (
              <TableRow
                key={index}
                sx={{
                  '&:hover': {
                    backgroundColor: alpha('#6366f1', 0.05),
                  },
                  transition: 'background-color 0.2s',
                }}
              >
                {columns.map((column) => (
                  <TableCell
                    key={column}
                    sx={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      py: 2,
                    }}
                  >
                    {isUrlField(column) && row[column] ? (
                      <Tooltip title={row[column]} arrow>
                        <IconButton
                          size="small"
                          onClick={() => window.open(row[column], '_blank')}
                          sx={{
                            p: 1,
                            background: 'rgba(99, 102, 241, 0.1)',
                            border: '1px solid rgba(99, 102, 241, 0.2)',
                            borderRadius: 1.5,
                            '&:hover': {
                              background: 'rgba(99, 102, 241, 0.2)',
                              transform: 'scale(1.1)',
                            },
                            transition: 'all 0.2s',
                          }}
                        >
                          {column === 'googleUrl' ?
                            <OpenInNewIcon sx={{ fontSize: 18, color: '#818cf8' }} /> :
                            <LanguageIcon sx={{ fontSize: 18, color: '#818cf8' }} />
                          }
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: '0.875rem',
                          color: row[column] ? 'text.primary' : 'text.secondary',
                        }}
                      >
                        {row[column] || '-'}
                      </Typography>
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.08)', flexShrink: 0 }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
          Page {page + 1} of {Math.ceil(results.length / rowsPerPage)}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
            startIcon={<NavigateBeforeIcon />}
            sx={{
              borderRadius: 2,
              fontWeight: 600,
              px: 2,
              '&:hover': {
                background: 'rgba(99, 102, 241, 0.1)',
              }
            }}
          >
            Previous
          </Button>
          <Button
            size="small"
            disabled={(page + 1) * rowsPerPage >= results.length}
            onClick={() => setPage(p => p + 1)}
            endIcon={<NavigateNextIcon />}
            sx={{
              borderRadius: 2,
              fontWeight: 600,
              px: 2,
              '&:hover': {
                background: 'rgba(99, 102, 241, 0.1)',
              }
            }}
          >
            Next
          </Button>
        </Box>
      </Box>
    </Paper>
  );
};

export default ResultsTable;
