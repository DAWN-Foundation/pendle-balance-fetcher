import http from 'http';
import { CHAIN, POOL_INFO } from './configuration';
import { ethers } from 'ethers';
import { _1E18, PROVIDER } from './consts';
import { resolveMorpho } from './lib/morpho';
import {
  applyLpHolderShares,
  applyLpHolderValuesInSY,
  applyYtHolderShares
} from './logic';
import { tryAggregateMulticall } from './multicall';
import { FullMarketInfo, LiquidLockerData, PendleAPI } from './pendle-api';
import { UserRecord } from './types';

type SnapshotResult = {
  resultYT: UserRecord;
  resultLP: UserRecord;
};

async function fetchUserBalanceSnapshot(
  allYTUsers: string[],
  lpInfos: FullMarketInfo[],
  blockNumber: number
): Promise<SnapshotResult> {
  const resultYT: UserRecord = {};
  const resultLP: UserRecord = {};

  await Promise.all([
    applyYtHolderShares(resultYT, allYTUsers, blockNumber),
    ...lpInfos.map(async (lpInfo, i) => {
      const lp = POOL_INFO.LPs[i];
      if (lp.deployedBlock > blockNumber) return;
      await applyLpHolderShares(resultLP, lp.address, lpInfo, blockNumber);
    })
  ]);

  return {
    resultYT,
    resultLP
  };
}

async function fetchUserLpValueInSYSnapshot(
  lpInfos: FullMarketInfo[],
  blockNumber: number
): Promise<SnapshotResult> {
  const resultLP: UserRecord = {};
  for (let i = 0; i < POOL_INFO.LPs.length; ++i) {
    const lp = POOL_INFO.LPs[i];
    const llData = lpInfos[i].llDatas;
    if (lp.deployedBlock <= blockNumber) {
      await applyLpHolderValuesInSY(
        resultLP,
        lp.address,
        POOL_INFO.YT,
        lpInfos[i].lpHolders,
        llData,
        blockNumber
      );
    }
  }

  return {
    resultYT: {},
    resultLP
  };
}

async function fetchUserBalanceSnapshotBatch(
  blockNumbers: number[],
  fetchingLpValueInSY: boolean = false
): Promise<SnapshotResult[]> {
  const allYTUsers = await PendleAPI.queryToken(POOL_INFO.YT);
  const lpInfos = await Promise.all(
    POOL_INFO.LPs.map((lp) => PendleAPI.queryMarketInfo(CHAIN, lp.address))
  );

  return await Promise.all(
    blockNumbers.map((b) =>
      fetchingLpValueInSY
        ? fetchUserLpValueInSYSnapshot(lpInfos, b)
        : fetchUserBalanceSnapshot(allYTUsers, lpInfos, b)
    )
  );
}

// BigNumber → decimal string (SY base units), dropping zero balances.
function toJson(record: UserRecord): Record<string, string> {
  const out: Record<string, string> = {};
  for (const user in record) {
    if (!record[user].isZero()) out[user] = record[user].toString();
  }
  return out;
}

function send(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

// ~15 minutes of Base blocks (2s each).
const BLOCK_DELAY = 450;

async function syDecimals(): Promise<number> {
  const sy = new ethers.Contract(
    POOL_INFO.SY,
    ['function decimals() view returns (uint8)'],
    PROVIDER
  );
  return Number(await sy.decimals());
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/health') {
    return send(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/balances') {
    const param = url.searchParams.get('block');
    let block: number;
    try {
      // No block = ~15 min behind head, Pendle's recommended buffer.
      block = param
        ? Number(param)
        : (await PROVIDER.getBlockNumber()) - BLOCK_DELAY;
    } catch (e) {
      console.error('head block read failed', e);
      return send(res, 500, { error: String(e) });
    }
    if (!Number.isInteger(block) || block <= 0) {
      return send(res, 400, { error: 'block must be a positive integer' });
    }
    try {
      const [snapshot, decimals] = await Promise.all([
        fetchUserBalanceSnapshotBatch([block]).then((r) => r[0]),
        syDecimals()
      ]);
      return send(res, 200, {
        block,
        sy: POOL_INFO.SY,
        decimals,
        yt: toJson(snapshot.resultYT),
        lp: toJson(snapshot.resultLP)
      });
    } catch (e) {
      console.error(`balances at block ${block} failed`, e);
      return send(res, 500, { error: String(e) });
    }
  }

  send(res, 404, { error: 'not found' });
});

const port = Number(process.env.PORT || 8080);
server.listen(port, () => console.log(`pendle-balance-fetcher on :${port}`));
