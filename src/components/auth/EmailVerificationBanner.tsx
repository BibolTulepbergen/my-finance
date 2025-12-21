import React from 'react';
import { Alert, Button } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';

export function EmailVerificationBanner() {
  const { user, sendVerificationEmail } = useAuth();
  const [sent, setSent] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  if (!user || user.emailVerified) {
    return null;
  }

  const handleSend = async () => {
    setLoading(true);
    try {
      await sendVerificationEmail();
      setSent(true);
    } catch (error) {
      console.error('Failed to send verification email:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Alert
      severity="warning"
      sx={{ mb: 2 }}
      action={
        <Button color="inherit" size="small" onClick={handleSend} disabled={loading || sent}>
          {sent ? 'Отправлено' : 'Отправить письмо'}
        </Button>
      }
    >
      Пожалуйста, подтвердите ваш email адрес
    </Alert>
  );
}
