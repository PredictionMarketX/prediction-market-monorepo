import { Connection, PublicKey, SystemProgram, Keypair } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { BN, Program } from '@coral-xyz/anchor';
import {
  getPredictionMarketProgram,
  PDAHelper,
  parseUSDC,
  formatUSDC,
  PROGRAM_CONFIG,
} from './program';
import type {
  Market,
  Config,
  UserInfo,
  CreateMarketParams,
  SwapParams,
  AddLiquidityParams,
  WithdrawLiquidityParams,
  MintCompleteSetParams,
  RedeemCompleteSetParams,
  TransactionResult,
  TokenType,
  TradeDirection,
  PredictionMarket,
} from './types';

/**
 * Prediction Market Client
 * Handles all interactions with the prediction market program
 */
export class PredictionMarketClient {
  private program: Program<PredictionMarket>;
  private connection: Connection;
  public wallet: any;

  constructor(connection: Connection, wallet: any) {
    this.connection = connection;
    this.wallet = wallet;
    this.program = getPredictionMarketProgram(connection, wallet);
  }

  /**
   * Fetch global config
   */
  async getConfig(): Promise<Config | null> {
    try {
      const [configPDA] = PDAHelper.getConfigPDA();
      const config = await this.program.account.config.fetch(configPDA);
      return config as Config;
    } catch (error) {
      console.error('Failed to fetch config:', error);
      return null;
    }
  }

  /**
   * Fetch market data
   */
  async getMarket(marketAddress: PublicKey): Promise<Market | null> {
    try {
      const market = await this.program.account.market.fetch(marketAddress);
      return market as Market;
    } catch (error) {
      console.error('Failed to fetch market:', error);
      return null;
    }
  }

  /**
   * Fetch user info for a specific market
   */
  async getUserInfo(userAddress: PublicKey, marketAddress: PublicKey): Promise<UserInfo | null> {
    try {
      const [userInfoPDA] = PDAHelper.getUserInfoPDA(userAddress, marketAddress);
      const userInfo = await this.program.account.userInfo.fetch(userInfoPDA);
      return userInfo as UserInfo;
    } catch (error) {
      console.error('Failed to fetch user info:', error);
      return null;
    }
  }

  /**
   * Fetch all markets
   */
  async getAllMarkets(): Promise<{ address: PublicKey; data: Market }[]> {
    try {
      const markets = await this.program.account.market.all();
      return markets.map((m) => ({
        address: m.publicKey,
        data: m.account as Market,
      }));
    } catch (error) {
      console.error('Failed to fetch markets:', error);
      return [];
    }
  }

  /**
   * Create a new prediction market
   */
  async createMarket(params: CreateMarketParams): Promise<TransactionResult> {
    try {
      const [configPDA] = PDAHelper.getConfigPDA();
      const [globalVaultPDA] = PDAHelper.getGlobalVaultPDA();

      // Get config to retrieve team wallet
      const config = await this.getConfig();
      if (!config) throw new Error('Config not found');

      // Generate keypairs for YES and NO token mints
      const yesTokenMint = Keypair.generate();
      const noTokenMint = Keypair.generate();

      const [marketPDA] = PDAHelper.getMarketPDA(
        yesTokenMint.publicKey,
        noTokenMint.publicKey
      );

      // Get whitelist PDA
      const [whitelistPDA] = PDAHelper.getWhitelistPDA(this.wallet.publicKey);

      // Get YES token metadata PDA
      const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
      const [yesMetadataPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('metadata'),
          METADATA_PROGRAM_ID.toBuffer(),
          yesTokenMint.publicKey.toBuffer(),
        ],
        METADATA_PROGRAM_ID
      );

      const [noMetadataPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('metadata'),
          METADATA_PROGRAM_ID.toBuffer(),
          noTokenMint.publicKey.toBuffer(),
        ],
        METADATA_PROGRAM_ID
      );

      // Get global YES/NO token accounts
      const globalYesTokenAccount = await getAssociatedTokenAddress(
        yesTokenMint.publicKey,
        globalVaultPDA,
        true
      );

      const globalNoTokenAccount = await getAssociatedTokenAddress(
        noTokenMint.publicKey,
        globalVaultPDA,
        true
      );

      const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

      const signature = await this.program.methods
        .createMarket({
          yesSymbol: params.yesSymbol,
          yesUri: params.yesUri,
          startSlot: params.startSlot ? new BN(params.startSlot) : null,
          endingSlot: params.endingSlot ? new BN(params.endingSlot) : null,
          lmsrB: params.lmsrB ? new BN(parseUSDC(params.lmsrB)) : null,
        })
        .accounts({
          globalConfig: configPDA,
          globalVault: globalVaultPDA,
          creator: this.wallet.publicKey,
          creatorWhitelist: whitelistPDA,
          yesToken: yesTokenMint.publicKey,
          noToken: noTokenMint.publicKey,
          market: marketPDA,
          yesTokenMetadataAccount: yesMetadataPDA,
          noTokenMetadataAccount: noMetadataPDA,
          globalYesTokenAccount: globalYesTokenAccount,
          globalNoTokenAccount: globalNoTokenAccount,
          systemProgram: SystemProgram.programId,
          rent: new PublicKey('SysvarRent111111111111111111111111111111111'),
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          mplTokenMetadataProgram: METADATA_PROGRAM_ID,
          teamWallet: config.teamWallet,
        })
        .signers([yesTokenMint, noTokenMint])
        .rpc();

      return { signature, success: true };
    } catch (error: any) {
      console.error('Failed to create market:', error);
      return { signature: '', success: false, error: error.message };
    }
  }

  /**
   * Swap tokens (buy/sell YES or NO tokens)
   */
  async swap(params: SwapParams): Promise<TransactionResult> {
    try {
      const market = await this.getMarket(params.market);
      if (!market) throw new Error('Market not found');

      const [configPDA] = PDAHelper.getConfigPDA();
      const [marketPDA] = PDAHelper.getMarketPDA(market.yesToken, market.noToken);
      const [userInfoPDA] = PDAHelper.getUserInfoPDA(this.wallet.publicKey, params.market);

      // Get user's USDC ATA
      const userUsdcAta = await getAssociatedTokenAddress(
        market.usdcMint,
        this.wallet.publicKey
      );

      // Get user's YES/NO token ATAs
      const userYesAta = await getAssociatedTokenAddress(
        market.yesToken,
        this.wallet.publicKey
      );
      const userNoAta = await getAssociatedTokenAddress(
        market.noToken,
        this.wallet.publicKey
      );

      // Market vaults
      const marketYesVault = await getAssociatedTokenAddress(
        market.yesToken,
        marketPDA,
        true
      );
      const marketNoVault = await getAssociatedTokenAddress(
        market.noToken,
        marketPDA,
        true
      );
      const marketUsdcVault = await getAssociatedTokenAddress(
        market.usdcMint,
        marketPDA,
        true
      );

      const config = await this.getConfig();
      if (!config) throw new Error('Config not found');

      const teamUsdcAta = await getAssociatedTokenAddress(
        market.usdcMint,
        config.admin
      );

      const signature = await this.program.methods
        .swap(
          { [params.tokenType === 0 ? 'yes' : 'no']: {} },
          { [params.direction === 0 ? 'buy' : 'sell']: {} },
          parseUSDC(params.amount),
          params.minOutput ? parseUSDC(params.minOutput) : new BN(0)
        )
        .accounts({
          user: this.wallet.publicKey,
          config: configPDA,
          market: marketPDA,
          userInfo: userInfoPDA,
          userYesAta,
          userNoAta,
          userUsdcAta,
          marketYesVault,
          marketNoVault,
          marketUsdcVault,
          teamUsdcAta,
          yesToken: market.yesToken,
          noToken: market.noToken,
          usdcMint: market.usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      return { signature, success: true };
    } catch (error: any) {
      console.error('Failed to swap:', error);
      return { signature: '', success: false, error: error.message };
    }
  }

  /**
   * Add liquidity to a market
   */
  async addLiquidity(params: AddLiquidityParams): Promise<TransactionResult> {
    try {
      const market = await this.getMarket(params.market);
      if (!market) throw new Error('Market not found');

      const [configPDA] = PDAHelper.getConfigPDA();
      const [marketPDA] = PDAHelper.getMarketPDA(market.yesToken, market.noToken);
      const [lpPositionPDA] = PDAHelper.getLPPositionPDA(this.wallet.publicKey, params.market);

      const userUsdcAta = await getAssociatedTokenAddress(
        market.usdcMint,
        this.wallet.publicKey
      );

      const marketYesVault = await getAssociatedTokenAddress(
        market.yesToken,
        marketPDA,
        true
      );
      const marketNoVault = await getAssociatedTokenAddress(
        market.noToken,
        marketPDA,
        true
      );
      const marketUsdcVault = await getAssociatedTokenAddress(
        market.usdcMint,
        marketPDA,
        true
      );

      const signature = await this.program.methods
        .addLiquidity(parseUSDC(params.usdcAmount))
        .accounts({
          user: this.wallet.publicKey,
          config: configPDA,
          market: marketPDA,
          lpPosition: lpPositionPDA,
          userUsdcAta,
          marketYesVault,
          marketNoVault,
          marketUsdcVault,
          yesToken: market.yesToken,
          noToken: market.noToken,
          usdcMint: market.usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      return { signature, success: true };
    } catch (error: any) {
      console.error('Failed to add liquidity:', error);
      return { signature: '', success: false, error: error.message };
    }
  }

  /**
   * Withdraw liquidity from a market
   */
  async withdrawLiquidity(params: WithdrawLiquidityParams): Promise<TransactionResult> {
    try {
      const market = await this.getMarket(params.market);
      if (!market) throw new Error('Market not found');

      const [configPDA] = PDAHelper.getConfigPDA();
      const [marketPDA] = PDAHelper.getMarketPDA(market.yesToken, market.noToken);
      const [lpPositionPDA] = PDAHelper.getLPPositionPDA(this.wallet.publicKey, params.market);

      const userYesAta = await getAssociatedTokenAddress(
        market.yesToken,
        this.wallet.publicKey
      );
      const userNoAta = await getAssociatedTokenAddress(
        market.noToken,
        this.wallet.publicKey
      );
      const userUsdcAta = await getAssociatedTokenAddress(
        market.usdcMint,
        this.wallet.publicKey
      );

      const marketYesVault = await getAssociatedTokenAddress(
        market.yesToken,
        marketPDA,
        true
      );
      const marketNoVault = await getAssociatedTokenAddress(
        market.noToken,
        marketPDA,
        true
      );
      const marketUsdcVault = await getAssociatedTokenAddress(
        market.usdcMint,
        marketPDA,
        true
      );

      const signature = await this.program.methods
        .withdrawLiquidity(new BN(params.lpSharesAmount))
        .accounts({
          user: this.wallet.publicKey,
          config: configPDA,
          market: marketPDA,
          lpPosition: lpPositionPDA,
          userYesAta,
          userNoAta,
          userUsdcAta,
          marketYesVault,
          marketNoVault,
          marketUsdcVault,
          yesToken: market.yesToken,
          noToken: market.noToken,
          usdcMint: market.usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      return { signature, success: true };
    } catch (error: any) {
      console.error('Failed to withdraw liquidity:', error);
      return { signature: '', success: false, error: error.message };
    }
  }

  /**
   * Mint complete set (get 1 YES + 1 NO for 1 USDC)
   */
  async mintCompleteSet(params: MintCompleteSetParams): Promise<TransactionResult> {
    try {
      const market = await this.getMarket(params.market);
      if (!market) throw new Error('Market not found');

      const [marketPDA] = PDAHelper.getMarketPDA(market.yesToken, market.noToken);
      const [userInfoPDA] = PDAHelper.getUserInfoPDA(this.wallet.publicKey, params.market);

      const userUsdcAta = await getAssociatedTokenAddress(
        market.usdcMint,
        this.wallet.publicKey
      );
      const userYesAta = await getAssociatedTokenAddress(
        market.yesToken,
        this.wallet.publicKey
      );
      const userNoAta = await getAssociatedTokenAddress(
        market.noToken,
        this.wallet.publicKey
      );

      const marketUsdcVault = await getAssociatedTokenAddress(
        market.usdcMint,
        marketPDA,
        true
      );

      const signature = await this.program.methods
        .mintCompleteSet(parseUSDC(params.usdcAmount))
        .accounts({
          user: this.wallet.publicKey,
          market: marketPDA,
          userInfo: userInfoPDA,
          userUsdcAta,
          userYesAta,
          userNoAta,
          marketUsdcVault,
          yesToken: market.yesToken,
          noToken: market.noToken,
          usdcMint: market.usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      return { signature, success: true };
    } catch (error: any) {
      console.error('Failed to mint complete set:', error);
      return { signature: '', success: false, error: error.message };
    }
  }

  /**
   * Redeem complete set (burn 1 YES + 1 NO to get 1 USDC back)
   */
  async redeemCompleteSet(params: RedeemCompleteSetParams): Promise<TransactionResult> {
    try {
      const market = await this.getMarket(params.market);
      if (!market) throw new Error('Market not found');

      const [marketPDA] = PDAHelper.getMarketPDA(market.yesToken, market.noToken);
      const [userInfoPDA] = PDAHelper.getUserInfoPDA(this.wallet.publicKey, params.market);

      const userUsdcAta = await getAssociatedTokenAddress(
        market.usdcMint,
        this.wallet.publicKey
      );
      const userYesAta = await getAssociatedTokenAddress(
        market.yesToken,
        this.wallet.publicKey
      );
      const userNoAta = await getAssociatedTokenAddress(
        market.noToken,
        this.wallet.publicKey
      );

      const marketUsdcVault = await getAssociatedTokenAddress(
        market.usdcMint,
        marketPDA,
        true
      );

      const signature = await this.program.methods
        .redeemCompleteSet(new BN(params.amount))
        .accounts({
          user: this.wallet.publicKey,
          market: marketPDA,
          userInfo: userInfoPDA,
          userUsdcAta,
          userYesAta,
          userNoAta,
          marketUsdcVault,
          yesToken: market.yesToken,
          noToken: market.noToken,
          usdcMint: market.usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      return { signature, success: true };
    } catch (error: any) {
      console.error('Failed to redeem complete set:', error);
      return { signature: '', success: false, error: error.message };
    }
  }

  /**
   * Calculate current price for a token type
   */
  calculatePrice(market: Market, tokenType: TokenType): number {
    const yesReserve = market.yesReserve.toNumber();
    const noReserve = market.noReserve.toNumber();
    const total = yesReserve + noReserve;

    if (total === 0) return 0.5;

    if (tokenType === 0) {
      // YES token
      return noReserve / total;
    } else {
      // NO token
      return yesReserve / total;
    }
  }
}
