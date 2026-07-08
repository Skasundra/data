import { Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Box, Button, IconButton, Tooltip, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import LanguageIcon from '@mui/icons-material/Language';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/Info';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import WorkIcon from '@mui/icons-material/Work';
import { useState } from 'react';

const ResultsTable = ({ results, scraperId }) => {
  const [page, setPage] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedCompanyDetails, setSelectedCompanyDetails] = useState(null);
  const rowsPerPage = 10;

  if (!results || results.length === 0) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 6,
          textAlign: 'center',
          background: '#ffffff',
          border: '1px solid #e5e5e5',
          borderRadius: 3,
        }}
      >
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: '#f5f5f5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <DownloadIcon sx={{ fontSize: 40, color: '#9ca3af' }} />
        </Box>
        <Typography variant="h6" sx={{ mb: 1, fontWeight: 600, color: '#111111' }}>
          No Results Yet
        </Typography>
        <Typography variant="body2" sx={{ color: '#6b7280' }}>
          Select a scraper and start scraping to see results here
        </Typography>
      </Paper>
    );
  }

  const allColumns = results[0] && typeof results[0] === 'object' ? Object.keys(results[0]) : [];

  if (allColumns.length === 0) {
    return (
      <Paper elevation={0} sx={{ p: 4, textAlign: 'center', background: '#ffffff', borderRadius: 3, border: '1px solid #e5e5e5' }}>
        <Typography variant="h6" color="error">
          Invalid data format received
        </Typography>
      </Paper>
    );
  }

  const columnConfig = {
    'google-maps': ['storeName', 'category', 'phone', 'googleUrl', 'bizWebsite'],
    'google-maps-enhanced': ['storeName', 'category', 'phone', 'website', 'address', 'stars', 'companyDetails'],
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
    'citysearch': ['storeName', 'category', 'phone', 'website', 'address'],
    'idbf': ['storeName', 'category', 'phone', 'address', 'pincode', 'state', 'city', 'idbfUrl'],
    'advanced-google-scrape': ['storeName', 'category', 'phone', 'bizWebsite', 'address', 'stars', 'numberOfReviews', 'companyDetails', 'searchKeyword', 'searchLocation']
  };

  const displayColumns = columnConfig[scraperId] || allColumns;
  const columns = displayColumns.filter(col => allColumns.includes(col));
  const paginatedResults = results.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  const isUrlField = (columnName) => {
    const urlFields = ['website', 'bizWebsite', 'googleUrl', 'url', 'yelpUrl', 'idbfUrl'];
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
      'pincode': 'Pincode',
      'city': 'City',
      'idbfUrl': 'IDBF Link',
      'yelpUrl': 'Yelp URL',
      'companyDetails': 'Company Details'
    };
    return nameMap[columnName] || columnName.charAt(0).toUpperCase() + columnName.slice(1);
  };

  const handleDownload = () => {
    const csv = [
      columns.join(','),
      ...results.map(row => columns.map(col => {
        if (col === 'companyDetails' && row[col]) {
          return `"${JSON.stringify(row[col]).replace(/"/g, '""')}"`;
        }
        return `"${row[col] || ''}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scrape-results-${Date.now()}.csv`;
    a.click();
  };

  const handleCompanyDetailsClick = (companyDetails) => {
    setSelectedCompanyDetails(companyDetails);
    setDetailsOpen(true);
  };

  const renderCompanyDetailsDialog = () => (
    <Dialog
      open={detailsOpen}
      onClose={() => setDetailsOpen(false)}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          background: '#ffffff',
          border: '1px solid #e5e5e5',
          borderRadius: 3,
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#111111' }}>
          Company Details
        </Typography>
      </DialogTitle>
      <DialogContent>
        {selectedCompanyDetails && (
          <Box sx={{ mt: 1 }}>
            {selectedCompanyDetails.companyName && (
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                {selectedCompanyDetails.companyName}
              </Typography>
            )}
            
            {selectedCompanyDetails.description && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Description
                </Typography>
                <Typography variant="body2" sx={{ color: '#6b7280' }}>
                  {selectedCompanyDetails.description}
                </Typography>
              </Box>
            )}

            {selectedCompanyDetails.emails && selectedCompanyDetails.emails.length > 0 && (
              <Accordion sx={{ mb: 2, background: '#fafafa', border: '1px solid #e5e5e5' }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <EmailIcon sx={{ fontSize: 20, color: '#111111' }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Email Addresses ({selectedCompanyDetails.emails.length})
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  {selectedCompanyDetails.emails.map((email, index) => (
                    <Chip
                      key={index}
                      label={email}
                      size="small"
                      sx={{ mr: 1, mb: 1, background: '#f5f5f5', border: '1px solid #e5e5e5' }}
                    />
                  ))}
                </AccordionDetails>
              </Accordion>
            )}

            {selectedCompanyDetails.phoneNumbers && selectedCompanyDetails.phoneNumbers.length > 0 && (
              <Accordion sx={{ mb: 2, background: '#fafafa', border: '1px solid #e5e5e5' }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PhoneIcon sx={{ fontSize: 20, color: '#111111' }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Phone Numbers ({selectedCompanyDetails.phoneNumbers.length})
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  {selectedCompanyDetails.phoneNumbers.map((phone, index) => (
                    <Chip
                      key={index}
                      label={phone}
                      size="small"
                      sx={{ mr: 1, mb: 1, background: '#f5f5f5', border: '1px solid #e5e5e5' }}
                    />
                  ))}
                </AccordionDetails>
              </Accordion>
            )}

            {selectedCompanyDetails.careerPage && selectedCompanyDetails.careerPage.found && (
              <Accordion sx={{ mb: 2, background: '#fafafa', border: '1px solid #e5e5e5' }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WorkIcon sx={{ fontSize: 20, color: '#111111' }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Career Information
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  {selectedCompanyDetails.careerPage.url && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" sx={{ color: '#6b7280' }}>Career Page:</Typography>
                      <Button
                        size="small"
                        startIcon={<LanguageIcon />}
                        onClick={() => window.open(selectedCompanyDetails.careerPage.url, '_blank')}
                        sx={{ ml: 1, textTransform: 'none', color: '#111111' }}
                      >
                        View Career Page
                      </Button>
                    </Box>
                  )}
                  {selectedCompanyDetails.careerPage.availableJobs && selectedCompanyDetails.careerPage.availableJobs.length > 0 && (
                    <Box>
                      <Typography variant="caption" sx={{ color: '#6b7280', mb: 1, display: 'block' }}>
                        Available Jobs ({selectedCompanyDetails.careerPage.availableJobs.length}):
                      </Typography>
                      {selectedCompanyDetails.careerPage.availableJobs.slice(0, 5).map((job, index) => (
                        <Box key={index} sx={{ mb: 1, p: 1, background: '#fafafa', borderRadius: 1, border: '1px solid #f0f0f0' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {job.title}
                          </Typography>
                          {job.description && (
                            <Typography variant="caption" sx={{ color: '#6b7280' }}>
                              {job.description.substring(0, 100)}...
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Box>
                  )}
                </AccordionDetails>
              </Accordion>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setDetailsOpen(false)} sx={{ color: '#111111' }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <>
      {renderCompanyDetailsDialog()}
      <Paper
        elevation={0}
        sx={{
          background: '#ffffff',
          border: '1px solid #e5e5e5',
          borderRadius: 3,
          overflow: 'hidden',
          height: '700px',
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
                color: '#111111',
              }}
            >
              Results
            </Typography>
            <Chip
              icon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
              label={`${results.length} Records`}
              size="small"
              sx={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#16a34a',
                fontWeight: 600,
                fontSize: '0.75rem',
                height: 24,
                '& .MuiChip-icon': {
                  color: '#16a34a',
                }
              }}
            />
          </Box>
          <Typography variant="body2" sx={{ color: '#6b7280' }}>
            Showing {page * rowsPerPage + 1} - {Math.min((page + 1) * rowsPerPage, results.length)} of {results.length}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleDownload}
          sx={{
            borderColor: '#d1d5db',
            color: '#111111',
            fontWeight: 600,
            borderRadius: 2,
            px: 3,
            '&:hover': {
              borderColor: '#111111',
              background: '#fafafa',
              transform: 'translateY(-1px)',
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
                    backgroundColor: '#fafafa',
                    borderBottom: '2px solid #e5e5e5',
                    color: '#6b7280',
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
                    backgroundColor: '#fafafa',
                  },
                  transition: 'background-color 0.2s',
                }}
              >
                {columns.map((column) => (
                  <TableCell
                    key={column}
                    sx={{
                      borderBottom: '1px solid #f0f0f0',
                      py: 2,
                    }}
                  >
                    {column === 'companyDetails' && row[column] ? (
                      <Tooltip title="View company details" arrow>
                        <IconButton
                          size="small"
                          onClick={() => handleCompanyDetailsClick(row[column])}
                          sx={{
                            p: 1,
                            background: '#f5f5f5',
                            border: '1px solid #e5e5e5',
                            borderRadius: 1.5,
                            '&:hover': {
                              background: '#eeeeee',
                              transform: 'scale(1.05)',
                            },
                            transition: 'all 0.2s',
                          }}
                        >
                          <InfoIcon sx={{ fontSize: 18, color: '#111111' }} />
                        </IconButton>
                      </Tooltip>
                    ) : isUrlField(column) && row[column] ? (
                      <Tooltip title={row[column]} arrow>
                        <IconButton
                          size="small"
                          onClick={() => window.open(row[column], '_blank')}
                          sx={{
                            p: 1,
                            background: '#f5f5f5',
                            border: '1px solid #e5e5e5',
                            borderRadius: 1.5,
                            '&:hover': {
                              background: '#eeeeee',
                              transform: 'scale(1.05)',
                            },
                            transition: 'all 0.2s',
                          }}
                        >
                          {column === 'googleUrl' ?
                            <OpenInNewIcon sx={{ fontSize: 18, color: '#111111' }} /> :
                            <LanguageIcon sx={{ fontSize: 18, color: '#111111' }} />
                          }
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: '0.875rem',
                          color: row[column] ? '#111111' : '#9ca3af',
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

      <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e5e5e5', flexShrink: 0 }}>
        <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '0.875rem' }}>
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
              color: '#111111',
              '&:hover': {
                background: '#f5f5f5',
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
              color: '#111111',
              '&:hover': {
                background: '#f5f5f5',
              }
            }}
          >
            Next
          </Button>
        </Box>
      </Box>
      </Paper>
    </>
  );
};

export default ResultsTable;
