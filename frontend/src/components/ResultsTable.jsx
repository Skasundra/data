import { Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Box, Button, IconButton, Tooltip, Chip, alpha, Dialog, DialogTitle, DialogContent, DialogActions, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
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
          background: 'rgba(30, 41, 59, 0.95)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 3,
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#6366f1' }}>
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
                <Typography variant="body2" color="text.secondary">
                  {selectedCompanyDetails.description}
                </Typography>
              </Box>
            )}

            {selectedCompanyDetails.emails && selectedCompanyDetails.emails.length > 0 && (
              <Accordion sx={{ mb: 2, background: 'rgba(15, 23, 42, 0.4)' }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <EmailIcon sx={{ fontSize: 20, color: '#6366f1' }} />
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
                      sx={{ mr: 1, mb: 1, background: 'rgba(99, 102, 241, 0.1)' }}
                    />
                  ))}
                </AccordionDetails>
              </Accordion>
            )}

            {selectedCompanyDetails.phoneNumbers && selectedCompanyDetails.phoneNumbers.length > 0 && (
              <Accordion sx={{ mb: 2, background: 'rgba(15, 23, 42, 0.4)' }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PhoneIcon sx={{ fontSize: 20, color: '#6366f1' }} />
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
                      sx={{ mr: 1, mb: 1, background: 'rgba(99, 102, 241, 0.1)' }}
                    />
                  ))}
                </AccordionDetails>
              </Accordion>
            )}

            {selectedCompanyDetails.careerPage && selectedCompanyDetails.careerPage.found && (
              <Accordion sx={{ mb: 2, background: 'rgba(15, 23, 42, 0.4)' }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WorkIcon sx={{ fontSize: 20, color: '#6366f1' }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Career Information
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  {selectedCompanyDetails.careerPage.url && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="text.secondary">Career Page:</Typography>
                      <Button
                        size="small"
                        startIcon={<LanguageIcon />}
                        onClick={() => window.open(selectedCompanyDetails.careerPage.url, '_blank')}
                        sx={{ ml: 1, textTransform: 'none' }}
                      >
                        View Career Page
                      </Button>
                    </Box>
                  )}
                  {selectedCompanyDetails.careerPage.availableJobs && selectedCompanyDetails.careerPage.availableJobs.length > 0 && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                        Available Jobs ({selectedCompanyDetails.careerPage.availableJobs.length}):
                      </Typography>
                      {selectedCompanyDetails.careerPage.availableJobs.slice(0, 5).map((job, index) => (
                        <Box key={index} sx={{ mb: 1, p: 1, background: 'rgba(99, 102, 241, 0.05)', borderRadius: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {job.title}
                          </Typography>
                          {job.description && (
                            <Typography variant="caption" color="text.secondary">
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
        <Button onClick={() => setDetailsOpen(false)} sx={{ color: '#6366f1' }}>
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
                    {column === 'companyDetails' && row[column] ? (
                      <Tooltip title="View company details" arrow>
                        <IconButton
                          size="small"
                          onClick={() => handleCompanyDetailsClick(row[column])}
                          sx={{
                            p: 1,
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            borderRadius: 1.5,
                            '&:hover': {
                              background: 'rgba(16, 185, 129, 0.2)',
                              transform: 'scale(1.1)',
                            },
                            transition: 'all 0.2s',
                          }}
                        >
                          <InfoIcon sx={{ fontSize: 18, color: '#10b981' }} />
                        </IconButton>
                      </Tooltip>
                    ) : isUrlField(column) && row[column] ? (
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
    </>
  );
};

export default ResultsTable;
