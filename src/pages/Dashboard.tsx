import { useState, useEffect } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Container,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  useMediaQuery,
  useTheme,
  Fab,
} from '@mui/material';
import {
  Menu as MenuIcon,
  AccountBalanceWallet,
  Settings,
  Receipt,
  Add as AddIcon,
} from '@mui/icons-material';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AccountList } from '../components/accounts/AccountList';
import { AccountForm } from '../components/accounts/AccountForm';
import { UserSettings } from '../components/settings/UserSettings';
import { EmailVerificationBanner } from '../components/auth/EmailVerificationBanner';
import { Transactions } from './Transactions';
import { TransactionModal } from '../components/transactions/TransactionModal';
import { accountApi } from '../lib/api';
import type { Account } from '../lib/types';

const DRAWER_WIDTH = 240;

const menuItems = [
  { path: '/', label: 'Счета', icon: <AccountBalanceWallet /> },
  { path: '/transactions', label: 'Транзакции', icon: <Receipt /> },
  { path: '/settings', label: 'Настройки', icon: <Settings /> },
];

export function Dashboard() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountFormOpen, setAccountFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const navigate = useNavigate();
  const location = useLocation();

  // Load accounts on mount
  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const { accounts: data } = await accountApi.getAll();
      setAccounts(data);
    } catch (err) {
      console.error('Failed to load accounts:', err);
    }
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const handleAddAccount = () => {
    setEditingAccount(null);
    setAccountFormOpen(true);
  };

  const handleEditAccount = (account: any) => {
    setEditingAccount(account);
    setAccountFormOpen(true);
  };

  const handleAccountFormClose = () => {
    setAccountFormOpen(false);
    setEditingAccount(null);
  };

  const [refreshKey, setRefreshKey] = useState(0);

  const handleAccountFormSuccess = () => {
    setRefreshKey(prev => prev + 1);
    loadAccounts();
  };

  const handleTransactionSuccess = () => {
    setRefreshKey(prev => prev + 1);
    loadAccounts();
  };

  const drawer = (
    <Box>
      <Toolbar>
        <Typography variant="h6" noWrap>
          My Finance
        </Typography>
      </Toolbar>
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => handleNavigate(item.path)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { sm: `${DRAWER_WIDTH}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div">
            Финансовый трекер
          </Typography>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
        }}
      >
        <Toolbar />
        <Container maxWidth="lg">
          <EmailVerificationBanner />
          <Routes>
            <Route
              path="/"
              element={
                <AccountList
                  key={refreshKey}
                  onEdit={handleEditAccount}
                  onAdd={handleAddAccount}
                />
              }
            />
            <Route path="/transactions" element={<Transactions key={refreshKey} />} />
            <Route path="/settings" element={<UserSettings />} />
          </Routes>
        </Container>
      </Box>

      <AccountForm
        open={accountFormOpen}
        onClose={handleAccountFormClose}
        onSuccess={handleAccountFormSuccess}
        account={editingAccount}
      />

      <TransactionModal
        open={transactionModalOpen}
        onClose={() => setTransactionModalOpen(false)}
        onSuccess={handleTransactionSuccess}
        accounts={accounts}
      />

      <Fab
        color="primary"
        aria-label="add transaction"
        onClick={() => setTransactionModalOpen(true)}
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
        }}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
}
