import RedeemDai from '../../../pages/migration/redeemDai';
import Overview from '../../../pages/overview';
import render from '../../helpers/render';
import { fireEvent, waitForElement } from '@testing-library/react';
import { instantiateMaker, SAI } from '../../../maker';
import { WAD } from '../../references/constants';
import { stringToBytes } from '../../../utils/ethereum';
import { ETH, BAT, USDC, WBTC, ZRX } from '@makerdao/dai-plugin-mcd';
import { DAI } from '@makerdao/dai-plugin-mcd';
const { change, click } = fireEvent;
import BigNumber from 'bignumber.js';

let maker;

const daiAmount = 1;
const dsrAmount = 0.5;
const minEndBalance = 0.1;

const ilks = [
  ['ETH-A', ETH],
  ['BAT-A', BAT],
  ['USDC-A', USDC],
  ['USDC-B', USDC],
  ['WBTC-A', WBTC],
  ['ZRX-A', ZRX]
];

beforeAll(async () => {
  jest.setTimeout(30000);
  maker = await instantiateMaker('test');
  const proxyAddress = await maker.service('proxy').ensureProxy();
  const vaults = {};

  for (let ilkInfo of ilks) {
    const [ilk, gem] = ilkInfo;
    await maker.getToken(gem).approveUnlimited(proxyAddress);
    vaults[ilk] = await maker
      .service('mcd:cdpManager')
      .openLockAndDraw(ilk, gem(10), daiAmount);
  }
  await maker.getToken(DAI).approveUnlimited(proxyAddress);
  await maker.service('mcd:savings').join(DAI(dsrAmount));

  //trigger ES, and get to the point that Dai can be cashed for all ilks
  const token = maker.service('smartContract').getContract('MCD_GOV');
  await token['mint(uint256)'](WAD.times(50000).toFixed());
  const esm = maker.service('smartContract').getContract('MCD_ESM');
  await token.approve(esm.address, -1); //approve unlimited
  await esm.join(WAD.times(50000).toFixed());
  await esm.fire();
  const end = maker.service('smartContract').getContract('MCD_END');
  for (let ilkInfo of ilks) {
      const [ilk] = ilkInfo;
      await end['cage(bytes32)'](stringToBytes(ilk));
  }
  const migVault = maker
    .service('migration')
    .getMigration('global-settlement-collateral-claims');

  for (let vault of Object.keys(vaults)) {
    await migVault.free(vaults[vault].id, vault);
  }

  await end.thaw();

  for (let ilkInfo of ilks) {
    const [ilk] = ilkInfo;
    await end.flow(stringToBytes(ilk));
  }
});

test('overview', async () => {
  const { findByText } = await render(<Overview />, {
    initialState: {
      saiAvailable: SAI(0),
      daiAvailable: DAI(0)
    },
    getMaker: maker => {
      maker.service('cdp').getCdpIds = jest.fn(() => []);
    }
  });

  await findByText('Redeem Dai for collateral');
});

test('the whole flow', async () => {
  const {
    findByText,
    getByText,
    getByRole,
    getByTestId,
    findAllByTestId,
    getAllByTestId
  } = await render(<RedeemDai />, {
    initialState: {
      proxyDaiAllowance: DAI(0),
      daiBalance: DAI(daiAmount * ilks.length - dsrAmount),
      endBalance: DAI(0),
      dsrBalance: DAI(dsrAmount),
      minEndVatBalance: BigNumber(minEndBalance),
      bagBalance: DAI(0),
      outAmounts: [
        { ilk: 'ETH-A', out: BigNumber(0) },
        { ilk: 'BAT-A', out: BigNumber(0) },
        { ilk: 'USDC-A', out: BigNumber(0) },
        { ilk: 'USDC-B', out: BigNumber(0) },
        { ilk: 'WBTC-A', out: BigNumber(0) },
        { ilk: 'ZRX-A', out: BigNumber(0) },
      ],
      fixedPrices: [
        { ilk: 'ETH-A', price: BigNumber(10) },
        { ilk: 'BAT-A', price: BigNumber(10) },
        { ilk: 'USDC-A', price: BigNumber(10) },
        { ilk: 'USDC-B', price: BigNumber(10) },
        { ilk: 'WBTC-A', price: BigNumber(10) },
        { ilk: 'ZRX-A', price: BigNumber(10) },
      ],
      tagPrices: [
        { ilk: 'ETH-A', price: BigNumber(10) },
        { ilk: 'BAT-A', price: BigNumber(10) },
        { ilk: 'USDC-A', price: BigNumber(10) },
        { ilk: 'USDC-B', price: BigNumber(10) },
        { ilk: 'WBTC-A', price: BigNumber(10) },
        { ilk: 'ZRX-A', price: BigNumber(10) },
      ]
    }
  });

  //proxy contract setup
  await findByText('Set up proxy contract');
  const continueButton = getByText('Continue');
  expect(continueButton.disabled).toBeTruthy();
  const allowanceButton = getByText('Set');
  await waitForElement(() => !allowanceButton.disabled);
  click(allowanceButton);
  await waitForElement(() => !continueButton.disabled);
  click(continueButton);

  //deposit dai
  await findByText('Deposit Dai to Redeem');
  click(getByText('Withdraw'));
  await findByText((daiAmount * ilks.length).toString()+'.00 DAI');
  change(getByRole('textbox'), { target: { value: minEndBalance + 0.1 } });
  getByText(/Users cannot redeem more/);
  change(getByRole('textbox'), { target: { value: minEndBalance } });
  click(getByTestId('tosCheck'));
  const depositButton = getByText('Deposit');
  expect(depositButton.disabled).toBeFalsy();
  click(depositButton);

  //redeem dai
  await findByText('Redeem Dai');

  async function redeem(ilkInfo) {
    console.log('in redeem for ilk', ilkInfo);
    const [ilk, gem] = ilkInfo;
    //should be two buttons, one for mobile one for desktop
    const button = getAllByTestId(`redeemButton-${ilk}`)[0];
    const before = await maker.service('token').getToken(gem).balance();
    click(button);
    await findAllByTestId(`successButton-${ilk}`);
    const after = await maker.service('token').getToken(gem).balance();
    console.log('found it?', ilk);
    console.log('after.toString()', after.toString());
    console.log('before.toString()', before.toString());
    expect(after.gt(before));
    console.log('post assertion', ilk);
  }

  for (let ilk of ilks) {
    await redeem(ilk);
  }

  expect.assertions(ilks.length+2);
});
