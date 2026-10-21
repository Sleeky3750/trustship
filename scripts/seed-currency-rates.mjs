#!/usr/bin/env node
// scripts/seed-currency-rates.mjs
//
// Seeds the CurrencyRate table with NGN-based reference rates.
//
// These are STATIC seed values for UI development and previews — they are not
// a live FX feed. Production must refresh them (a cron against a rates API, or
// an admin rate editor) since `convert()` refuses to guess when a pair is
// missing.
//
// Idempotent: re-running updates the stored rate to the value below.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 1 NGN = <rate> <toCurrency>. Deliberately conservative placeholders.
const RATES = {
  USD: 0.00065,
  GBP: 0.00051,
  EUR: 0.00060,
  GHS: 0.0098,
  KES: 0.084,
  ZAR: 0.0121,
};

async function main() {
  let count = 0;
  for (const [toCurrency, rate] of Object.entries(RATES)) {
    await prisma.currencyRate.upsert({
      where: { fromCurrency_toCurrency: { fromCurrency: 'NGN', toCurrency } },
      update: { rate },
      create: { fromCurrency: 'NGN', toCurrency, rate },
    });
    // Store the inverse too so both directions resolve without inversion math.
    await prisma.currencyRate.upsert({
      where: { fromCurrency_toCurrency: { fromCurrency: toCurrency, toCurrency: 'NGN' } },
      update: { rate: 1 / rate },
      create: { fromCurrency: toCurrency, toCurrency: 'NGN', rate: 1 / rate },
    });
    count += 2;
  }
  console.log(`Seeded ${count} currency rate rows.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
