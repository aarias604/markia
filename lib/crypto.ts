// Markia · Billeteras para pagos con cripto (manual, vía Lulubit). Solo servidor.
// Configura en Vercel hasta 2 billeteras:
//   CRYPTO_WALLET_1_NETWORK = USDT · Tron (TRC20)
//   CRYPTO_WALLET_1_ADDRESS = T...
//   CRYPTO_WALLET_2_NETWORK = USDT · Ethereum (ERC20)   (opcional)
//   CRYPTO_WALLET_2_ADDRESS = 0x...                     (opcional)

export interface CryptoWallet {
  network: string;
  address: string;
}

export function cryptoWallets(): CryptoWallet[] {
  return [1, 2]
    .map((n) => ({
      network: (process.env[`CRYPTO_WALLET_${n}_NETWORK`] ?? "").trim(),
      address: (process.env[`CRYPTO_WALLET_${n}_ADDRESS`] ?? "").trim(),
    }))
    .filter((w) => w.network && w.address);
}
