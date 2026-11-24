import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Box, Typography } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { finishIbercivisAccountSignIn } from '../services/ibercivisAccount';
import { AuthShell } from '../components/ui/AuthShell';
import { Banner } from '../components/ui/Banner';
import { MONO } from '../theme/theme';
import { darkTokens as T } from '../theme/tokens';

/**
 * Where the Ibercivis sign-in service sends the person back to.
 *
 * It reads the code out of the address, hands it to the API, and lands on the
 * map signed in. Three things can go wrong instead: the person declined at the
 * service, the answer is not the one this browser asked for, or the API refuses
 * the arrival -- `AuthContext.loginWithIbercivis` says which refusal is which.
 */
const IbercivisAccountCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation(['auth']);
  const { loginWithIbercivis, error } = useAuth();
  const [failed, setFailed] = useState(false);
  // The code and its verifier are good once, and StrictMode runs effects twice.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const code = await finishIbercivisAccountSignIn(new URL(window.location.href));
        await loginWithIbercivis(code);
        navigate('/', { replace: true });
      } catch {
        setFailed(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthShell
      kicker={t('auth:ibercivis.kicker')}
      title={t('auth:ibercivis.title')}
      footer={<Link to="/login">{t('auth:ibercivis.backToSignIn')}</Link>}
    >
      {failed ? (
        <Banner variant="danger" title={t('auth:ibercivis.errorTitle')}>
          {error || t('auth:ibercivis.failed')}
        </Banner>
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontFamily: MONO, fontSize: 12, color: T.textMid }}>
            {t('auth:ibercivis.signingIn')}
          </Typography>
        </Box>
      )}
    </AuthShell>
  );
};

export default IbercivisAccountCallbackPage;
