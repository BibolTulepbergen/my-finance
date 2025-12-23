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
  Paper,
  BottomNavigation,
  BottomNavigationAction,
} from '@mui/material';
import {
  Menu as MenuIcon,
  AccountBalanceWallet,
  Settings,
  Receipt,
  Add as AddIcon,
  ShowChart,
} from '@mui/icons-material';
import { Capacitor } from '@capacitor/core';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AccountList } from '../components/accounts/AccountList';
import { AccountForm } from '../components/accounts/AccountForm';
import { UserSettings } from '../components/settings/UserSettings';
import { EmailVerificationBanner } from '../components/auth/EmailVerificationBanner';
import { Transactions } from './Transactions';
import { CurrencyRates } from './CurrencyRates';
import { TransactionModal } from '../components/transactions/TransactionModal';
import { accountApi } from '../lib/api';
import type { Account } from '../lib/types';

const DRAWER_WIDTH = 240;

const menuItems = [
  { path: '/', label: 'Счета', icon: <AccountBalanceWallet /> },
  { path: '/transactions', label: 'Транзакции', icon: <Receipt /> },
  { path: '/currency-rates', label: 'Курсы валют', icon: <ShowChart /> },
  { path: '/settings', label: 'Настройки', icon: <Settings /> },
];

const BOTTOM_NAV_ITEMS = [
  { value: 'accounts', label: 'Счета', icon: <AccountBalanceWallet />, path: '/' },
  { value: 'transactions', label: 'Транзакции', icon: <Receipt />, path: '/transactions' },
  { value: 'currency', label: 'Курсы', icon: <ShowChart />, path: '/currency-rates' },
  { value: 'settings', label: 'Настройки', icon: <Settings />, path: '/settings' },
] as const;
type BottomNavValue = (typeof BOTTOM_NAV_ITEMS)[number]['value'];

export function Dashboard() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isNativeApp = Capacitor.getPlatform() !== 'web';
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
  const [bottomNavValue, setBottomNavValue] = useState<BottomNavValue>(BOTTOM_NAV_ITEMS[0].value);

  useEffect(() => {
    const current = BOTTOM_NAV_ITEMS.find((item) => {
      if (item.path === '/') {
        return location.pathname === '/';
      }
      return location.pathname.startsWith(item.path);
    });
    if (current && current.value !== bottomNavValue) {
      setBottomNavValue(current.value);
    }
  }, [location.pathname, bottomNavValue]);

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
          paddingTop: isNativeApp ? 'env(safe-area-inset-top)' : 0,
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
          pt: isNativeApp ? 'calc(24px + env(safe-area-inset-top))' : 3, // дополнительное место под AppBar с safe area
          pb: isNativeApp ? 'calc(80px + env(safe-area-inset-bottom))' : 3, // дополнительное место под bottom navigation с safe area
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
            <Route path="/currency-rates" element={<CurrencyRates />} />
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
          bottom: isNativeApp ? 'calc(80px + env(safe-area-inset-bottom))' : 16, // поднять FAB над bottom navigation в приложении + safe area
          right: 16,
        }}
      >
        <AddIcon />
      </Fab>

      {isNativeApp && (
        <Paper
          elevation={3}
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <BottomNavigation
            showLabels
            value={bottomNavValue}
            onChange={(_, newValue) => {
              const target = BOTTOM_NAV_ITEMS.find((item) => item.value === newValue);
              if (target) {
                setBottomNavValue(newValue);
                handleNavigate(target.path);
              }
            }}
          >
            {BOTTOM_NAV_ITEMS.map((item) => (
              <BottomNavigationAction
                key={item.value}
                label={item.label}
                value={item.value}
                icon={item.icon}
              />
            ))}
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  );
}
