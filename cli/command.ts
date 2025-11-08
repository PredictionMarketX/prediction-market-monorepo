import { program } from "commander";
import { PublicKey } from "@solana/web3.js";
import {
  addLiquidity,
  configProject,
  createMarket,
  resolution,
  setClusterConfig,
  swap,
  withdrawLiquidity,
  ensureTeamUsdcAta,
  updateMarketFees,
} from "./scripts";

program.version("0.0.1");

programCommand("config").action(async (directory, cmd) => {
  const { env, keypair, rpc } = cmd.opts();

  console.log("Solana Cluster:", env);
  console.log("Keypair Path:", keypair);
  console.log("RPC URL:", rpc);


  await setClusterConfig(env, keypair, rpc);

  await configProject();
});

programCommand("market").action(async (directory, cmd) => {
  const { env, keypair, rpc } = cmd.opts();

  console.log("Solana Cluster:", env);
  console.log("Keypair Path:", keypair);
  console.log("RPC URL:", rpc);

  await setClusterConfig(env, keypair, rpc);

  await createMarket();
});

programCommand("swap")
  .option("-y, --yesToken <string>", "yesToken address")
  .option("-n, --noToken <string>", "noToken address")
  .option("-a, --amount <number>", "swap amount")
  .option("-s, --style <string>", "0: buy token, 1: sell token")
  .option("-t, --tokenType <string>", "0: no token, 1: yes token")
  .action(async (directory, cmd) => {
    const { env, keypair, rpc, yesToken, noToken, amount, style, tokenType } = cmd.opts();

    console.log("Solana Cluster:", env);
    console.log("Keypair Path:", keypair);
    console.log("RPC URL:", rpc);

    await setClusterConfig(env, keypair, rpc);

    if (yesToken === undefined) {
      console.log("Error yesToken address");
      return;
    }

    if (noToken === undefined) {
      console.log("Error noToken address");
      return;
    }

    if (amount === undefined) {
      console.log("Error swap amount");
      return;
    }

    if (style === undefined) {
      console.log("Error swap style");
      return;
    }

    if (tokenType === undefined) {
      console.log("Error token style");
      return;
    }

    await swap(new PublicKey(yesToken), new PublicKey(noToken), amount, style, tokenType);
  });

programCommand("resolution")
  .option("-y, --yesToken <string>", "yesToken address")
  .option("-n, --noToken <string>", "noToken address")
  .action(async (directory, cmd) => {
    const { env, keypair, rpc, yesToken, noToken } = cmd.opts();

    console.log("Solana Cluster:", env);
    console.log("Keypair Path:", keypair);
    console.log("RPC URL:", rpc);

    await setClusterConfig(env, keypair, rpc);

    if (yesToken === undefined) {
      console.log("Error yesToken address");
      return;
    }

    if (noToken === undefined) {
      console.log("Error noToken address");
      return;
    }

  await resolution(new PublicKey(yesToken), new PublicKey(noToken));
});

programCommand("ensure-team-ata").action(async (directory, cmd) => {
  const { env, keypair, rpc } = cmd.opts();

  console.log("Solana Cluster:", env);
  console.log("Keypair Path:", keypair);
  console.log("RPC URL:", rpc);

  await setClusterConfig(env, keypair, rpc);
  await ensureTeamUsdcAta();
});

programCommand("update-fees")
  .option("--buy <number>", "platform buy fee in bps (0..10000)")
  .option("--sell <number>", "platform sell fee in bps (0..10000)")
  .option("--lpBuy <number>", "lp buy fee in bps (0..10000)")
  .option("--lpSell <number>", "lp sell fee in bps (0..10000)")
  .action(async (directory, cmd) => {
    const { env, keypair, rpc, buy, sell, lpBuy, lpSell } = cmd.opts();

    console.log("Solana Cluster:", env);
    console.log("Keypair Path:", keypair);
    console.log("RPC URL:", rpc);

    await setClusterConfig(env, keypair, rpc);

    const toNum = (v: any, name: string) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 10000) {
        throw new Error(`${name} must be 0..10000 bps`);
      }
      return n;
    };

    const buyBps = toNum(buy, 'buy');
    const sellBps = toNum(sell, 'sell');
    const lpBuyBps = toNum(lpBuy, 'lpBuy');
    const lpSellBps = toNum(lpSell, 'lpSell');

    const { updateFees } = await import('./scripts');
    await updateFees(buyBps, sellBps, lpBuyBps, lpSellBps);
  });

programCommand("update-market-fees")
  .option("-y, --yesToken <string>", "yesToken address")
  .option("-n, --noToken <string>", "noToken address")
  .option("--enabled <boolean>", "enable override (true/false)")
  .option("--buy <number>", "platform buy fee in bps (0..10000)")
  .option("--sell <number>", "platform sell fee in bps (0..10000)")
  .option("--lpBuy <number>", "lp buy fee in bps (0..10000)")
  .option("--lpSell <number>", "lp sell fee in bps (0..10000)")
  .action(async (directory, cmd) => {
    const { env, keypair, rpc, yesToken, noToken, enabled, buy, sell, lpBuy, lpSell } = cmd.opts();

    console.log("Solana Cluster:", env);
    console.log("Keypair Path:", keypair);
    console.log("RPC URL:", rpc);

    await setClusterConfig(env, keypair, rpc);

    if (!yesToken || !noToken) {
      throw new Error('yesToken and noToken are required');
    }

    const toNum = (v: any, name: string) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 10000) {
        throw new Error(`${name} must be 0..10000 bps`);
      }
      return n;
    };

    const buyBps = toNum(buy, 'buy');
    const sellBps = toNum(sell, 'sell');
    const lpBuyBps = toNum(lpBuy, 'lpBuy');
    const lpSellBps = toNum(lpSell, 'lpSell');
    const enabledFlag = String(enabled).toLowerCase() === 'true';

    await updateMarketFees(
      new PublicKey(yesToken),
      new PublicKey(noToken),
      enabledFlag,
      buyBps,
      sellBps,
      lpBuyBps,
      lpSellBps,
    );
  });

programCommand("addlp")
  .option("-y, --yesToken <string>", "yesToken address")
  .option("-n, --noToken <string>", "noToken address")
  .option("-a, --amount <number>", "swap amount")
  .action(async (directory, cmd) => {
    const { env, keypair, rpc, yesToken, noToken, amount, style, tokenType } = cmd.opts();

    console.log("Solana Cluster:", env);
    console.log("Keypair Path:", keypair);
    console.log("RPC URL:", rpc);

    await setClusterConfig(env, keypair, rpc);

    if (yesToken === undefined) {
      console.log("Error yesToken address");
      return;
    }

    if (noToken === undefined) {
      console.log("Error noToken address");
      return;
    }

    if (amount === undefined) {
      console.log("Error swap amount");
      return;
    }


    await addLiquidity(new PublicKey(yesToken), new PublicKey(noToken), amount);
  });


programCommand("withdraw")
  .option("-y, --yesToken <string>", "yesToken address")
  .option("-n, --noToken <string>", "noToken address")
  .option("-a, --amount <number>", "swap amount")
  .action(async (directory, cmd) => {
    const { env, keypair, rpc, yesToken, noToken, amount, style, tokenType } = cmd.opts();

    console.log("Solana Cluster:", env);
    console.log("Keypair Path:", keypair);
    console.log("RPC URL:", rpc);

    await setClusterConfig(env, keypair, rpc);

    if (yesToken === undefined) {
      console.log("Error yesToken address");
      return;
    }

    if (noToken === undefined) {
      console.log("Error noToken address");
      return;
    }

    if (amount === undefined) {
      console.log("Error swap amount");
      return;
    }


    await withdrawLiquidity(new PublicKey(yesToken), new PublicKey(noToken), amount);
  });

programCommand("sell-preview")
  .option("-y, --yesToken <string>", "yesToken address")
  .option("-n, --noToken <string>", "noToken address")
  .option("-a, --amount <number>", "sell token amount")
  .option("-t, --tokenType <string>", "0: no token, 1: yes token")
  .option("--json", "output JSON")
  .action(async (directory, cmd) => {
    const { env, keypair, rpc, yesToken, noToken, amount, tokenType, json } = cmd.opts();

    console.log("Solana Cluster:", env);
    console.log("Keypair Path:", keypair);
    console.log("RPC URL:", rpc);

    await setClusterConfig(env, keypair, rpc);

    if (!yesToken || !noToken || amount === undefined || tokenType === undefined) {
      throw new Error('missing params');
    }

    const { sellPreview } = await import('./scripts');
    await sellPreview(new PublicKey(yesToken), new PublicKey(noToken), Number(amount), Number(tokenType), Boolean(json));
  });

programCommand("withdraw-preview")
  .option("-y, --yesToken <string>", "yesToken address")
  .option("-n, --noToken <string>", "noToken address")
  .option("-s, --shares <number>", "LP shares to preview withdraw")
  .option("--json", "output JSON")
  .action(async (directory, cmd) => {
    const { env, keypair, rpc, yesToken, noToken, shares, json } = cmd.opts();

    console.log("Solana Cluster:", env);
    console.log("Keypair Path:", keypair);
    console.log("RPC URL:", rpc);

    await setClusterConfig(env, keypair, rpc);

    if (!yesToken || !noToken || shares === undefined) {
      throw new Error('missing params');
    }

    const { withdrawPreviewView } = await import('./scripts');
    await withdrawPreviewView(new PublicKey(yesToken), new PublicKey(noToken), Number(shares), Boolean(json));
  });

programCommand("claim-fees-preview")
  .option("-y, --yesToken <string>", "yesToken address")
  .option("-n, --noToken <string>", "noToken address")
  .option("--json", "output JSON")
  .action(async (directory, cmd) => {
    const { env, keypair, rpc, yesToken, noToken, json } = cmd.opts();

    console.log("Solana Cluster:", env);
    console.log("Keypair Path:", keypair);
    console.log("RPC URL:", rpc);

    await setClusterConfig(env, keypair, rpc);

    if (!yesToken || !noToken) {
      throw new Error('missing params');
    }

    const { claimFeesPreview } = await import('./scripts');
    await claimFeesPreview(new PublicKey(yesToken), new PublicKey(noToken), Boolean(json));
  });


function programCommand(name: string) {
  return program
    .command(name)
    .option(
      //  mainnet-beta, testnet, devnet
      "-e, --env <string>",
      "Solana cluster env name",
      "devnet"
    )
    .option(
      "-r, --rpc <string>",
      "Solana cluster RPC name",
      "https://api.devnet.solana.com"
    )
    .option(
      "-k, --keypair <string>",
      "Solana wallet Keypair Path",
      "./keys/EgBcC7KVQTh1QeU3qxCFsnwZKYMMQkv6TzgEDkKvSNLv.json"
    );
}


program.parse(process.argv);

/*

yarn script config
yarn script market
yarn script addlp -y A5LmU5ZciBaJZKT9u59tasTDNrdMpGAo4WkGhmTkoBBA -n 9jnqZhBjuAjmj6qwmGBAm7ftok437prs6WkgcfLnKzrr -a 2000000000
yarn script withdraw -y A5LmU5ZciBaJZKT9u59tasTDNrdMpGAo4WkGhmTkoBBA -n 9jnqZhBjuAjmj6qwmGBAm7ftok437prs6WkgcfLnKzrr -a 2000000000
yarn script swap -y A5LmU5ZciBaJZKT9u59tasTDNrdMpGAo4WkGhmTkoBBA -n 9jnqZhBjuAjmj6qwmGBAm7ftok437prs6WkgcfLnKzrr -a 2000000000 -s 0 -t 1
yarn script resolution -y A5LmU5ZciBaJZKT9u59tasTDNrdMpGAo4WkGhmTkoBBA -n 9jnqZhBjuAjmj6qwmGBAm7ftok437prs6WkgcfLnKzrr

*/
