import React, { useState } from 'react';
import type { TypeComponentWithChildrenProps } from '@/functions/types/types';
import { Header } from '@/components/layout/Header/Header';
import { Footer } from '@/components/layout/Footer';

import {
  Box,
  Typography,
  Divider,
  IconButton,
  Avatar,
  Chip,
  Button,
  TextField,
  Paper,
  Tooltip,
  Badge,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { DataGrid, GridActionsCellItem } from '@mui/x-data-grid';
import { alpha, createTheme, ThemeProvider } from '@mui/material/styles';

// Icons
import DashboardIcon from '@mui/icons-material/Dashboard';
import GridViewIcon from '@mui/icons-material/GridView';
import ArticleIcon from '@mui/icons-material/Article';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import PeopleIcon from '@mui/icons-material/People';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import FavoriteIcon from '@mui/icons-material/Favorite';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import SaveIcon from '@mui/icons-material/Save';
import PreviewIcon from '@mui/icons-material/Preview';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import BlockIcon from '@mui/icons-material/Block';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import TagIcon from '@mui/icons-material/Tag';
import BrushIcon from '@mui/icons-material/Brush';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';

export const AdminLayoutTest = (props: TypeComponentWithChildrenProps) => {
  return <AdminPanel />;
  return (
    <Box>
      {/*<Header />*/}

      <Box component="main" sx={{ minHeight: 'calc(100svh - 88px)' }}>
        {props.children}
      </Box>

      {/*<Footer />*/}
    </Box>
  );
};

type NavSection = 'stats' | 'patterns' | 'faq' | 'taxonomy' | 'users';

interface StatCard {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color: string;
  trend?: string;
}

interface FaqPage {
  id: string;
  slug: string;
  title: string;
  content: string;
  updatedAt: string;
}
interface Tag {
  id: string;
  name: string;
  patternCount: number;
}
interface Author {
  id: string;
  name: string;
  patternCount: number;
}
interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  joined: string;
  favorites: number;
  done: number;
  banned: boolean;
}
interface Pattern {
  id: string;
  name: string;
  author: string;
  tags: string;
  pieces: number;
  favorites: number;
  done: number;
  difficulty: string;
  created: string;
}

const MOCK_STATS: StatCard[] = [
  { label: 'Total Users', value: '2,841', sub: '+48 this week', icon: <PeopleIcon />, color: '#7B9E8F', trend: '+12%' },
  {
    label: 'Total Patterns',
    value: '634',
    sub: '12 added this month',
    icon: <GridViewIcon />,
    color: '#C8A96E',
    trend: '+4%',
  },
  {
    label: 'Total Favorites',
    value: '18,204',
    sub: 'across all patterns',
    icon: <FavoriteIcon />,
    color: '#C0614A',
    trend: '+8%',
  },
  {
    label: 'Marked as Done',
    value: '5,917',
    sub: 'across all patterns',
    icon: <CheckCircleIcon />,
    color: '#7B9E8F',
    trend: '+15%',
  },
  {
    label: 'Unique Tags',
    value: '89',
    sub: '6 added this month',
    icon: <LocalOfferIcon />,
    color: '#C8A96E',
    trend: '+7%',
  },
  {
    label: 'Unique Authors',
    value: '143',
    sub: '9 new contributors',
    icon: <BrushIcon />,
    color: '#9A7BC8',
    trend: '+6%',
  },
];

const MOCK_TOP_PATTERNS = [
  { name: 'Cathedral Rose', favorites: 312, done: 88, difficulty: 'Advanced' },
  { name: 'Art Nouveau Iris', favorites: 287, done: 71, difficulty: 'Intermediate' },
  { name: 'Celtic Knot Panel', favorites: 241, done: 104, difficulty: 'Beginner' },
  { name: 'Peacock Feather', favorites: 198, done: 52, difficulty: 'Advanced' },
  { name: 'Sunrise Mandala', favorites: 176, done: 93, difficulty: 'Intermediate' },
];

const MOCK_PATTERNS: Pattern[] = [
  {
    id: '1',
    name: 'Cathedral Rose',
    author: 'Eleanor Voss',
    tags: 'gothic, rose',
    pieces: 84,
    favorites: 312,
    done: 88,
    difficulty: 'Advanced',
    created: '2024-03-12',
  },
  {
    id: '2',
    name: 'Art Nouveau Iris',
    author: 'Samuel Crane',
    tags: 'floral, nouveau',
    pieces: 56,
    favorites: 287,
    done: 71,
    difficulty: 'Intermediate',
    created: '2024-02-28',
  },
  {
    id: '3',
    name: 'Celtic Knot Panel',
    author: 'Fiona Marsh',
    tags: 'celtic, geometric',
    pieces: 32,
    favorites: 241,
    done: 104,
    difficulty: 'Beginner',
    created: '2024-01-15',
  },
  {
    id: '4',
    name: 'Peacock Feather',
    author: 'David Lorne',
    tags: 'nature, ornate',
    pieces: 128,
    favorites: 198,
    done: 52,
    difficulty: 'Advanced',
    created: '2024-04-01',
  },
  {
    id: '5',
    name: 'Sunrise Mandala',
    author: 'Priya Nair',
    tags: 'mandala, circular',
    pieces: 72,
    favorites: 176,
    done: 93,
    difficulty: 'Intermediate',
    created: '2024-03-22',
  },
  {
    id: '6',
    name: 'Winter Branches',
    author: 'Eleanor Voss',
    tags: 'nature, minimal',
    pieces: 28,
    favorites: 143,
    done: 67,
    difficulty: 'Beginner',
    created: '2024-02-10',
  },
  {
    id: '7',
    name: 'Dragonfly Pond',
    author: 'Samuel Crane',
    tags: 'nature, water',
    pieces: 96,
    favorites: 121,
    done: 38,
    difficulty: 'Advanced',
    created: '2024-04-18',
  },
];

const MOCK_FAQ_PAGES: FaqPage[] = [
  {
    id: '1',
    slug: 'getting-started',
    title: 'Getting Started',
    content: `# Getting Started\n\nWelcome to the stained glass pattern library! Here's everything you need to know to begin your journey.\n\n## Finding Patterns\n\nBrowse patterns by **difficulty**, **tags**, or **author** using the search and filter tools on the main page.\n\n## Downloading\n\nEach pattern page offers several export options:\n- **SVG** — the original vector file\n- **PNG / JPG** — rasterised at your chosen DPI, ideal for Cricut\n- **PDF** — for single-page large-format printing or tiled 8.5×11 assembly\n\n## Favoriting & Marking Done\n\nCreate a free account to save favorites and track which patterns you've completed.`,
    updatedAt: '2024-04-20',
  },
  {
    id: '2',
    slug: 'cutting-guide',
    title: 'Glass Cutting Guide',
    content: `# Glass Cutting Guide\n\nThis guide covers how to use our patterns for traditional glass cutting.\n\n## Printing Your Pattern\n\nWe recommend printing at **1:1 scale** on your chosen paper size. Use the tiled PDF option for patterns larger than a single sheet.\n\n## Transferring to Glass\n\nPlace the printed pattern beneath your glass and trace the lead lines with a marker before scoring.\n\n## Line Width\n\nEach pattern lists its intended **line width**, which corresponds to the lead came width. Thicker lines mean wider came channels.`,
    updatedAt: '2024-03-15',
  },
  {
    id: '3',
    slug: 'cricut-guide',
    title: 'Cricut & Vinyl Cutters',
    content: `# Using Patterns with Cricut\n\n## Recommended Export Settings\n\nFor best results with Cricut Design Space:\n\n- **Format**: PNG\n- **DPI**: 300\n- **Size**: Match your physical project dimensions exactly\n\n## Importing into Design Space\n\n1. Export your PNG at the correct physical size\n2. Upload to Cricut Design Space via **Upload → Upload Image**\n3. Set image type to **Complex** for detailed patterns\n4. Set the size to match your export dimensions — do not resize in Design Space`,
    updatedAt: '2024-04-10',
  },
];

const MOCK_TAGS: Tag[] = [
  { id: '1', name: 'gothic', patternCount: 24 },
  { id: '2', name: 'floral', patternCount: 38 },
  { id: '3', name: 'geometric', patternCount: 31 },
  { id: '4', name: 'celtic', patternCount: 17 },
  { id: '5', name: 'mandala', patternCount: 22 },
  { id: '6', name: 'nature', patternCount: 45 },
  { id: '7', name: 'art nouveau', patternCount: 19 },
  { id: '8', name: 'minimal', patternCount: 12 },
  { id: '9', name: 'circular', patternCount: 15 },
];

const MOCK_AUTHORS: Author[] = [
  { id: '1', name: 'Eleanor Voss', patternCount: 42 },
  { id: '2', name: 'Samuel Crane', patternCount: 38 },
  { id: '3', name: 'Fiona Marsh', patternCount: 27 },
  { id: '4', name: 'David Lorne', patternCount: 31 },
  { id: '5', name: 'Priya Nair', patternCount: 19 },
  { id: '6', name: 'Tomás Reyes', patternCount: 14 },
];

const MOCK_USERS: User[] = [
  {
    id: '1',
    name: 'Alice Fontaine',
    email: 'alice@example.com',
    role: 'admin',
    joined: '2023-11-01',
    favorites: 87,
    done: 23,
    banned: false,
  },
  {
    id: '2',
    name: 'Bob Mercer',
    email: 'bob@example.com',
    role: 'user',
    joined: '2024-01-14',
    favorites: 34,
    done: 8,
    banned: false,
  },
  {
    id: '3',
    name: 'Cara Singh',
    email: 'cara@example.com',
    role: 'user',
    joined: '2024-02-28',
    favorites: 121,
    done: 45,
    banned: false,
  },
  {
    id: '4',
    name: 'Dan Wu',
    email: 'dan@example.com',
    role: 'user',
    joined: '2024-03-05',
    favorites: 12,
    done: 2,
    banned: true,
  },
  {
    id: '5',
    name: 'Eva Kowalski',
    email: 'eva@example.com',
    role: 'user',
    joined: '2024-04-01',
    favorites: 56,
    done: 17,
    banned: false,
  },
];

const GoldDivider = () => <Divider sx={{ borderColor: alpha('#C8A96E', 0.15), my: 0 }} />;

const SectionHeader = ({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) => (
  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
    <Box>
      <Typography variant="h4" sx={{ fontSize: '1.8rem', lineHeight: 1.1, mb: 0.25 }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {subtitle}
        </Typography>
      )}
    </Box>
    {action}
  </Box>
);

const difficultyColor = (d: string) => {
  if (d === 'Beginner') return '#7B9E8F';
  if (d === 'Intermediate') return '#C8A96E';
  return '#C0614A';
};

const StatsSection = () => (
  <Box>
    <SectionHeader title="Dashboard" subtitle="Overview of platform activity — wire these up to your PocketBase API." />

    {/* Stat cards */}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 2, mb: 4 }}>
      {MOCK_STATS.map((stat) => (
        <Paper
          key={stat.label}
          elevation={0}
          sx={{
            bgcolor: 'background.paper',
            border: `1px solid ${alpha('#C8A96E', 0.15)}`,
            borderRadius: 1,
            p: 2.5,
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '2px',
              bgcolor: stat.color,
            },
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
            <Box sx={{ color: stat.color, opacity: 0.8, '& svg': { fontSize: '1.3rem' } }}>{stat.icon}</Box>
            {stat.trend && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <TrendingUpIcon sx={{ fontSize: '0.75rem', color: '#7B9E8F' }} />
                <Typography variant="caption" sx={{ color: '#7B9E8F', fontSize: '0.7rem' }}>
                  {stat.trend}
                </Typography>
              </Box>
            )}
          </Box>
          <Typography
            sx={{
              fontSize: '1.9rem',
              fontFamily: "'Cormorant Garamond', serif",
              fontWeight: 600,
              lineHeight: 1,
              color: stat.color,
              mb: 0.25,
            }}
          >
            {stat.value}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600, fontSize: '0.8rem', mb: 0.25 }}>
            {stat.label}
          </Typography>
          {stat.sub && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {stat.sub}
            </Typography>
          )}
        </Paper>
      ))}
    </Box>

    {/* Top patterns table */}
    <Paper
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        border: `1px solid ${alpha('#C8A96E', 0.15)}`,
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      <Box sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${alpha('#C8A96E', 0.12)}` }}>
        <Typography variant="h6" sx={{ fontSize: '1.1rem' }}>
          Top Patterns by Favorites
        </Typography>
      </Box>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>Pattern</TableCell>
              <TableCell>Difficulty</TableCell>
              <TableCell align="right">
                <FavoriteIcon sx={{ fontSize: '0.8rem', verticalAlign: 'middle', mr: 0.5 }} />
                Favorites
              </TableCell>
              <TableCell align="right">
                <CheckCircleIcon sx={{ fontSize: '0.8rem', verticalAlign: 'middle', mr: 0.5 }} />
                Done
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {MOCK_TOP_PATTERNS.map((p, i) => (
              <TableRow key={p.name}>
                <TableCell sx={{ color: 'text.secondary', width: 40 }}>{i + 1}</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.primary' }}>{p.name}</TableCell>
                <TableCell>
                  <Chip
                    label={p.difficulty}
                    size="small"
                    sx={{
                      bgcolor: alpha(difficultyColor(p.difficulty), 0.15),
                      color: difficultyColor(p.difficulty),
                      border: `1px solid ${alpha(difficultyColor(p.difficulty), 0.3)}`,
                    }}
                  />
                </TableCell>
                <TableCell align="right" sx={{ color: '#C0614A', fontWeight: 700 }}>
                  {p.favorites}
                </TableCell>
                <TableCell align="right" sx={{ color: '#7B9E8F', fontWeight: 700 }}>
                  {p.done}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  </Box>
);

const PatternsSection = () => {
  const [rows, setRows] = useState<Pattern[]>(MOCK_PATTERNS);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = rows.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.author.toLowerCase().includes(search.toLowerCase()) ||
      r.tags.toLowerCase().includes(search.toLowerCase()),
  );

  const handleDelete = (id: any) => setDeleteId(String(id));
  const confirmDelete = () => {
    setRows((r) => r.filter((p) => p.id !== deleteId));
    setDeleteId(null);
  };

  const columns: any[] = [
    { field: 'name', headerName: 'Name', flex: 2, minWidth: 180 },
    { field: 'author', headerName: 'Author', flex: 1.5, minWidth: 140 },
    {
      field: 'tags',
      headerName: 'Tags',
      flex: 1.5,
      minWidth: 140,
      // @ts-expect-error lol
      renderCell: (p) => (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', py: 0.5 }}>
          {String(p.value)
            .split(',')
            .map((t) => (
              <Chip
                key={t}
                label={t.trim()}
                size="small"
                variant="outlined"
                sx={{ borderColor: alpha('#C8A96E', 0.3), color: 'text.secondary', fontSize: '0.68rem' }}
              />
            ))}
        </Box>
      ),
    },
    { field: 'pieces', headerName: 'Pieces', width: 80, align: 'right', headerAlign: 'right' },
    {
      field: 'difficulty',
      headerName: 'Difficulty',
      width: 120,
      // @ts-expect-error lol
      renderCell: (p) => (
        <Chip
          label={String(p.value)}
          size="small"
          sx={{
            bgcolor: alpha(difficultyColor(String(p.value)), 0.15),
            color: difficultyColor(String(p.value)),
            border: `1px solid ${alpha(difficultyColor(String(p.value)), 0.3)}`,
          }}
        />
      ),
    },
    {
      field: 'favorites',
      headerName: '❤ Favs',
      width: 90,
      align: 'right',
      headerAlign: 'right',
      // @ts-expect-error lol
      renderCell: (p) => (
        <Typography sx={{ color: '#C0614A', fontWeight: 700, fontSize: '0.85rem' }}>{p.value}</Typography>
      ),
    },
    {
      field: 'done',
      headerName: '✓ Done',
      width: 90,
      align: 'right',
      headerAlign: 'right',
      // @ts-expect-error lol
      renderCell: (p) => (
        <Typography sx={{ color: '#7B9E8F', fontWeight: 700, fontSize: '0.85rem' }}>{p.value}</Typography>
      ),
    },
    {
      field: 'created',
      headerName: 'Created',
      width: 110,
      // @ts-expect-error lol
      renderCell: (p) => (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {p.value}
        </Typography>
      ),
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: '',
      width: 80,
      // @ts-expect-error lol
      getActions: ({ id }) => [
        <GridActionsCellItem
          key="edit"
          icon={<EditIcon sx={{ fontSize: '1rem' }} />}
          label="Edit"
          onClick={() => {}}
          showInMenu={false}
        />,
        <GridActionsCellItem
          key="delete"
          icon={<DeleteIcon sx={{ fontSize: '1rem', color: '#C0614A' }} />}
          label="Delete"
          onClick={() => handleDelete(id)}
          showInMenu={false}
        />,
      ],
    },
  ];

  return (
    <Box>
      <SectionHeader
        title="Patterns"
        subtitle="Manage all stained glass patterns in the library."
        action={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            sx={{ bgcolor: 'primary.main', color: '#0D0B09', fontWeight: 700, '&:hover': { bgcolor: '#DDB97E' } }}
          >
            Add Pattern
          </Button>
        }
      />

      <Box sx={{ mb: 2 }}>
        <TextField
          size="small"
          variant="outlined"
          placeholder="Search by name, author, or tag…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <SearchIcon sx={{ fontSize: '1rem', color: 'text.secondary', mr: 1 }} /> }}
          sx={{ width: 320 }}
        />
      </Box>

      <DataGrid
        rows={filtered}
        columns={columns}
        autoHeight
        rowHeight={52}
        pageSizeOptions={[10, 25, 50]}
        initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        checkboxSelection
        disableRowSelectionOnClick
        sx={{ bgcolor: 'background.paper' }}
      />

      {/* Delete confirm dialog */}
      <Dialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        PaperProps={{
          sx: {
            bgcolor: 'background.paper',
            border: `1px solid ${alpha('#C0614A', 0.3)}`,
            borderRadius: 1,
            minWidth: 340,
          },
        }}
      >
        <DialogTitle sx={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem' }}>
          Delete Pattern?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            This will permanently remove the pattern and all associated data. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setDeleteId(null)}
            variant="outlined"
            sx={{ borderColor: alpha('#C8A96E', 0.3), color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmDelete}
            variant="contained"
            sx={{ bgcolor: '#C0614A', '&:hover': { bgcolor: '#A0513A' } }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const FaqSection = () => {
  const [pages, setPages] = useState<FaqPage[]>(MOCK_FAQ_PAGES);
  const [selectedId, setSelectedId] = useState(pages[0].id);
  const [preview, setPreview] = useState(false);
  const [saved, setSaved] = useState(false);

  const selected = pages.find((p) => p.id === selectedId)!;

  const update = (field: keyof FaqPage, value: string) => {
    setPages((ps) => ps.map((p) => (p.id === selectedId ? { ...p, [field]: value } : p)));
    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  // Bare-bones markdown → HTML for preview (no external dep)
  const renderMarkdown = (md: string) =>
    md
      .replace(
        /^### (.+)$/gm,
        '<h3 style="color:#C8A96E;font-family:\'Cormorant Garamond\',serif;font-size:1.1rem;margin:1.2em 0 0.4em">$1</h3>',
      )
      .replace(
        /^## (.+)$/gm,
        '<h2 style="color:#C8A96E;font-family:\'Cormorant Garamond\',serif;font-size:1.35rem;margin:1.4em 0 0.5em">$1</h2>',
      )
      .replace(
        /^# (.+)$/gm,
        '<h1 style="color:#EDE8DF;font-family:\'Cormorant Garamond\',serif;font-size:1.7rem;margin:0 0 0.6em">$1</h1>',
      )
      .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#EDE8DF">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '<li style="margin:0.25em 0;color:#9A9084">$1</li>')
      .replace(/(<li.*<\/li>\n?)+/g, (s) => `<ul style="padding-left:1.4em;margin:0.6em 0">${s}</ul>`)
      .replace(/^(\d+)\. (.+)$/gm, '<li style="margin:0.25em 0;color:#9A9084">$2</li>')
      .replace(/\n\n/g, '</p><p style="margin:0.6em 0;color:#9A9084;line-height:1.7">')
      .replace(/^(?!<[h|u|l|p])(.+)/, '<p style="margin:0.6em 0;color:#9A9084;line-height:1.7">$1</p>');

  return (
    <Box sx={{ height: '100%' }}>
      <SectionHeader
        title="FAQ Pages"
        subtitle="Edit markdown content for help and FAQ pages."
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<PreviewIcon />}
              onClick={() => setPreview((p) => !p)}
              sx={{ borderColor: alpha('#C8A96E', 0.35), color: 'primary.main' }}
            >
              {preview ? 'Edit' : 'Preview'}
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              sx={{
                bgcolor: saved ? '#7B9E8F' : 'primary.main',
                color: '#0D0B09',
                fontWeight: 700,
                transition: 'background 0.3s',
                '&:hover': { bgcolor: '#DDB97E' },
              }}
            >
              {saved ? 'Saved!' : 'Save'}
            </Button>
          </Box>
        }
      />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '220px 1fr',
          gap: 2.5,
          height: 'calc(100vh - 220px)',
          minHeight: 500,
        }}
      >
        {/* Page list */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <Paper
            elevation={0}
            sx={{
              bgcolor: 'background.paper',
              border: `1px solid ${alpha('#C8A96E', 0.15)}`,
              borderRadius: 1,
              overflow: 'hidden',
              flex: 1,
            }}
          >
            <Box
              sx={{
                px: 2,
                py: 1.5,
                borderBottom: `1px solid ${alpha('#C8A96E', 0.12)}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Typography
                variant="caption"
                sx={{ color: 'primary.main', letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.68rem' }}
              >
                Pages
              </Typography>
              <Tooltip title="New Page">
                <IconButton size="small" sx={{ color: 'primary.main' }}>
                  <AddIcon sx={{ fontSize: '1rem' }} />
                </IconButton>
              </Tooltip>
            </Box>
            {pages.map((p) => (
              <Box
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                sx={{
                  px: 2,
                  py: 1.5,
                  cursor: 'pointer',
                  bgcolor: p.id === selectedId ? alpha('#C8A96E', 0.1) : 'transparent',
                  borderLeft: `2px solid ${p.id === selectedId ? '#C8A96E' : 'transparent'}`,
                  borderBottom: `1px solid ${alpha('#C8A96E', 0.08)}`,
                  '&:hover': { bgcolor: alpha('#C8A96E', 0.06) },
                  transition: 'all 0.15s',
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: p.id === selectedId ? 700 : 400,
                    color: p.id === selectedId ? 'primary.main' : 'text.primary',
                    fontSize: '0.85rem',
                  }}
                >
                  {p.title}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                  /{p.slug}
                </Typography>
              </Box>
            ))}
          </Paper>
        </Box>

        {/* Editor / Preview */}
        <Paper
          elevation={0}
          sx={{
            bgcolor: 'background.paper',
            border: `1px solid ${alpha('#C8A96E', 0.15)}`,
            borderRadius: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Meta bar */}
          <Box
            sx={{
              px: 2.5,
              py: 1.5,
              borderBottom: `1px solid ${alpha('#C8A96E', 0.12)}`,
              display: 'flex',
              gap: 2,
              alignItems: 'center',
            }}
          >
            <TextField
              size="small"
              variant="standard"
              value={selected.title}
              onChange={(e) => update('title', e.target.value)}
              InputProps={{
                disableUnderline: false,
                sx: {
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: 'text.primary',
                  '&:before': { borderColor: alpha('#C8A96E', 0.2) },
                  '&:after': { borderColor: '#C8A96E' },
                },
              }}
              sx={{ flex: 1 }}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              /{selected.slug}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
              Updated {selected.updatedAt}
            </Typography>
          </Box>

          {/* Content area */}
          {preview ? (
            <Box
              sx={{ flex: 1, p: 3, overflowY: 'auto' }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(selected.content) }}
            />
          ) : (
            <TextField
              multiline
              fullWidth
              variant="standard"
              value={selected.content}
              onChange={(e) => update('content', e.target.value)}
              InputProps={{
                disableUnderline: true,
                sx: {
                  flex: 1,
                  fontFamily: "'Courier New', monospace",
                  fontSize: '0.85rem',
                  color: 'text.primary',
                  lineHeight: 1.7,
                  px: 2.5,
                  py: 2,
                  alignItems: 'flex-start',
                  '& textarea': { resize: 'none' },
                },
              }}
              sx={{ flex: 1, display: 'flex', '& .MuiInputBase-root': { height: '100%', alignItems: 'flex-start' } }}
            />
          )}
        </Paper>
      </Box>
    </Box>
  );
};

const TaxonomySection = () => {
  const [tab, setTab] = useState(0);
  const [tags, setTags] = useState<Tag[]>(MOCK_TAGS);
  const [authors, setAuthors] = useState<Author[]>(MOCK_AUTHORS);
  const [newTag, setNewTag] = useState('');
  const [newAuthor, setNewAuthor] = useState('');

  const addTag = () => {
    if (!newTag.trim()) return;
    setTags((t) => [...t, { id: String(Date.now()), name: newTag.trim().toLowerCase(), patternCount: 0 }]);
    setNewTag('');
  };
  const deleteTag = (id: string) => setTags((t) => t.filter((x) => x.id !== id));

  const addAuthor = () => {
    if (!newAuthor.trim()) return;
    setAuthors((a) => [...a, { id: String(Date.now()), name: newAuthor.trim(), patternCount: 0 }]);
    setNewAuthor('');
  };
  const deleteAuthor = (id: string) => setAuthors((a) => a.filter((x) => x.id !== id));

  return (
    <Box>
      <SectionHeader title="Tags & Authors" subtitle="Manage the taxonomy used to organise patterns." />

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          mb: 3,
          borderBottom: `1px solid ${alpha('#C8A96E', 0.15)}`,
          '& .MuiTab-root': {
            textTransform: 'none',
            fontFamily: "'Lato', sans-serif",
            color: 'text.secondary',
            minWidth: 120,
          },
          '& .Mui-selected': { color: 'primary.main !important' },
          '& .MuiTabs-indicator': { bgcolor: 'primary.main' },
        }}
      >
        <Tab icon={<TagIcon sx={{ fontSize: '1rem' }} />} iconPosition="start" label={`Tags (${tags.length})`} />
        <Tab
          icon={<BrushIcon sx={{ fontSize: '1rem' }} />}
          iconPosition="start"
          label={`Authors (${authors.length})`}
        />
      </Tabs>

      {tab === 0 && (
        <Box>
          <Box sx={{ display: 'flex', gap: 1.5, mb: 3 }}>
            <TextField
              size="small"
              variant="outlined"
              placeholder="New tag name…"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTag()}
              sx={{ width: 260 }}
            />
            <Button
              variant="contained"
              onClick={addTag}
              startIcon={<AddIcon />}
              sx={{ bgcolor: 'primary.main', color: '#0D0B09', fontWeight: 700, '&:hover': { bgcolor: '#DDB97E' } }}
            >
              Add Tag
            </Button>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            {tags
              .sort((a, b) => b.patternCount - a.patternCount)
              .map((tag) => (
                <Paper
                  key={tag.id}
                  elevation={0}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 1.5,
                    py: 1,
                    bgcolor: 'background.paper',
                    border: `1px solid ${alpha('#C8A96E', 0.2)}`,
                    borderRadius: 1,
                  }}
                >
                  <TagIcon sx={{ fontSize: '0.85rem', color: 'primary.main' }} />
                  <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>
                    {tag.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 24 }}>
                    {tag.patternCount}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => deleteTag(tag.id)}
                    sx={{ color: alpha('#C0614A', 0.6), p: 0.25, '&:hover': { color: '#C0614A' } }}
                  >
                    <CloseIcon sx={{ fontSize: '0.85rem' }} />
                  </IconButton>
                </Paper>
              ))}
          </Box>
        </Box>
      )}

      {tab === 1 && (
        <Box>
          <Box sx={{ display: 'flex', gap: 1.5, mb: 3 }}>
            <TextField
              size="small"
              variant="outlined"
              placeholder="New author name…"
              value={newAuthor}
              onChange={(e) => setNewAuthor(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addAuthor()}
              sx={{ width: 260 }}
            />
            <Button
              variant="contained"
              onClick={addAuthor}
              startIcon={<AddIcon />}
              sx={{ bgcolor: 'primary.main', color: '#0D0B09', fontWeight: 700, '&:hover': { bgcolor: '#DDB97E' } }}
            >
              Add Author
            </Button>
          </Box>
          <TableContainer
            component={Paper}
            elevation={0}
            sx={{ bgcolor: 'background.paper', border: `1px solid ${alpha('#C8A96E', 0.15)}`, borderRadius: 1 }}
          >
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Author</TableCell>
                  <TableCell align="right">Patterns</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {authors
                  .sort((a, b) => b.patternCount - a.patternCount)
                  .map((author) => (
                    <TableRow key={author.id}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar
                            sx={{
                              width: 28,
                              height: 28,
                              bgcolor: alpha('#C8A96E', 0.2),
                              color: 'primary.main',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                            }}
                          >
                            {author.name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')}
                          </Avatar>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {author.name}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          label={author.patternCount}
                          size="small"
                          sx={{ bgcolor: alpha('#C8A96E', 0.12), color: 'primary.main', fontSize: '0.75rem' }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                          <IconButton
                            size="small"
                            sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                          >
                            <EditIcon sx={{ fontSize: '0.9rem' }} />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => deleteAuthor(author.id)}
                            sx={{ color: 'text.secondary', '&:hover': { color: '#C0614A' } }}
                          >
                            <DeleteIcon sx={{ fontSize: '0.9rem' }} />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Box>
  );
};

const UsersSection = () => {
  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all');

  const filtered = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const toggleBan = (id: string) => setUsers((us) => us.map((u) => (u.id === id ? { ...u, banned: !u.banned } : u)));
  const toggleRole = (id: string) =>
    setUsers((us) => us.map((u) => (u.id === id ? { ...u, role: u.role === 'admin' ? 'user' : 'admin' } : u)));

  return (
    <Box>
      <SectionHeader
        title="Users"
        subtitle="Manage accounts, roles, and access control."
        action={
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            sx={{ bgcolor: 'primary.main', color: '#0D0B09', fontWeight: 700, '&:hover': { bgcolor: '#DDB97E' } }}
          >
            Invite User
          </Button>
        }
      />

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          variant="outlined"
          placeholder="Search users…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <SearchIcon sx={{ fontSize: '1rem', color: 'text.secondary', mr: 1 }} /> }}
          sx={{ width: 280 }}
        />
        <FormControl size="small" variant="outlined" sx={{ minWidth: 140 }}>
          <InputLabel sx={{ color: 'text.secondary' }}>Role</InputLabel>
          <Select
            value={roleFilter}
            label="Role"
            onChange={(e: any) => setRoleFilter(e.target.value as typeof roleFilter)}
            sx={{ '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha('#C8A96E', 0.25) } }}
          >
            <MenuItem value="all">All Roles</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
            <MenuItem value="user">User</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <TableContainer
        component={Paper}
        elevation={0}
        sx={{ bgcolor: 'background.paper', border: `1px solid ${alpha('#C8A96E', 0.15)}`, borderRadius: 1 }}
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Joined</TableCell>
              <TableCell align="right">❤ Favs</TableCell>
              <TableCell align="right">✓ Done</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((user) => (
              <TableRow key={user.id} sx={{ opacity: user.banned ? 0.55 : 1 }}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar
                      sx={{
                        width: 32,
                        height: 32,
                        bgcolor: user.role === 'admin' ? alpha('#C8A96E', 0.25) : alpha('#7B9E8F', 0.2),
                        color: user.role === 'admin' ? 'primary.main' : 'secondary.main',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}
                    >
                      {user.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                        {user.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {user.email}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    label={user.role}
                    size="small"
                    sx={{
                      bgcolor: user.role === 'admin' ? alpha('#C8A96E', 0.15) : alpha('#7B9E8F', 0.12),
                      color: user.role === 'admin' ? 'primary.main' : 'secondary.main',
                      border: `1px solid ${user.role === 'admin' ? alpha('#C8A96E', 0.3) : alpha('#7B9E8F', 0.3)}`,
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {user.joined}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ color: '#C0614A', fontWeight: 700, fontSize: '0.85rem' }}>
                  {user.favorites}
                </TableCell>
                <TableCell align="right" sx={{ color: '#7B9E8F', fontWeight: 700, fontSize: '0.85rem' }}>
                  {user.done}
                </TableCell>
                <TableCell>
                  {user.banned ? (
                    <Chip
                      label="Banned"
                      size="small"
                      sx={{
                        bgcolor: alpha('#C0614A', 0.15),
                        color: '#C0614A',
                        border: `1px solid ${alpha('#C0614A', 0.3)}`,
                      }}
                    />
                  ) : (
                    <Chip
                      label="Active"
                      size="small"
                      sx={{
                        bgcolor: alpha('#7B9E8F', 0.12),
                        color: '#7B9E8F',
                        border: `1px solid ${alpha('#7B9E8F', 0.3)}`,
                      }}
                    />
                  )}
                </TableCell>
                <TableCell align="right">
                  <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                    <Tooltip title={user.role === 'admin' ? 'Remove Admin' : 'Make Admin'}>
                      <IconButton
                        size="small"
                        onClick={() => toggleRole(user.id)}
                        sx={{
                          color: user.role === 'admin' ? 'primary.main' : 'text.secondary',
                          '&:hover': { color: 'primary.main' },
                        }}
                      >
                        <VerifiedUserIcon sx={{ fontSize: '0.95rem' }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={user.banned ? 'Unban User' : 'Ban User'}>
                      <IconButton
                        size="small"
                        onClick={() => toggleBan(user.id)}
                        sx={{
                          color: user.banned ? '#7B9E8F' : 'text.secondary',
                          '&:hover': { color: user.banned ? '#7B9E8F' : '#C0614A' },
                        }}
                      >
                        <BlockIcon sx={{ fontSize: '0.95rem' }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

const SIDEBAR_WIDTH = 228;
const SIDEBAR_COLLAPSED = 64;

interface NavItem {
  id: NavSection;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'stats', label: 'Dashboard', icon: <DashboardIcon /> },
  { id: 'patterns', label: 'Patterns', icon: <GridViewIcon />, badge: 7 },
  { id: 'faq', label: 'FAQ Pages', icon: <ArticleIcon />, badge: 3 },
  { id: 'taxonomy', label: 'Tags & Authors', icon: <LocalOfferIcon /> },
  { id: 'users', label: 'Users', icon: <PeopleIcon />, badge: 5 },
];

// Root Layout

const AdminPanel = () => {
  const [section, setSection] = useState<NavSection>('stats');
  const [collapsed, setCollapsed] = useState(false);

  const sideW = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_WIDTH;

  const sectionMap: Record<NavSection, React.ReactNode> = {
    stats: <StatsSection />,
    patterns: <PatternsSection />,
    faq: <FaqSection />,
    taxonomy: <TaxonomySection />,
    users: <UsersSection />,
  };

  return (
    <>
      <Box sx={{ display: 'flex', height: '100vh', bgcolor: 'background.default', overflow: 'hidden' }}>
        {/* Sidebar */}
        <Box
          sx={{
            width: sideW,
            flexShrink: 0,
            height: '100vh',
            bgcolor: 'background.paper',
            borderRight: `1px solid ${alpha('#C8A96E', 0.15)}`,
            display: 'flex',
            flexDirection: 'column',
            transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
            overflow: 'hidden',
            position: 'relative',
            zIndex: 10,
          }}
        >
          {/* Logo / header */}
          <Box
            sx={{
              px: collapsed ? 1.5 : 2.5,
              py: 2.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'space-between',
              minHeight: 64,
              borderBottom: `1px solid ${alpha('#C8A96E', 0.12)}`,
            }}
          >
            {!collapsed && (
              <Box>
                <Typography
                  sx={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: '1.15rem',
                    fontWeight: 600,
                    color: 'primary.main',
                    lineHeight: 1,
                  }}
                >
                  Stained Glass
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    fontSize: '0.62rem',
                  }}
                >
                  Admin Panel
                </Typography>
              </Box>
            )}
            <IconButton
              size="small"
              onClick={() => setCollapsed((c) => !c)}
              sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
            >
              {collapsed ? <MenuIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
            </IconButton>
          </Box>

          {/* Nav items */}
          <Box sx={{ flex: 1, py: 1.5, overflowY: 'auto', overflowX: 'hidden' }}>
            {NAV_ITEMS.map((item) => {
              const active = section === item.id;
              return (
                <Tooltip key={item.id} title={collapsed ? item.label : ''} placement="right">
                  <Box
                    onClick={() => setSection(item.id)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      px: collapsed ? 0 : 2.5,
                      py: 1.25,
                      mx: 1,
                      borderRadius: 1,
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      cursor: 'pointer',
                      bgcolor: active ? alpha('#C8A96E', 0.12) : 'transparent',
                      borderLeft: active && !collapsed ? `2px solid #C8A96E` : '2px solid transparent',
                      color: active ? 'primary.main' : 'text.secondary',
                      transition: 'all 0.15s',
                      '&:hover': { bgcolor: alpha('#C8A96E', 0.07), color: active ? 'primary.main' : 'text.primary' },
                      '& svg': { fontSize: '1.2rem', flexShrink: 0 },
                    }}
                  >
                    {item.badge ? (
                      <Badge
                        badgeContent={item.badge}
                        sx={{
                          '& .MuiBadge-badge': {
                            bgcolor: alpha('#C8A96E', 0.85),
                            color: '#0D0B09',
                            fontSize: '0.6rem',
                            minWidth: 16,
                            height: 16,
                          },
                        }}
                      >
                        {item.icon}
                      </Badge>
                    ) : (
                      item.icon
                    )}
                    {!collapsed && (
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: active ? 700 : 400,
                          fontSize: '0.875rem',
                          whiteSpace: 'nowrap',
                          transition: 'opacity 0.15s',
                          opacity: collapsed ? 0 : 1,
                        }}
                      >
                        {item.label}
                      </Typography>
                    )}
                  </Box>
                </Tooltip>
              );
            })}
          </Box>

          {/* Bottom user chip */}
          <GoldDivider />
          <Box
            sx={{
              px: collapsed ? 1 : 2,
              py: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}
          >
            <Avatar
              sx={{
                width: 30,
                height: 30,
                bgcolor: alpha('#C8A96E', 0.2),
                color: 'primary.main',
                fontSize: '0.75rem',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              AF
            </Avatar>
            {!collapsed && (
              <Box sx={{ overflow: 'hidden' }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  Alice Fontaine
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: 'primary.main', fontSize: '0.67rem', letterSpacing: '0.08em' }}
                >
                  ADMIN
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* Main content */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Top bar */}
          <Box
            sx={{
              height: 56,
              borderBottom: `1px solid ${alpha('#C8A96E', 0.12)}`,
              display: 'flex',
              alignItems: 'center',
              px: 3,
              gap: 2,
              bgcolor: alpha('#161310', 0.8),
              backdropFilter: 'blur(8px)',
              flexShrink: 0,
            }}
          >
            <Typography sx={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem', color: 'text.secondary' }}>
              {NAV_ITEMS.find((n) => n.id === section)?.label}
            </Typography>
          </Box>

          {/* Scrollable content */}
          <Box sx={{ flex: 1, overflowY: 'auto', p: { xs: 2, md: 3.5 } }}>{sectionMap[section]}</Box>
        </Box>
      </Box>
    </>
  );
};
