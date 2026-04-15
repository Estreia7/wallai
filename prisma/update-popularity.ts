import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const POPULARITY: Record<string, number> = {
  "The Psychology of Money": 100,
  "Rich Dad Poor Dad": 98,
  "The Intelligent Investor": 95,
  "I Will Teach You to Be Rich": 94,
  "The Simple Path to Wealth": 93,
  "Your Money or Your Life": 92,
  "The Millionaire Next Door": 90,
  "The Total Money Makeover": 88,
  "The Richest Man in Babylon": 87,
  "The Little Book of Common Sense Investing": 86,
  "Think and Grow Rich": 85,
  "The Bogleheads' Guide to Investing": 84,
  "The 4-Hour Workweek": 82,
  "Money: Master the Game": 80,
  "A Random Walk Down Wall Street": 78,
  "One Up On Wall Street": 76,
  "The Barefoot Investor": 75,
  "Die With Zero": 74,
  "The Wealthy Barber": 72,
  "Unshakeable": 70,
  "Millionaire Teacher": 68,
  "Broke Millennial": 66,
  "The Index Card": 64,
  "Financial Freedom": 62,
  "Set for Life": 60,
  "The Psychology of Investing": 58,
  "Quit Like a Millionaire": 56,
  "The Millionaire Fastlane": 54,
  "Security Analysis": 52,
  "Early Retirement Extreme": 50,
};

async function main() {
  let updated = 0;
  let missing: string[] = [];
  for (const [title, popularity] of Object.entries(POPULARITY)) {
    const result = await prisma.book.updateMany({
      where: { title },
      data: { popularity },
    });
    if (result.count === 0) missing.push(title);
    else updated += result.count;
  }
  console.log(`Updated ${updated} books.`);
  if (missing.length > 0) console.log(`Not in DB:\n  ${missing.join("\n  ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
