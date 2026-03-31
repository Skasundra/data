import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
  LinearProgress,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import {
  CloudUpload,
  FileDownload,
  LinkedIn,
  Language,
  CheckCircle,
  Error,
  Info,
  Business,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import api from '../services/api';

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

const LinkedInScraper = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const allowedTypes = ['.csv', '.xlsx', '.xls'];
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      
      if (allowedTypes.includes(fileExtension)) {
        setSelectedFile(file);
        setError('');
        setResults([]);
        setMetadata(null);
        setSuccess('');
      } else {
        setError('Please select a CSV or Excel file (.csv, .xlsx, .xls)');
        setSelectedFile(null);
      }
    }
  };

  const handleUploadAndScrape = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await api.post('/scrape-linkedin', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 300000, // 5 minutes timeout
      });

      if (response.data.status === 200) {
        setResults(response.data.data);
        setMetadata(response.data.metadata);
        setSuccess(`Successfully processed ${response.data.metadata.processedUrls} LinkedIn URLs. Found ${response.data.metadata.websitesFound} company websites.`);
      } else {
        setError(response.data.message || 'Failed to process file');
      }
    } catch (err) {
      console.error('LinkedIn scraping error:', err);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.code === 'ECONNABORTED') {
        setError('Request timeout. The file might be too large or contain too many URLs.');
      } else {
        setError('Failed to process LinkedIn URLs. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    if (results.length === 0) return;

    const headers = [
      'Row Index',
      'LinkedIn URL',
      'Company Name',
      'Website',
      'Industry',
      'Location',
      'Employees',
      'Success',
      'Error',
      'Scraped At'
    ];

    const csvContent = [
      headers.join(','),
      ...results.map(result => [
        result.rowIndex || '',
        `"${result.linkedinUrl || ''}"`,
        `"${result.companyName || ''}"`,
        `"${result.website || ''}"`,
        `"${result.industry || ''}"`,
        `"${result.location || ''}"`,
        `"${result.employees || ''}"`,
        result.success ? 'Yes' : 'No',
        `"${result.error || ''}"`,
        result.scrapedAt || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `linkedin_websites_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusColor = (success, website) => {
    if (!success) return 'error';
    if (website) return 'success';
    return 'warning';
  };

  const getStatusText = (success, website, error) => {
    if (!success) return error || 'Failed';
    if (website) return 'Website Found';
    return 'No Website';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <LinkedIn sx={{ fontSize: 40, color: '#0077b5', mr: 2 }} />
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              LinkedIn Company Website Scraper
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Upload a CSV or Excel file with LinkedIn company profile URLs to extract their website URLs
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* File Upload Section */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Step 1: Upload Your File
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Upload a CSV or Excel file containing LinkedIn company profile URLs. The file should have a column with LinkedIn URLs (e.g., https://linkedin.com/company/example).
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Button
              component="label"
              variant="outlined"
              startIcon={<CloudUpload />}
              disabled={loading}
            >
              Choose File
              <VisuallyHiddenInput
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
              />
            </Button>
            
            {selectedFile && (
              <Chip
                label={`${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)`}
                color="primary"
                variant="outlined"
              />
            )}
          </Box>

          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>File Requirements:</strong>
              <br />• Supported formats: CSV, Excel (.xlsx, .xls)
              <br />• Maximum file size: 10MB
              <br />• Should contain LinkedIn company profile URLs
              <br />• Common column names: url, linkedin_url, company_url, link, linkedin, profile_url
            </Typography>
          </Alert>
        </Box>

        {/* Action Button */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Step 2: Start Scraping
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={handleUploadAndScrape}
            disabled={!selectedFile || loading}
            startIcon={loading ? <CircularProgress size={20} /> : <Business />}
            sx={{ minWidth: 200 }}
          >
            {loading ? 'Processing...' : 'Extract Websites'}
          </Button>
        </Box>

        {/* Progress Bar */}
        {loading && (
          <Box sx={{ mb: 4 }}>
            <Typography variant="body2" gutterBottom>
              Scraping LinkedIn pages... This may take several minutes.
            </Typography>
            <LinearProgress />
          </Box>
        )}

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Success Alert */}
        {success && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
            {success}
          </Alert>
        )}

        {/* Results Section */}
        {metadata && (
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              Scraping Results
            </Typography>
            
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Total URLs
                    </Typography>
                    <Typography variant="h4">
                      {metadata.processedUrls}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Websites Found
                    </Typography>
                    <Typography variant="h4" color="success.main">
                      {metadata.websitesFound}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Success Rate
                    </Typography>
                    <Typography variant="h4" color="primary.main">
                      {Math.round((metadata.successfulScrapes / metadata.processedUrls) * 100)}%
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Execution Time
                    </Typography>
                    <Typography variant="h4">
                      {metadata.executionTimeSeconds}s
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Extracted Data ({results.length} records)
              </Typography>
              <Button
                variant="contained"
                startIcon={<FileDownload />}
                onClick={downloadCSV}
                disabled={results.length === 0}
              >
                Download CSV
              </Button>
            </Box>
          </Box>
        )}

        {/* Results List */}
        {results.length > 0 && (
          <Paper variant="outlined" sx={{ maxHeight: 600, overflow: 'auto' }}>
            <List>
              {results.map((result, index) => (
                <ListItem key={index} divider>
                  <ListItemIcon>
                    {result.success ? (
                      result.website ? (
                        <CheckCircle color="success" />
                      ) : (
                        <Info color="warning" />
                      )
                    ) : (
                      <Error color="error" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="subtitle1" component="span">
                          {result.companyName || 'Unknown Company'}
                        </Typography>
                        <Chip
                          size="small"
                          label={getStatusText(result.success, result.website, result.error)}
                          color={getStatusColor(result.success, result.website)}
                          variant="outlined"
                        />
                        {result.rowIndex && (
                          <Chip
                            size="small"
                            label={`Row ${result.rowIndex}`}
                            variant="outlined"
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          <LinkedIn sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                          <a href={result.linkedinUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                            {result.linkedinUrl}
                          </a>
                        </Typography>
                        {result.website && (
                          <Typography variant="body2" color="primary.main">
                            <Language sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                            <a href={result.website} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                              {result.website}
                            </a>
                          </Typography>
                        )}
                        {result.industry && (
                          <Typography variant="body2" color="text.secondary">
                            Industry: {result.industry}
                          </Typography>
                        )}
                        {result.location && (
                          <Typography variant="body2" color="text.secondary">
                            Location: {result.location}
                          </Typography>
                        )}
                        {result.error && (
                          <Typography variant="body2" color="error.main">
                            Error: {result.error}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        )}

        {/* Instructions */}
        {results.length === 0 && !loading && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="h6" gutterBottom>
              How to Use:
            </Typography>
            <List>
              <ListItem>
                <ListItemIcon>
                  <Typography variant="h6" color="primary">1</Typography>
                </ListItemIcon>
                <ListItemText primary="Prepare a CSV or Excel file with LinkedIn company profile URLs" />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <Typography variant="h6" color="primary">2</Typography>
                </ListItemIcon>
                <ListItemText primary="Upload the file using the 'Choose File' button" />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <Typography variant="h6" color="primary">3</Typography>
                </ListItemIcon>
                <ListItemText primary="Click 'Extract Websites' to start scraping" />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <Typography variant="h6" color="primary">4</Typography>
                </ListItemIcon>
                <ListItemText primary="Download the results as CSV when complete" />
              </ListItem>
            </List>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default LinkedInScraper;