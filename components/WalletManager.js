import React, { useCallback } from 'react';
import useMaker from '../hooks/useMaker';
import IconButton from '../components/IconButton';
import { Grid } from '@makerdao/ui-components-core';
import BrowserProviderButton from '../components/BrowserProviderButton';
import Trezor from '../assets/icons/trezor.svg';
import Ledger from '../assets/icons/ledger.svg';
import walletConnect from '../assets/icons/walletConnect.svg';
import walletLink from '../assets/icons/wallet-link.svg';
import { BrowserView } from 'react-device-detect';

import Router from 'next/router';
import lang from '../languages';
import { useLedger, useTrezor } from '../hooks/useHardwareWallet';
import { connectBrowserProvider } from '../maker';

function WalletManager({ providerName }) {
  const { maker } = useMaker();

  const onAccountChosen = useCallback(
    async ({ address }) => {
      maker.useAccountWithAddress(address);
      Router.push('/overview');
    },
    [maker]
  );

  const connectToProviderOfType = async type => {
    const account = await maker.addAccount({
      type
    });
    maker.useAccountWithAddress(account.address);
    Router.push('/overview');
  };

  const { connectTrezorWallet } = useTrezor({ onAccountChosen });
  const { connectLedgerWallet } = useLedger({ onAccountChosen });

  async function connectBrowserWallet() {
    try {
      const connectedAddress = await connectBrowserProvider(maker);
      onAccountChosen({ address: connectedAddress }, providerName);
    } catch (err) {
      window.alert(err);
    }
  }

  return (
    <Grid px="m" py="xs" gridRowGap="s" justifyContent={['center', 'center']}>
      <BrowserProviderButton
        onClick={connectBrowserWallet}
        disabled={!maker}
        provider={providerName}
      />
      <BrowserView>
        <IconButton
          onClick={connectTrezorWallet}
          disabled={!maker}
          icon={
            <img
              src={Trezor}
              css={{ marginTop: -5, marginBottom: -5, paddingLeft: 5 }}
            />
          }
        >
          {lang.providers.trezor}
        </IconButton>
      </BrowserView>

      <BrowserView>
        <IconButton
          onClick={connectLedgerWallet}
          disabled={!maker}
          icon={
            <img
              src={Ledger}
              css={{ marginTop: -5, marginBottom: -5, paddingLeft: 5 }}
            />
          }
        >
          {lang.providers.ledger_nano}
        </IconButton>
      </BrowserView>
      <BrowserView>
        <IconButton
          onClick={() => {
            connectToProviderOfType('walletconnect');
          }}
          disabled={!maker}
          icon={
            <img
              src={walletConnect}
              css={{ marginTop: -5, marginBottom: -5 }}
            />
          }
        >
          {lang.providers.wallet_connect}
        </IconButton>
      </BrowserView>
      <BrowserView>
        <IconButton
          onClick={() => {
            connectToProviderOfType('walletlink');
          }}
          disabled={!maker}
          icon={
            <img
              src={walletLink}
              css={{
                marginTop: -5,
                marginBottom: -5,
                paddingLeft: 2,
                width: 26
              }}
            />
          }
        >
          {lang.providers.wallet_link}
        </IconButton>
      </BrowserView>
    </Grid>
  );
}

export default WalletManager;
