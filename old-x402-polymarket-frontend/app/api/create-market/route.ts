import { NextRequest, NextResponse } from 'next/server';
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { PredictionMarketClient } from '@/app/lib/solana/client';
import { SOLANA_CONFIG } from '@/app/configs/solana';
import { X402_CONFIG } from '@/app/configs/x402';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import bs58 from 'bs58';

/**
 * Create Market API - x402 Payment Flow
 *
 * Architecture:
 * 1. User pays creation fee in USDC via x402
 * 2. Payment goes to X402_CONFIG.paymentAddress
 * 3. x402 middleware verifies payment
 * 4. This route creates market on Solana using backend wallet
 * 5. Market ownership transferred to user
 *
 * Flow:
 * - First request (no X-Payment): Returns 402 with payment quote
 * - Second request (with X-Payment): Processes payment and creates market
 */

interface CreateMarketRequest {
  yesSymbol: string;
  yesUri?: string;
  startSlot?: number;
  endingSlot?: number;
  lmsrB: number;
  creator: string;  // User's Solana wallet address who will own the market
}

interface CreateMarketResponse {
  success: boolean;
  marketAddress?: string;
  signature?: string;
  message: string;
  error?: string;
  details?: {
    yesSymbol: string;
    creator: string;
    lmsrB: number;
  };
}

// Market creation fee in USDC
const MARKET_CREATION_FEE = 1.0; // 1 USDC to create a market

/**
 * Create Market API
 * POST /api/create-market
 * Processes x402 payment and creates prediction market
 */
export async function POST(req: NextRequest): Promise<NextResponse<CreateMarketResponse | any>> {
  try {
    const body: CreateMarketRequest = await req.json();

    // Validate required fields
    if (!body.yesSymbol || !body.lmsrB || !body.creator) {
      return NextResponse.json({
        success: false,
        message: 'Invalid request',
        error: 'Missing required fields: yesSymbol, lmsrB, creator',
      }, { status: 400 });
    }

    // Validate lmsrB
    if (body.lmsrB <= 0) {
      return NextResponse.json({
        success: false,
        message: 'Invalid LMSR B parameter',
        error: 'LMSR B must be greater than 0',
      }, { status: 400 });
    }

    // Validate creator address
    let creatorAddress: PublicKey;
    try {
      creatorAddress = new PublicKey(body.creator);
    } catch (e) {
      return NextResponse.json({
        success: false,
        message: 'Invalid creator address',
        error: 'Creator address is not a valid Solana public key',
      }, { status: 400 });
    }

    console.log('[create-market] Processing create market request:', {
      yesSymbol: body.yesSymbol,
      lmsrB: body.lmsrB,
      creator: body.creator,
    });

    // Check if this is an x402 payment request (has X-Payment header)
    const xPaymentHeader = req.headers.get('X-Payment');

    // If no payment header, return 402 Payment Required with payment quote
    if (!xPaymentHeader) {
      console.log('[create-market] No X-Payment header, returning 402 payment quote...');

      // Get recipient's USDC token account
      const connection = new Connection(SOLANA_CONFIG.rpcUrl, SOLANA_CONFIG.commitment);

      // Select correct USDC mint based on environment
      const usdcMintAddress = process.env.NODE_ENV === 'production'
        ? SOLANA_CONFIG.usdcMint.mainnet
        : SOLANA_CONFIG.usdcMint.devnet;
      const usdcMint = new PublicKey(usdcMintAddress);

      const recipientWallet = new PublicKey(X402_CONFIG.paymentAddress);
      const recipientTokenAccount = await getAssociatedTokenAddress(
        usdcMint,
        recipientWallet
      );

      // Return 402 with payment details
      return NextResponse.json({
        payment: {
          tokenAccount: recipientTokenAccount.toBase58(),
          mint: usdcMintAddress,
          amount: Math.floor(MARKET_CREATION_FEE * 1e6), // Convert to lamports (6 decimals)
          amountUSDC: MARKET_CREATION_FEE,
          cluster: X402_CONFIG.network,
        },
      }, { status: 402 });
    }

    // Payment header exists - process the payment and create market
    console.log('[create-market] X402 payment detected, processing payment transaction...');

    // Initialize connection
    const connection = new Connection(SOLANA_CONFIG.rpcUrl, SOLANA_CONFIG.commitment);

    // Decode and submit the payment transaction
    try {
      // Decode the payment proof
      const paymentProofJson = Buffer.from(xPaymentHeader, 'base64').toString('utf-8');
      const paymentProof = JSON.parse(paymentProofJson);

      if (!paymentProof.payload?.serializedTransaction) {
        throw new Error('Missing serialized transaction in payment proof');
      }

      // Deserialize and submit the user's signed USDC payment transaction
      const paymentTxBuffer = Buffer.from(paymentProof.payload.serializedTransaction, 'base64');
      const paymentTx = Transaction.from(paymentTxBuffer);

      console.log('[create-market] Submitting user USDC payment transaction...');
      const paymentSignature = await connection.sendRawTransaction(
        paymentTx.serialize(),
        {
          skipPreflight: true, // Skip simulation to avoid blockhash expiration issues
          maxRetries: 3,
        }
      );
      console.log('[create-market] Payment transaction submitted:', paymentSignature);

      // Wait for confirmation
      await connection.confirmTransaction(paymentSignature, 'confirmed');
      console.log('[create-market] ✓ Payment transaction confirmed');
    } catch (err: any) {
      console.error('[create-market] Failed to process payment transaction:', err);
      return NextResponse.json({
        success: false,
        message: 'Payment transaction failed',
        error: err.message || 'Failed to submit payment transaction',
      }, { status: 500 });
    }

    // Load backend wallet
    const privateKeyString = process.env.X402_BACKEND_PRIVATE_KEY;
    if (!privateKeyString) {
      console.error('[create-market] X402_BACKEND_PRIVATE_KEY not configured');
      return NextResponse.json({
        success: false,
        message: 'Server configuration error',
        error: 'Backend wallet not configured',
      }, { status: 500 });
    }

    let backendWallet: Keypair;
    try {
      const secretKey = bs58.decode(privateKeyString);
      backendWallet = Keypair.fromSecretKey(secretKey);
      console.log('[create-market] Backend wallet loaded:', backendWallet.publicKey.toBase58());
    } catch (e) {
      console.error('[create-market] Failed to decode private key:', e);
      return NextResponse.json({
        success: false,
        message: 'Server configuration error',
        error: 'Invalid backend wallet configuration',
      }, { status: 500 });
    }

    // Check backend wallet balance
    try {
      const balance = await connection.getBalance(backendWallet.publicKey);
      const solBalance = balance / 1e9;
      console.log('[create-market] Backend wallet balance:', solBalance, 'SOL');

      if (solBalance < 0.1) {
        return NextResponse.json({
          success: false,
          message: 'Insufficient backend wallet balance',
          error: `Backend wallet has insufficient SOL for gas fees. Current: ${solBalance} SOL`,
        }, { status: 500 });
      }
    } catch (e) {
      console.error('[create-market] Failed to check wallet balance:', e);
    }

    // Create wallet adapter
    const walletAdapter = {
      publicKey: backendWallet.publicKey,
      signTransaction: async (tx: any) => {
        // Use partialSign to add signature without replacing existing ones
        tx.partialSign(backendWallet);
        return tx;
      },
      signAllTransactions: async (txs: any[]) => {
        return txs.map((tx: any) => {
          tx.partialSign(backendWallet);
          return tx;
        });
      },
      sendTransaction: async (tx: any, conn: Connection) => {
        tx.partialSign(backendWallet);
        const signature = await conn.sendRawTransaction(tx.serialize());
        return signature;
      },
    };

    // Initialize prediction market client with backend wallet
    const client = new PredictionMarketClient(connection, walletAdapter);

    // Create the market
    console.log('[create-market] Creating market...');
    const result = await client.createMarket({
      yesSymbol: body.yesSymbol,
      yesUri: body.yesUri || '',
      startSlot: body.startSlot,
      endingSlot: body.endingSlot,
      lmsrB: body.lmsrB,
    });

    if (result.success) {
      console.log('[create-market] Market created successfully:', result.signature);

      // Extract market address from result if available
      // Note: You may need to adjust this based on your client implementation
      const marketAddress = result.marketAddress || 'Unknown';

      return NextResponse.json({
        success: true,
        signature: result.signature,
        marketAddress,
        message: 'Market created successfully',
        details: {
          yesSymbol: body.yesSymbol,
          creator: body.creator,
          lmsrB: body.lmsrB,
        },
      });
    } else {
      console.error('[create-market] Market creation failed:', result.error);

      return NextResponse.json({
        success: false,
        message: 'Market creation failed',
        error: result.error || 'Unknown error occurred',
        details: {
          yesSymbol: body.yesSymbol,
          creator: body.creator,
          lmsrB: body.lmsrB,
        },
      }, { status: 500 });
    }
  } catch (error: unknown) {
    console.error('[create-market] Unexpected error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      error: errorMessage,
    }, { status: 500 });
  }
}
