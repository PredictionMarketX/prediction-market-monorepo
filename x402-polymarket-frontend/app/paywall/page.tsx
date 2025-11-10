"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@/app/hooks/wallet";
import { BlockchainType } from "@/app/utils/wallet";
import { verifyPayment } from "../actions";
import { PaymentRequirements, PaymentPayload } from "x402/types";
import { preparePaymentHeader } from "x402/client";
import { getNetworkId } from "x402/shared";
import { exact } from "x402/schemes";
import { useSignTypedData } from "wagmi";
import {
  Transaction,
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

/**
 * Payment configuration for different content types
 */
interface PaymentConfig {
  amount: string;
  description: string;
  recipient: string;
}

const DEFAULT_CONFIG: PaymentConfig = {
  amount: "0.01",
  description: "Custom payment",
  recipient: "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
};

// Solana recipient address
const SOLANA_RECIPIENT = process.env.NEXT_PUBLIC_SOLANA_RECIPIENT || "CmGgLQL36Y9ubtTsy2zmE46TAxwCBm66onZmPPhUWNqv";

/**
 * EVM Payment Form Component
 */
function EVMPaymentForm({
  paymentRequirements,
  amount,
  description,
  onSuccess,
}: {
  paymentRequirements: PaymentRequirements;
  amount: string;
  description: string;
  onSuccess: () => void;
}) {
  const { evmWallet } = useWallet();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>("");
  const { signTypedDataAsync } = useSignTypedData();

  const handlePayment = async () => {
    if (!evmWallet.address) {
      setError("Please connect your EVM wallet");
      return;
    }

    try {
      setIsProcessing(true);
      setError("");

      // Prepare unsigned payment header
      const unSignedPaymentHeader = preparePaymentHeader(
        evmWallet.address,
        1,
        paymentRequirements
      );

      // Prepare EIP-712 data for signing
      const eip712Data = {
        types: {
          TransferWithAuthorization: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
            { name: "validAfter", type: "uint256" },
            { name: "validBefore", type: "uint256" },
            { name: "nonce", type: "bytes32" },
          ],
        },
        domain: {
          name: paymentRequirements.extra?.name,
          version: paymentRequirements.extra?.version,
          chainId: getNetworkId(paymentRequirements.network),
          verifyingContract: paymentRequirements.asset as `0x${string}`,
        },
        primaryType: "TransferWithAuthorization" as const,
        message: unSignedPaymentHeader.payload.authorization,
      };

      // Sign the payment
      const signature = await signTypedDataAsync(eip712Data);

      // Create payment payload
      const paymentPayload: PaymentPayload = {
        ...unSignedPaymentHeader,
        payload: {
          ...unSignedPaymentHeader.payload,
          signature,
        },
      };

      // Encode payment
      const payment: string = exact.evm.encodePayment(paymentPayload);

      // Verify payment on server with dynamic amount and description
      const result = await verifyPayment(payment, amount, description);

      if (result.startsWith("Error")) {
        throw new Error(result);
      }

      console.log("Payment verified:", result);
      onSuccess();
    } catch (err) {
      console.error("Payment error:", err);
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">EVM Payment Details</h3>
        <div className="text-sm space-y-1">
          <p>
            <span className="text-gray-600 dark:text-gray-400">Amount:</span>{" "}
            ${amount} USD
          </p>
          <p>
            <span className="text-gray-600 dark:text-gray-400">To:</span>{" "}
            {paymentRequirements.payTo.slice(0, 10)}...
          </p>
          <p>
            <span className="text-gray-600 dark:text-gray-400">Network:</span>{" "}
            {paymentRequirements.network}
          </p>
          <p>
            <span className="text-gray-600 dark:text-gray-400">
              Description:
            </span>{" "}
            {description}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <button
        disabled={!evmWallet.address || isProcessing}
        onClick={handlePayment}
        className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
          !evmWallet.address || isProcessing
            ? "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-700 text-white"
        }`}
      >
        {isProcessing ? "Processing Payment..." : "Pay with EVM Wallet"}
      </button>
    </div>
  );
}

/**
 * Solana Payment Form Component
 */
function SolanaPaymentForm({
  amount,
  description,
  recipient,
  onSuccess,
}: {
  amount: string;
  description: string;
  recipient: string;
  onSuccess: () => void;
}) {
  const { solanaWallet } = useWallet();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>("");

  const handlePayment = async () => {
    if (!solanaWallet.publicKey || !solanaWallet.connection) {
      setError("Please connect your Solana wallet");
      return;
    }

    try {
      setIsProcessing(true);
      setError("");

      // Validate recipient address
      let recipientPubkey: PublicKey;
      try {
        recipientPubkey = new PublicKey(recipient);
      } catch (err) {
        throw new Error("Invalid recipient address");
      }

      // Convert amount to lamports
      const amountInSol = parseFloat(amount);
      if (isNaN(amountInSol) || amountInSol <= 0) {
        throw new Error("Invalid amount");
      }
      const lamports = Math.floor(amountInSol * LAMPORTS_PER_SOL);

      // Check balance
      const balance = await solanaWallet.connection.getBalance(solanaWallet.publicKey);
      if (balance < lamports) {
        throw new Error(`Insufficient balance. You have ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL, but need ${amountInSol} SOL`);
      }

      // Create transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: solanaWallet.publicKey,
          toPubkey: recipientPubkey,
          lamports,
        })
      );

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await solanaWallet.connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = solanaWallet.publicKey;

      // Send and confirm transaction
      const signature = await solanaWallet.sendTransaction(transaction);
      
      console.log("Solana payment sent:", signature);
      console.log("Waiting for confirmation...");

      // Wait for confirmation
      const confirmation = await solanaWallet.connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      if (confirmation.value.err) {
        throw new Error("Transaction failed: " + JSON.stringify(confirmation.value.err));
      }

      console.log("✅ Payment confirmed!");
      console.log("Amount:", amount, "SOL");
      console.log("Description:", description);
      console.log("Signature:", signature);

      // In a real app, you'd verify this payment on your backend
      onSuccess();
    } catch (err) {
      console.error("Solana payment error:", err);
      let errorMessage = "Payment failed";
      
      if (err instanceof Error) {
        errorMessage = err.message;
        
        // Provide more helpful error messages
        if (errorMessage.includes("User rejected")) {
          errorMessage = "Transaction was rejected by user";
        } else if (errorMessage.includes("insufficient")) {
          errorMessage = "Insufficient SOL balance. Please get some devnet SOL from https://faucet.solana.com/";
        } else if (errorMessage.includes("blockhash")) {
          errorMessage = "Transaction expired. Please try again.";
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Solana Payment Details</h3>
        <div className="text-sm space-y-1">
          <p>
            <span className="text-gray-600 dark:text-gray-400">Amount:</span>{" "}
            {amount} SOL
          </p>
          <p>
            <span className="text-gray-600 dark:text-gray-400">To:</span>{" "}
            {recipient.slice(0, 10)}...
          </p>
          <p>
            <span className="text-gray-600 dark:text-gray-400">Network:</span>{" "}
            Solana Devnet
          </p>
          <p>
            <span className="text-gray-600 dark:text-gray-400">
              Description:
            </span>{" "}
            {description}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <button
        disabled={!solanaWallet.publicKey || isProcessing}
        onClick={handlePayment}
        className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
          !solanaWallet.publicKey || isProcessing
            ? "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
            : "bg-purple-600 hover:bg-purple-700 text-white"
        }`}
      >
        {isProcessing ? "Processing Payment..." : "Pay with Solana Wallet"}
      </button>
    </div>
  );
}

/**
 * Paywall Content Component (uses useSearchParams)
 */
function PaywallContent() {
  const { chainType, isConnected, address } = useWallet();
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const searchParams = useSearchParams();

  // Get dynamic amount and description from URL params
  const amount = searchParams.get("amount") || DEFAULT_CONFIG.amount;
  const description = searchParams.get("description") || DEFAULT_CONFIG.description;

  // Convert amount to USDC with 6 decimals (for EVM)
  const amountInUSDC = Math.floor(parseFloat(amount) * 1_000_000).toString();

  // EVM payment requirements for x402 with dynamic amount
  const evmPaymentRequirements: PaymentRequirements = {
    scheme: "exact",
    network: "base-sepolia",
    maxAmountRequired: amountInUSDC, // Dynamic amount in USDC (6 decimals)
    resource: "https://example.com",
    description: description,
    mimeType: "text/html",
    payTo: DEFAULT_CONFIG.recipient,
    maxTimeoutSeconds: 60,
    asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC on Base Sepolia
    outputSchema: undefined,
    extra: {
      name: "USDC",
      version: "2",
    },
  };

  const handlePaymentSuccess = () => {
    setPaymentSuccess(true);
    // Redirect after short delay
    setTimeout(() => {
      window.location.href = "/";
    }, 2000);
  };

  if (paymentSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-12 max-w-md text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold mb-2">Payment Successful!</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Redirecting you to the content...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-2">Payment Required</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Connect your wallet using the header and proceed with payment
          </p>
        </div>

        {/* Current Chain Display */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Selected Chain:
            </span>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
              chainType === BlockchainType.EVM
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
            }`}>
              {chainType === BlockchainType.EVM ? 'EVM' : 'Solana'}
            </span>
          </div>
          {isConnected && (
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Connected: {chainType === BlockchainType.EVM
                  ? `${address?.slice(0, 6)}...${address?.slice(-4)}`
                  : `${address?.slice(0, 6)}...${address?.slice(-4)}`
                }
              </span>
            </div>
          )}
        </div>

        {/* Payment Form */}
        {isConnected ? (
          <div>
            {chainType === BlockchainType.EVM ? (
              <EVMPaymentForm
                paymentRequirements={evmPaymentRequirements}
                amount={amount}
                description={description}
                onSuccess={handlePaymentSuccess}
              />
            ) : (
              <SolanaPaymentForm
                amount={amount}
                description={description}
                recipient={SOLANA_RECIPIENT}
                onSuccess={handlePaymentSuccess}
              />
            )}
          </div>
        ) : (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Please connect your wallet to proceed with payment
            </p>
          </div>
        )}

        {/* Info */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            {chainType === BlockchainType.EVM
              ? "Powered by x402 Protocol on Base Sepolia"
              : "Powered by Solana Devnet"}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Main Paywall Component with Suspense boundary
 */
export default function Paywall() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-12 max-w-md text-center">
          <div className="text-2xl mb-4">Loading...</div>
        </div>
      </div>
    }>
      <PaywallContent />
    </Suspense>
  );
}
