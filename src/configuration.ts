import 'dotenv/config';
import { CHAINS, PoolConfiguration } from './types';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value.toLowerCase();
}

// PENDLE_MARKETS: comma-separated `address:deployedBlock` pairs.
function parseMarkets(raw: string): PoolConfiguration['LPs'] {
  return raw.split(',').map((entry) => {
    const [address, block] = entry.trim().split(':');
    const deployedBlock = Number(block);
    if (!address || !Number.isInteger(deployedBlock)) {
      throw new Error(`invalid PENDLE_MARKETS entry: ${entry}`);
    }
    return { address, deployedBlock };
  });
}

export const CHAIN: CHAINS = Number(process.env.CHAIN_ID || CHAINS.BASE);

export const POOL_INFO: PoolConfiguration = {
  SY: required('PENDLE_SY'),
  YT: required('PENDLE_YT'),
  LPs: parseMarkets(required('PENDLE_MARKETS'))
};
