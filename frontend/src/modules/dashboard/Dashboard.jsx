import { useNavigate } from 'react-router-dom';
import { Box, Typography, Paper, Grid, Chip, IconButton, Tooltip } from '@mui/material';
import * as Icons from '@mui/icons-material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import StorageIcon from '@mui/icons-material/Storage';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SpeedIcon from '@mui/icons-material/Speed';
import { scraperCategories } from '../../config/scrapers';
import { tokens } from '../../theme/theme';

const StatCard = ({ icon: Icon, label, value, subtitle, color }) => (
  <Paper sx={{
    p: 2.5, display: 'flex', alignItems: 'flex-start', gap: 2,
    borderRadius: '12px', transition: 'all 0.2s',
    '&:hover': { borderColor: `${color}40`, boxShadow: `0 4px 16px ${color}12` },
  }}>
    <Box sx={{
      width: 42, height: 42, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: `${color}12`, color: color,
    }}>
      <Icon sx={{ fontSize: 22 }} />
    </Box>
    <Box sx={{ flex: 1 }}>
      <Typography sx={{ fontSize: '0.75rem', fontWeight: 500, color: tokens.textSecondary, mb: 0.3 }}>{label}</Typography>
      <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: tokens.text, lineHeight: 1.2 }}>{value}</Typography>
      {subtitle && <Typography sx={{ fontSize: '0.6875rem', color: tokens.textMuted, mt: 0.3 }}>{subtitle}</Typography>}
    </Box>
  </Paper>
);

const SourceCard = ({ item, onClick }) => {
  const getIcon = (iconName) => {
    const Ic = Icons[iconName];
    return Ic ? <Ic sx={{ fontSize: 20 }} /> : <Icons.Circle sx={{ fontSize: 20 }} />;
  };

  return (
    <Paper
      onClick={onClick}
      sx={{
        p: 2.5, cursor: 'pointer', borderRadius: '12px', transition: 'all 0.2s',
        display: 'flex', flexDirection: 'column', gap: 1.5,
        '&:hover': {
          borderColor: `${item.color || tokens.primary}35`,
          transform: 'translateY(-2px)',
          boxShadow: `0 8px 24px ${item.color || tokens.primary}10`,
          '& .arrow-icon': { opacity: 1, transform: 'translateX(0)' },
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box sx={{
          width: 40, height: 40, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: `${item.color || tokens.primary}10`, color: item.color || tokens.primary,
        }}>
          {getIcon(item.icon)}
        </Box>
        <ArrowForwardIcon className="arrow-icon" sx={{
          fontSize: 16, color: tokens.textMuted, opacity: 0,
          transform: 'translateX(-4px)', transition: 'all 0.2s',
        }} />
      </Box>
      <Box>
        <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: tokens.text, mb: 0.3 }}>{item.name}</Typography>
        <Typography sx={{ fontSize: '0.75rem', color: tokens.textSecondary, lineHeight: 1.4 }}>{item.description}</Typography>
      </Box>
    </Paper>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();

  const allSources = scraperCategories.flatMap(c => c.items).filter(s => s.id !== 'dashboard');
  const scraperCount = allSources.length;

  return (
    <Box className="animate-fade-in" sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* ── Welcome ── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h2" sx={{ mb: 0.5 }}>Welcome back 👋</Typography>
          <Typography sx={{ fontSize: '0.9375rem', color: tokens.textSecondary }}>
            Your lead generation dashboard — scrape, enrich, and export business data from multiple sources.
          </Typography>
        </Box>
      </Box>

      {/* ── Stats ── */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard icon={StorageIcon} label="Data Sources" value={scraperCount} subtitle="Active scrapers" color={tokens.primary} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard icon={TrendingUpIcon} label="Categories" value="7" subtitle="Source categories" color={tokens.success} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard icon={SpeedIcon} label="Modules" value="11" subtitle="Total modules" color={tokens.warning} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard icon={AccessTimeIcon} label="Status" value="Active" subtitle="All systems operational" color="#06b6d4" />
        </Grid>
      </Grid>

      {/* ── Quick Access by Category ── */}
      {scraperCategories.filter(c => c.id !== 'dashboard').map((cat) => (
        <Box key={cat.id}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: tokens.text }}>{cat.label}</Typography>
            <Chip label={cat.items.length} size="small" sx={{
              height: 20, fontSize: '0.6875rem', fontWeight: 600,
              bgcolor: '#f3f4f6', color: tokens.textSecondary, borderRadius: '5px',
            }} />
          </Box>
          <Grid container spacing={2}>
            {cat.items.map((item) => (
              <Grid key={item.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                <SourceCard item={item} onClick={() => navigate(item.route)} />
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}

      {/* ── Getting started tip ── */}
      <Paper sx={{
        p: 3, borderRadius: '12px', display: 'flex', alignItems: 'center', gap: 2.5,
        background: `linear-gradient(135deg, ${tokens.primary}08 0%, ${tokens.primaryLight}04 100%)`,
        borderColor: `${tokens.primary}18`,
      }}>
        <Box sx={{
          width: 44, height: 44, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: `${tokens.primary}15`, color: tokens.primary, flexShrink: 0,
        }}>
          <Icons.Lightbulb sx={{ fontSize: 22 }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: tokens.text, mb: 0.3 }}>
            Getting Started
          </Typography>
          <Typography sx={{ fontSize: '0.8125rem', color: tokens.textSecondary, lineHeight: 1.5 }}>
            Select any data source from the sidebar to begin scraping. Start with a small batch (10–20 results) to test, then scale up.
            Use the <strong>JSON → CSV</strong> tool to convert and filter your exported data.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default Dashboard;
