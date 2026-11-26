# Pendle generic balance fetcher

## DAWN HTTP service

This fork runs the fetcher as an HTTP service for infrafi-api.

Environment:

| Var | Example |
|---|---|
| `CHAIN_ID` | `8453` (Base, default) |
| `BASE_RPC` | Base RPC URL |
| `PENDLE_SY` | SY address |
| `PENDLE_YT` | YT address |
| `PENDLE_MARKETS` | `0xmarket:deployedBlock[,0xmarket2:block2]` |
| `PORT` | `8080` (default) |

Endpoints:

- `GET /health` → `{ "ok": true }`
- `GET /balances[?block=N]` → `{ "block": N, "sy": "0x…", "decimals": 18, "yt": { "0x…": "123…" }, "lp": { … } }`. Without `block`, reads ~15 min (450 blocks) behind the head. Balances are in SY base units (`decimals` places), as decimal strings; zero balances are omitted. The YT fee share and expired-YT reserve are credited to the Pendle treasury, as upstream.

Run locally with `yarn start`, or `docker build -t pendle-balance-fetcher .`.


## Set up

1. Install required package by:

```
yarn install
```

2. Edit the configuration file (`./src/configuration.ts`) to fill in the pool's information. Do note that **all addresses in this file must be in lowercase**.

## Usage

In `./src/main.ts`, the main function to call is `fetchUserBalanceSnapshotBatch`, where its arguments are simply a list of block number to query users' balance from. Do note that a buffer of at least 15 minutes are recommended before you can query a balance from a mined block.

If you'd like to query for USD value of LP, `fetchingLpValueInSY` needs to be set to **True**. The balance will be returned in SY terms. Afterwards, you can convert it to USD value by multiplying the outcome with the current SY price.

