import { useState } from 'react';
import {
  Paper, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Box, Button, IconButton, Tooltip, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, Accordion,
  AccordionSummary, AccordionDetails
} from '@mui/material';
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
import { tokens } from '../../theme/theme';

const JobResultsTable = ({ results }) => {
  const [page, setPage] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedCompanyDetails, setSelectedCompanyDetails] = useState(null);
  const rowsPerPage = 10;

  if (!results || results.length === 0) {
    return (
      <Paper
        sx={{
          p: 6,
          textAlign: 'center',
          borderRadius: '12px',
        }}
      >
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '12px',
            bgcolor: '#f9fafb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <InfoIcon sx={{ fontSize: 32, color: tokens.textMuted }} />
        </Box>
        <Typography variant="h5" sx={{ mb: 1, fontWeight: 700 }}>
          No Results Found
        </Typography>
        <Typography variant="body2" sx={{ color: tokens.textSecondary }}>
          There is no data associated with this job yet.
        </Typography>
      </Paper>
    );
  }

  const columns = [
    'storeName', 'category', 'phone', 'bizWebsite', 'address',
    'stars', 'numberOfReviews', 'companyDetails', 'searchKeyword', 'searchLocation'
  ];

  const formatColumnName = (col) => {
    const map = {
      storeName: 'Business Name',
      category: 'Category',
      phone: 'Phone',
      bizWebsite: 'Website',
      address: 'Address',
      stars: 'Rating',
      numberOfReviews: 'Reviews',
      companyDetails: 'Details',
      searchKeyword: 'Keyword',
      searchLocation: 'Location'
    };
    return map[col] || col;
  };

  const paginated = results.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
  const totalPages = Math.ceil(results.length / rowsPerPage);

  const handleDownload = () => {
    const csv = [
      columns.map(c => formatColumnName(c)).join(','),
      ...results.map(row => columns.map(col => {
        if (col === 'companyDetails' && row[col]) {
          return `"${JSON.stringify(row[col]).replace(/"/g, '""')}"`;
        }
        return `"${(row[col] || '').toString().replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk-scrape-results-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Company Details Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Company Social & Contact Details</DialogTitle>
        <DialogContent dividers>
          {selectedCompanyDetails && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {selectedCompanyDetails.description && (
                <Box>
                  <Typography variant="caption" sx={{ color: tokens.textSecondary, fontWeight: 600 }}>Description</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>{selectedCompanyDetails.description}</Typography>
                </Box>
              )}

              {selectedCompanyDetails.emails && selectedCompanyDetails.emails.length > 0 && (
                <Accordion defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <EmailIcon sx={{ fontSize: 16, color: tokens.primary }} />
                      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>Emails ({selectedCompanyDetails.emails.length})</Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                    {selectedCompanyDetails.emails.map((email, i) => (
                      <Chip key={i} label={email} size="small" variant="outlined" color="primary" />
                    ))}
                  </AccordionDetails>
                </Accordion>
              )}

              {selectedCompanyDetails.phones && selectedCompanyDetails.phones.length > 0 && (
                <Accordion defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PhoneIcon sx={{ fontSize: 16, color: tokens.primary }} />
                      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>Phones ({selectedCompanyDetails.phones.length})</Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                    {selectedCompanyDetails.phones.map((p, i) => (
                      <Chip key={i} label={p} size="small" variant="outlined" />
                    ))}
                  </AccordionDetails>
                </Accordion>
              )}

              {selectedCompanyDetails.careerPage && (
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <WorkIcon sx={{ fontSize: 16, color: tokens.primary }} />
                      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>Careers Info</Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    {selectedCompanyDetails.careerPage.url && (
                      <Button size="small" variant="outlined" startIcon={<LanguageIcon />} onClick={() => window.open(selectedCompanyDetails.careerPage.url, '_blank')} sx={{ mb: 1 }}>
                        Open Careers Page
                      </Button>
                    )}
                    {selectedCompanyDetails.careerPage.availableJobs && selectedCompanyDetails.careerPage.availableJobs.length > 0 && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                        {selectedCompanyDetails.careerPage.availableJobs.slice(0, 3).map((job, idx) => (
                          <Paper key={idx} sx={{ p: 1.5, bgcolor: '#f9fafb' }}>
                            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600 }}>{job.title}</Typography>
                            {job.description && (
                              <Typography variant="caption" sx={{ display: 'block', color: tokens.textSecondary, mt: 0.5 }}>
                                {job.description.substring(0, 120)}...
                              </Typography>
                            )}
                          </Paper>
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
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Paper sx={{ borderRadius: '12px', overflow: 'hidden' }}>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${tokens.borderLight}` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }}>Search Results</Typography>
            <Chip label={`${results.length} records`} size="small" color="success" sx={{ height: 22, fontSize: '0.6875rem' }} />
          </Box>
          <Button size="small" variant="outlined" startIcon={<DownloadIcon sx={{ fontSize: 16 }} />} onClick={handleDownload} sx={{ fontSize: '0.75rem', height: 32 }}>
            Export CSV
          </Button>
        </Box>

        <TableContainer sx={{ maxHeight: 500 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 50 }}>#</TableCell>
                {columns.map(col => <TableCell key={col}>{formatColumnName(col)}</TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {paginated.map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell sx={{ color: tokens.textMuted, fontSize: '0.75rem' }}>{page * rowsPerPage + idx + 1}</TableCell>
                  {columns.map(col => (
                    <TableCell key={col}>
                      {col === 'companyDetails' && row[col] ? (
                        <IconButton size="small" onClick={() => { setSelectedCompanyDetails(row[col]); setDetailsOpen(true); }} sx={{ bgcolor: '#f3f4f6', borderRadius: '6px' }}>
                          <InfoIcon sx={{ fontSize: 16, color: tokens.primary }} />
                        </IconButton>
                      ) : col === 'bizWebsite' && row[col] ? (
                        <Tooltip title={row[col]}>
                          <IconButton size="small" onClick={() => window.open(row[col], '_blank')} sx={{ bgcolor: '#f3f4f6', borderRadius: '6px' }}>
                            <LanguageIcon sx={{ fontSize: 16, color: tokens.primary }} />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Typography sx={{ fontSize: '0.8125rem', color: row[col] ? tokens.text : tokens.textMuted }}>
                          {row[col] || '—'}
                        </Typography>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {totalPages > 1 && (
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${tokens.borderLight}` }}>
            <Typography sx={{ fontSize: '0.8125rem', color: tokens.textSecondary }}>
              Page {page + 1} of {totalPages}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" disabled={page === 0} onClick={() => setPage(p => p - 1)} startIcon={<NavigateBeforeIcon />}>Prev</Button>
              <Button size="small" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} endIcon={<NavigateNextIcon />}>Next</Button>
            </Box>
          </Box>
        )}
      </Paper>
    </>
  );
};

export default JobResultsTable;
