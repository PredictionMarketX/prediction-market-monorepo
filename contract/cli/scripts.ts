import * as anchor from "@coral-xyz/anchor";
import { BN, Program, web3 } from "@coral-xyz/anchor";
import fs from "fs";

import { Keypair, Connection, PublicKey, Transaction } from "@solana/web3.js";

import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

import { PredictionMarket } from "../target/types/prediction_market";
import {
  createConfigTx,
  createMarketTx,
  mintNoTokenTx,
  swapTx,
  resolutionTx,
  addLiquidityTx,
  withdrawLiquidityTx,
} from "../lib/scripts";
import { execTx } from "../lib/util";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  TEST_DECIMALS,
  TEST_YES_NAME,
  TEST_YES_SYMBOL,
  TEST_YES_URI,
  TEST_NO_NAME,
  TEST_NO_SYMBOL,
  TEST_NO_URI,
  TEST_TOKEN_SUPPLY,
  TEST_VIRTUAL_RESERVES,
  TEST_INITIAL_VIRTUAL_TOKEN_RESERVES,
  TEST_INITIAL_VIRTUAL_SOL_RESERVES,
  TEST_INITIAL_REAL_TOKEN_RESERVES,
  SEED_CONFIG,
  SEED_MARKET,
  SEED_USERINFO,
} from "../lib/constant";

let solConnection: Connection = null;
let program: Program<PredictionMarket> = null;
let payer: NodeWallet = null;

/**
 * Set cluster, provider, program
 * If rpc != null use rpc, otherwise use cluster param
 * @param cluster - cluster ex. mainnet-beta, devnet ...
 * @param keypair - wallet keypair
 * @param rpc - rpc
 */
export const setClusterConfig = async (
  cluster: web3.Cluster,
  keypair: string,
  rpc?: string
) => {
  if (!rpc) {
    solConnection = new web3.Connection(web3.clusterApiUrl(cluster));
  } else {
    solConnection = new web3.Connection(rpc);
  }

  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(keypair, "utf-8"))),
    { skipValidation: true }
  );
  payer = new NodeWallet(walletKeypair);

  console.log("Wallet Address: ", payer.publicKey.toBase58());

  anchor.setProvider(
    new anchor.AnchorProvider(solConnection, payer, {
      skipPreflight: true,
      commitment: "confirmed",
    })
  );

  // Generate the program client from IDL.
  program = anchor.workspace.prediction_market as Program<PredictionMarket>;

  console.log("ProgramId: ", program.programId.toBase58());
};

// Pretty print helper (supports --json)
function printResult(label: string, res: any, asJson: boolean) {
  if (asJson) {
    const replacer = (_key: string, value: any) => (BN && (value instanceof BN || (BN as any).isBN?.(value))) ? value.toString() : value;
    console.log(JSON.stringify(res, replacer, 2));
  } else {
    console.log(label, res);
  }
}

// Optional pretty formatters
function fmtAmount(v: any) {
  return typeof v === 'object' && v && 'toNumber' in v ? (v as any).toNumber() : Number(v);
}

function formatSellPreview(res: any) {
  const lines = [
    `token_type: ${res.tokenType} (0=NO,1=YES)`,
    `token_amount_in: ${fmtAmount(res.tokenAmountIn)}`,
    `usdc_out_before_fee: ${fmtAmount(res.usdcOutBeforeFee)}`,
    `fees: platform=${fmtAmount(res.platformFee)}, lp=${fmtAmount(res.lpFee)}, total=${fmtAmount(res.totalFee)}`,
    `amount_after_fee: ${fmtAmount(res.amountAfterFee)}`,
    `team_fee: ${fmtAmount(res.teamFee)}, insurance_allocation: ${fmtAmount(res.insuranceAllocation)}`,
    `vault_balance_before: ${fmtAmount(res.vaultBalanceBefore)}, min_balance: ${fmtAmount(res.minBalance)}`,
    `projected_remaining: ${fmtAmount(res.projectedRemaining)}, will_violate_min_balance: ${Boolean(res.willViolateMinBalance)}`,
  ];
  return lines.join("\n");
}

function formatClaimFeesPreview(res: any) {
  const lines = [
    `lp: ${res.lp}`,
    `market: ${res.market}`,
    `lp_shares: ${fmtAmount(res.lpShares)}`,
    `claimable_fees: ${fmtAmount(res.claimableFees)}`,
    `vault_balance_before: ${fmtAmount(res.vaultBalanceBefore)}, min_balance: ${fmtAmount(res.minBalance)}`,
    `remaining_after: ${fmtAmount(res.remainingAfter)}, will_violate_min_balance: ${Boolean(res.willViolateMinBalance)}`,
  ];
  return lines.join("\n");
}

function formatWithdrawPreview(res: any) {
  const lines = [
    `estimated_usdc_out: ${fmtAmount(res.estimatedUsdcOut)}`,
    `early_exit_penalty: ${fmtAmount(res.earlyExitPenalty)} (${fmtAmount(res.earlyExitPenaltyBps)} bps)`,
    `max_withdraw: ${fmtAmount(res.maxWithdrawBps)} bps (${fmtAmount(res.maxWithdrawShares)} shares)`,
    `circuit_breaker_active: ${Boolean(res.circuitBreakerActive)}, pool_imbalance_ratio: ${fmtAmount(res.poolImbalanceRatio)}`,
    `insurance_compensation: ${fmtAmount(res.insuranceCompensation)}, loss_rate_bps: ${fmtAmount(res.lossRateBps)}`,
    `leftover_yes: ${fmtAmount(res.leftoverYes)}, leftover_no: ${fmtAmount(res.leftoverNo)}`,
    `leftover_usdc_estimate: ${fmtAmount(res.leftoverUsdcEstimate)}, internal_slippage_bps: ${fmtAmount(res.internalSlippageBps)}`,
    `pool_before: yes=${fmtAmount(res.poolYesReserveBefore)}, no=${fmtAmount(res.poolNoReserveBefore)}, usdc=${fmtAmount(res.poolCollateralReserveBefore)}`,
    `pool_after:  yes=${fmtAmount(res.poolYesReserveAfter)},  no=${fmtAmount(res.poolNoReserveAfter)},  usdc=${fmtAmount(res.poolCollateralReserveAfter)}`,
  ];
  return lines.join("\n");
}

async function accountExists(pk: PublicKey): Promise<boolean> {
  const info = await solConnection.getAccountInfo(pk);
  return info !== null;
}

export const configProject = async () => {
  // Create a dummy config object to pass as argument.
  const newConfig = {
    authority: payer.publicKey,
    pendingAuthority: PublicKey.default,

    teamWallet: payer.publicKey,

    platformBuyFee: new BN(100), // Example fee: 1%
    platformSellFee: new BN(100), // Example fee: 1%
    lpBuyFee: new BN(20),
    lpSellFee: new BN(20),

    tokenSupplyConfig: new BN(TEST_INITIAL_VIRTUAL_TOKEN_RESERVES),
    tokenDecimalsConfig: 6,

    initialRealTokenReservesConfig: new BN(TEST_INITIAL_REAL_TOKEN_RESERVES),

    minSolLiquidity: new BN(5_000_000_000),

    initialized: true,
  };
  const tx = await createConfigTx(
    payer.publicKey,
    newConfig,
    solConnection,
    program
  );

  await execTx(tx, solConnection, payer);
};

export const createMarket = async () => {

  const noTokenMintTx = await mintNoTokenTx(

    //  metadata
    TEST_NO_SYMBOL,
    TEST_NO_URI,

    payer.publicKey,

    solConnection,
    program
  );

  const configPda = PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_CONFIG)],
    program.programId
  )[0];

  const configAccount = await program.account.config.fetch(configPda);

  const marketCreationTx = await createMarketTx(

    //  metadata
    TEST_YES_SYMBOL,
    TEST_YES_URI,

    payer.publicKey,
    configAccount.teamWallet,
    noTokenMintTx.no_tokenKp.publicKey,

    solConnection,
    program
  );

  const transaction = new Transaction()
  transaction.add(...noTokenMintTx.tx.instructions)
  transaction.add(...marketCreationTx.tx.instructions)

  transaction.feePayer = payer.publicKey;
  transaction.recentBlockhash = (await solConnection.getLatestBlockhash()).blockhash;
  transaction.sign(noTokenMintTx.no_tokenKp, marketCreationTx.yes_tokenKp);



  await execTx(transaction, solConnection, payer);

  const marketPda = PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_MARKET), marketCreationTx.yes_tokenKp.publicKey.toBytes(), noTokenMintTx.no_tokenKp.publicKey.toBytes()],
    program.programId
  )[0];

  console.log("🚀 ~ createMarket ~ no_tokenKp:", noTokenMintTx.no_tokenKp.publicKey.toBase58());
  console.log("🚀 ~ createMarket ~ yes_tokenKp:", marketCreationTx.yes_tokenKp.publicKey.toBase58());
  console.log("🚀 ~ createMarket ~ marketPda:", marketPda.toBase58())
  const marketAccount = await program.account.market.fetch(marketPda);
  console.log("🚀 ~ createMarket ~ marketAccount:", marketAccount)

};


export const swap = async (
  yes_token: PublicKey,
  no_token: PublicKey,

  amount: number,
  style: number,
  token_type: number,
) => {
  const tx = await swapTx(
    payer.publicKey,
    yes_token,
    no_token,
    amount,
    style,
    token_type,
    solConnection,
    program
  );

  await execTx(tx, solConnection, payer);

  const marketPda = PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_MARKET), yes_token.toBytes(), no_token.toBytes()],
    program.programId
  )[0];

  console.log("🚀 ~ createMarket ~ marketPda:", marketPda.toBase58())
  const marketAccount = await program.account.market.fetch(marketPda);
  console.log("🚀 ~ createMarket ~ marketAccount:", marketAccount)

};


export const resolution = async (
  yes_token: PublicKey,
  no_token: PublicKey,
) => {

  const marketPda = PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_MARKET), yes_token.toBytes(), no_token.toBytes()],
    program.programId
  )[0];

  console.log("🚀 ~ createMarket ~ marketPda:", marketPda.toBase58())
  const marketAccount = await program.account.market.fetch(marketPda);
  console.log("🚀 ~ createMarket ~ marketAccount:", marketAccount)

  const tx = await resolutionTx(
    payer.publicKey,
    payer.publicKey,
    yes_token,
    no_token,

    solConnection,
    program
  );

  await execTx(tx, solConnection, payer);

};

export const addLiquidity = async (
  yes_token: PublicKey,
  no_token: PublicKey,

  amount: number,
) => {
  const tx = await addLiquidityTx(
    payer.publicKey,
    yes_token,
    no_token,
    amount,
    solConnection,
    program
  );

  await execTx(tx, solConnection, payer);

  const marketPda = PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_MARKET), yes_token.toBytes(), no_token.toBytes()],
    program.programId
  )[0];
  console.log("🚀 ~ createMarket ~ marketPda:", marketPda.toBase58())
  const marketAccount = await program.account.market.fetch(marketPda);
  console.log("🚀 ~ createMarket ~ marketAccount:", marketAccount)

  const [userInfoPda, _] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_USERINFO), payer.publicKey.toBytes(), marketPda.toBytes()],
    program.programId
  );
  console.log("🚀 ~ resolutionTx ~ userInfoPda:", userInfoPda.toBase58())
  const userInfoAccount = await program.account.userInfo.fetch(userInfoPda);
  console.log("🚀 ~ userInfoAccount:", userInfoAccount)
};

export const withdrawLiquidity = async (
  yes_token: PublicKey,
  no_token: PublicKey,

  amount: number,
) => {
  const tx = await withdrawLiquidityTx(
    payer.publicKey,
    yes_token,
    no_token,
    amount,
    solConnection,
    program
  );

  await execTx(tx, solConnection, payer);

  const marketPda = PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_MARKET), yes_token.toBytes(), no_token.toBytes()],
    program.programId
  )[0];

  console.log("🚀 ~ createMarket ~ marketPda:", marketPda.toBase58())
  const marketAccount = await program.account.market.fetch(marketPda);
  console.log("🚀 ~ createMarket ~ marketAccount:", marketAccount)

  const [userInfoPda, _] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_USERINFO), payer.publicKey.toBytes(), marketPda.toBytes()],
    program.programId
  );
  console.log("🚀 ~ resolutionTx ~ userInfoPda:", userInfoPda.toBase58())
  const userInfoAccount = await program.account.userInfo.fetch(userInfoPda);
  console.log("🚀 ~ userInfoAccount:", userInfoAccount)
};

/**
 * Ensure Team USDC ATA exists (admin-only convenience)
 * - Reads global config to get teamWallet and usdcMint
 * - Derives team USDC ATA and calls on-chain ensureTeamUsdcAta
 */
export const ensureTeamUsdcAta = async () => {
  const configPda = PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_CONFIG)],
    program.programId
  )[0];

  const cfg = await program.account.config.fetch(configPda);
  const usdcMint = cfg.usdcMint as PublicKey;
  const teamWallet = cfg.teamWallet as PublicKey;

  const teamUsdcAta = getAssociatedTokenAddressSync(
    usdcMint,
    teamWallet,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  console.log("Ensuring Team USDC ATA:", teamUsdcAta.toBase58());

  await program.methods
    .ensureTeamUsdcAta()
    .accounts({
      globalConfig: configPda,
      admin: payer.publicKey,
      usdcMint,
      teamWallet,
      teamUsdcAta,
      systemProgram: web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .rpc();

  console.log("✅ Team USDC ATA ensured");
};

/**
 * Update fee rates online via configure (admin only)
 * - Reads current config, patches fee fields, and calls configure
 * - buy/sell/lpBuy/lpSell are in BPS (0..10000)
 */
export const updateFees = async (
  buyBps: number,
  sellBps: number,
  lpBuyBps: number,
  lpSellBps: number,
) => {
  const configPda = PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_CONFIG)],
    program.programId
  )[0];

  // Fetch current config and patch fields
  const cfg: any = await program.account.config.fetch(configPda);

  const newConfig = {
    ...cfg,
    platformBuyFee: new BN(buyBps),
    platformSellFee: new BN(sellBps),
    lpBuyFee: new BN(lpBuyBps),
    lpSellFee: new BN(lpSellBps),
  };

  // Reuse existing helper to build and send tx
  const tx = await createConfigTx(
    payer.publicKey,
    newConfig,
    solConnection,
    program
  );

  await execTx(tx, solConnection, payer);

  console.log(
    `✅ Fees updated (bps): platform buy=${buyBps}, sell=${sellBps}, lp buy=${lpBuyBps}, lp sell=${lpSellBps}`
  );
};

/**
 * Update market-level fee overrides (admin only)
 * - yes/no: market identifier mints
 * - enabled: toggle override on/off
 * - bps params: 0..10000
 */
export const updateMarketFees = async (
  yesToken: PublicKey,
  noToken: PublicKey,
  enabled: boolean,
  buyBps: number,
  sellBps: number,
  lpBuyBps: number,
  lpSellBps: number,
) => {
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_CONFIG)],
    program.programId
  );

  const [marketPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_MARKET), yesToken.toBytes(), noToken.toBytes()],
    program.programId
  );

  await program.methods
    .configureMarketFees({
      enabled,
      platformBuyFeeBps: new BN(buyBps),
      platformSellFeeBps: new BN(sellBps),
      lpBuyFeeBps: new BN(lpBuyBps),
      lpSellFeeBps: new BN(lpSellBps),
    })
    .accounts({
      globalConfig: configPda,
      market: marketPda,
      yesToken,
      noToken,
      admin: payer.publicKey,
    })
    .rpc();

  console.log(
    `✅ Market fees ${enabled ? 'enabled' : 'disabled'} for ${marketPda.toBase58()} (bps: buy=${buyBps}, sell=${sellBps}, lpBuy=${lpBuyBps}, lpSell=${lpSellBps})`
  );
};

/**
 * Call read-only sell_preview and print the result.
 */
export const sellPreview = async (
  yesToken: PublicKey,
  noToken: PublicKey,
  amount: number,
  tokenType: number,
  json: boolean = false,
) => {
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_CONFIG)],
    program.programId
  );

  const [marketPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_MARKET), yesToken.toBytes(), noToken.toBytes()],
    program.programId
  );

  const cfg: any = await program.account.config.fetch(configPda);

  // usdc mint is required for accounts
  const usdcMint = cfg.usdcMint as PublicKey;

  // Basic validation
  if (tokenType !== 0 && tokenType !== 1) {
    throw new Error('tokenType must be 0 (NO) or 1 (YES)');
  }

  const marketExists = await accountExists(marketPda);
  if (!marketExists) {
    console.error('Market account not found:', marketPda.toBase58());
    return;
  }

  const res = await program.methods
    .sellPreview(new BN(amount), tokenType)
    .accounts({
      globalConfig: configPda,
      market: marketPda,
      yesToken,
      noToken,
      usdcMint,
    })
    .view();

  if (json) {
    printResult("Sell preview:", res, true);
  } else {
    const allowedNet = Math.max(0, fmtAmount(res.vaultBalanceBefore) - fmtAmount(res.minBalance) - fmtAmount(res.teamFee));
    let suggestion = '';
    if (Boolean(res.willViolateMinBalance)) {
      suggestion = `\nSuggestion: reduce order so that net after fee <= ${allowedNet}. (Approximate bound; LMSR is non-linear)`;
    }
    console.log(formatSellPreview(res) + suggestion);
  }
};

/**
 * Call read-only claim_fees_preview as payer(LP)
 */
export const claimFeesPreview = async (
  yesToken: PublicKey,
  noToken: PublicKey,
  json: boolean = false,
) => {
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_CONFIG)],
    program.programId
  );

  const [marketPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_MARKET), yesToken.toBytes(), noToken.toBytes()],
    program.programId
  );

  const cfg: any = await program.account.config.fetch(configPda);
  const usdcMint = cfg.usdcMint as PublicKey;

  const marketExists = await accountExists(marketPda);
  if (!marketExists) {
    console.error('Market account not found:', marketPda.toBase58());
    return;
  }

  // Derive LP position PDA to check existence
  const [lpPositionPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('lp_position'), marketPda.toBytes(), payer.publicKey.toBytes()],
    program.programId
  );
  const lpExists = await accountExists(lpPositionPda);
  if (!lpExists) {
    console.error('LP position not found for current wallet. Provide liquidity first.');
    return;
  }

  const res = await program.methods
    .claimFeesPreview()
    .accounts({
      globalConfig: configPda,
      market: marketPda,
      yesToken,
      noToken,
      usdcMint,
      lp: payer.publicKey,
    })
    .view();

  if (json) {
    printResult("Claim fees preview:", res, true);
  } else {
    const allowed = Math.max(0, fmtAmount(res.vaultBalanceBefore) - fmtAmount(res.minBalance));
    let suggestion = '';
    if (Boolean(res.willViolateMinBalance)) {
      suggestion = `\nSuggestion: claim <= ${allowed} to avoid min balance violation.`;
    }
    console.log(formatClaimFeesPreview(res) + suggestion);
  }
};

/**
 * Call read-only withdraw_preview
 * - Requires payer to be an LP of the market (lp_position must exist)
 */
export const withdrawPreviewView = async (
  yesToken: PublicKey,
  noToken: PublicKey,
  lpShares: number,
  json: boolean = false,
) => {
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_CONFIG)],
    program.programId
  );

  const [marketPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_MARKET), yesToken.toBytes(), noToken.toBytes()],
    program.programId
  );

  const [lpPositionPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('lp_position'), marketPda.toBytes(), payer.publicKey.toBytes()],
    program.programId
  );

  const marketExists = await accountExists(marketPda);
  if (!marketExists) {
    console.error('Market account not found:', marketPda.toBase58());
    return;
  }

  const lpExists = await accountExists(lpPositionPda);
  if (!lpExists) {
    console.error('LP position not found for current wallet. Provide liquidity first.');
    return;
  }

  const res = await program.methods
    .withdrawPreview(new BN(lpShares))
    .accounts({
      globalConfig: configPda,
      market: marketPda,
      lpPosition: lpPositionPda,
      user: payer.publicKey,
    })
    .view();

  if (json) {
    printResult("Withdraw preview:", res, true);
  } else {
    let suggestion = '';
    if (Boolean(res.circuitBreakerActive)) {
      suggestion = `\nSuggestion: circuit breaker is active. Wait for reset/cooldown before withdrawing.`;
    } else {
      const maxShares = fmtAmount(res.maxWithdrawShares);
      suggestion = `\nSuggestion: withdraw up to ${maxShares} shares in this window (dynamic limit).`;
    }
    console.log(formatWithdrawPreview(res) + suggestion);
  }
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
} 
