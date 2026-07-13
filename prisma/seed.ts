import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";
import { LEARN_TRAITS, TRAIT_COUNT } from "../src/lib/wallai/learn/traits";
import { DEFAULT_TAXONOMY, GROUP_COLORS } from "../src/lib/wallai/default-taxonomy";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

type SeedBook = {
  externalId: string;      // external provider ID (Open Library work key or legacy Google Books)
  title: string;
  author: string;
  category: string;
  year?: number;
  coverUrl?: string;
  description?: string;
  traits: number[];        // length 20, values 0-10
  popularity?: number;     // 0-100; foundational classics 95+, niche 50-
};

// Foundational popularity tiers — used when no profile exists (starter bundle)
// and as a boost in profile-based scoring. Higher = more-recommended to everyone.
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

// Scored by hand. Each vector is LEARN_TRAITS order. High values mark
// pillars the book actually teaches; fill non-central traits with 0-3.
const CURATED_BOOKS: SeedBook[] = [
  {
    externalId: "bK06kgAACAAJ",
    title: "The Psychology of Money",
    author: "Morgan Housel",
    category: "mindset",
    year: 2020,
    coverUrl: "https://books.google.com/books/content?id=bK06kgAACAAJ&printsec=frontcover&img=1&zoom=1",
    description: "Timeless lessons on wealth, greed, and happiness.",
    //          bud sav dbt crd tax ins ret est emg rsk idx stk re  cry ent psy fru pas mac fi
    traits:    [  2,  4,  1,  0,  0,  0,  3,  0,  2,  7,  4,  3,  1,  1,  2,  10, 3,  2,  3,  6],
  },
  {
    externalId: "OMKrDwAAQBAJ",
    title: "Rich Dad Poor Dad",
    author: "Robert Kiyosaki",
    category: "mindset",
    year: 1997,
    description: "Two fathers, two views of money; the asset/liability distinction.",
    traits:    [  3,  3,  2,  1,  2,  1,  2,  1,  2,  6,  2,  3,  7,  0,  8,  9,  2,  8,  3,  7],
  },
  {
    externalId: "LIjCwAEACAAJ",
    title: "The Intelligent Investor",
    author: "Benjamin Graham",
    category: "investing",
    year: 1949,
    description: "Value investing principles from Warren Buffett's teacher.",
    traits:    [  1,  2,  1,  0,  1,  0,  3,  1,  1,  9,  5,  10, 1,  0,  1,  6,  2,  1,  5,  5],
  },
  {
    externalId: "kb0IBAAAQBAJ",
    title: "A Random Walk Down Wall Street",
    author: "Burton Malkiel",
    category: "investing",
    year: 1973,
    description: "Efficient markets and the case for index funds.",
    traits:    [  1,  2,  1,  0,  2,  0,  4,  0,  1,  8,  10, 6,  2,  0,  1,  4,  1,  2,  6,  4],
  },
  {
    externalId: "dNq8yBjnzvMC",
    title: "The Bogleheads' Guide to Investing",
    author: "Taylor Larimore",
    category: "investing",
    year: 2006,
    description: "Community wisdom on low-cost index investing.",
    traits:    [  4,  6,  2,  1,  6,  2,  9,  3,  5,  7,  10, 3,  1,  0,  0,  4,  5,  2,  3,  9],
  },
  {
    externalId: "dMZFDwAAQBAJ",
    title: "The Millionaire Next Door",
    author: "Thomas J. Stanley",
    category: "mindset",
    year: 1996,
    description: "Who the rich really are — habits of accumulators.",
    traits:    [  5,  9,  3,  2,  3,  2,  6,  3,  6,  5,  4,  2,  3,  0,  4,  8,  10, 3,  2,  8],
  },
  {
    externalId: "8R-DCwAAQBAJ",
    title: "Your Money or Your Life",
    author: "Vicki Robin",
    category: "mindset",
    year: 1992,
    description: "Redefine your relationship with money and time.",
    traits:    [  6,  9,  4,  2,  3,  3,  5,  3,  7,  5,  6,  1,  1,  0,  1,  9,  10, 5,  2,  10],
  },
  {
    externalId: "LvbXb3_nyEMC",
    title: "I Will Teach You to Be Rich",
    author: "Ramit Sethi",
    category: "budgeting",
    year: 2009,
    description: "A 6-week program for twentysomethings.",
    traits:    [  9,  8,  7,  8,  4,  3,  8,  2,  6,  5,  8,  2,  2,  0,  2,  7,  4,  3,  2,  6],
  },
  {
    externalId: "pSeDDAAAQBAJ",
    title: "The Simple Path to Wealth",
    author: "JL Collins",
    category: "investing",
    year: 2016,
    description: "Stock-series clarity: live below your means, invest in a total-market fund.",
    traits:    [  5,  9,  3,  1,  4,  1,  7,  2,  6,  6,  10, 1,  1,  0,  0,  7,  8,  3,  3,  10],
  },
  {
    externalId: "jPGJAgAAQBAJ",
    title: "Think and Grow Rich",
    author: "Napoleon Hill",
    category: "mindset",
    year: 1937,
    description: "Classic mindset and goal-setting manual.",
    traits:    [  1,  2,  1,  0,  0,  0,  1,  0,  1,  5,  1,  1,  1,  0,  7,  10, 1,  2,  1,  4],
  },
  {
    externalId: "EmJDnwEACAAJ",
    title: "The Richest Man in Babylon",
    author: "George S. Clason",
    category: "saving",
    year: 1926,
    description: "Parables on saving, investing, and debt.",
    traits:    [  7,  10, 7,  2,  1,  2,  3,  2,  5,  4,  2,  1,  2,  0,  3,  6,  8,  3,  1,  6],
  },
  {
    externalId: "vYylw2fMOCYC",
    title: "The Total Money Makeover",
    author: "Dave Ramsey",
    category: "debt",
    year: 2003,
    description: "Seven baby steps out of debt.",
    traits:    [  8,  8,  10, 7,  2,  4,  5,  2,  9,  4,  3,  0,  1,  0,  1,  6,  6,  1,  1,  5],
  },
  {
    externalId: "Jf4oDwAAQBAJ",
    title: "The Little Book of Common Sense Investing",
    author: "John C. Bogle",
    category: "investing",
    year: 2007,
    description: "The only way to guarantee your fair share of market returns.",
    traits:    [  1,  3,  1,  0,  2,  0,  6,  1,  2,  6,  10, 3,  1,  0,  0,  4,  3,  2,  4,  6],
  },
  {
    externalId: "TvHGDgAAQBAJ",
    title: "One Up On Wall Street",
    author: "Peter Lynch",
    category: "investing",
    year: 1989,
    description: "How an amateur can use what they already know to pick stocks.",
    traits:    [  1,  1,  1,  0,  1,  0,  3,  0,  1,  8,  3,  10, 2,  0,  2,  5,  2,  2,  4,  3],
  },
  {
    externalId: "tZf3EAAAQBAJ",
    title: "Security Analysis",
    author: "Benjamin Graham",
    category: "investing",
    year: 1934,
    description: "The definitive value-investing text.",
    traits:    [  1,  1,  1,  0,  2,  0,  2,  1,  1,  9,  3,  10, 2,  0,  1,  3,  1,  1,  6,  3],
  },
  {
    externalId: "zqtBY5X_Eq8C",
    title: "The Wealthy Barber",
    author: "David Chilton",
    category: "mindset",
    year: 1989,
    description: "Common-sense financial planning in story form.",
    traits:    [  7,  9,  5,  3,  4,  5,  7,  4,  6,  4,  5,  1,  3,  0,  1,  5,  7,  3,  2,  7],
  },
  {
    externalId: "4gpfUI4avAEC",
    title: "Millionaire Teacher",
    author: "Andrew Hallam",
    category: "investing",
    year: 2011,
    description: "Nine rules of wealth you should have learned in school.",
    traits:    [  4,  8,  2,  1,  3,  1,  7,  2,  4,  6,  10, 2,  1,  0,  0,  6,  8,  2,  3,  8],
  },
  {
    externalId: "xTQuDwAAQBAJ",
    title: "Broke Millennial",
    author: "Erin Lowry",
    category: "budgeting",
    year: 2017,
    description: "Stop scraping by and get your financial life together.",
    traits:    [  9,  8,  8,  9,  5,  3,  4,  1,  8,  4,  4,  1,  1,  0,  1,  6,  5,  1,  2,  5],
  },
  {
    externalId: "OmLgDAAAQBAJ",
    title: "The Index Card",
    author: "Helaine Olen",
    category: "investing",
    year: 2016,
    description: "Why personal finance doesn't have to be complicated.",
    traits:    [  7,  8,  6,  4,  5,  6,  8,  4,  7,  5,  9,  1,  1,  0,  0,  5,  5,  2,  2,  7],
  },
  {
    externalId: "71FyBQAAQBAJ",
    title: "Money: Master the Game",
    author: "Tony Robbins",
    category: "investing",
    year: 2014,
    description: "Seven simple steps to financial freedom.",
    traits:    [  5,  7,  4,  3,  5,  4,  8,  4,  5,  6,  8,  3,  2,  1,  3,  7,  4,  4,  4,  8],
  },
  {
    externalId: "7lALCwAAQBAJ",
    title: "The Barefoot Investor",
    author: "Scott Pape",
    category: "budgeting",
    year: 2016,
    description: "The only money guide you'll ever need.",
    traits:    [  10, 9,  7,  6,  4,  6,  8,  3,  9,  4,  7,  1,  2,  0,  1,  5,  6,  2,  1,  7],
  },
  {
    externalId: "d5k_DwAAQBAJ",
    title: "Financial Freedom",
    author: "Grant Sabatier",
    category: "mindset",
    year: 2019,
    description: "A proven path to all the money you will ever need.",
    traits:    [  6,  8,  5,  3,  4,  3,  5,  2,  6,  6,  7,  2,  4,  0,  6,  7,  6,  6,  2,  10],
  },
  {
    externalId: "2wJHzQEACAAJ",
    title: "Die With Zero",
    author: "Bill Perkins",
    category: "mindset",
    year: 2020,
    description: "Getting all you can from your money and your life.",
    traits:    [  3,  4,  2,  1,  2,  2,  7,  6,  3,  5,  3,  1,  1,  0,  1,  9,  2,  3,  2,  6],
  },
  {
    externalId: "z8VmDwAAQBAJ",
    title: "The Psychology of Investing",
    author: "John R. Nofsinger",
    category: "investing",
    year: 2001,
    description: "Behavioral finance for everyday investors.",
    traits:    [  1,  2,  1,  0,  1,  0,  3,  0,  1,  9,  6,  7,  1,  1,  1,  10, 2,  2,  4,  3],
  },
  {
    externalId: "AB86CAAAQBAJ",
    title: "Unshakeable",
    author: "Tony Robbins",
    category: "investing",
    year: 2017,
    description: "Your financial freedom playbook.",
    traits:    [  3,  5,  2,  1,  3,  2,  7,  2,  3,  7,  8,  2,  1,  0,  2,  8,  3,  3,  5,  7],
  },
  {
    externalId: "nG5zBgAAQBAJ",
    title: "The 4-Hour Workweek",
    author: "Timothy Ferriss",
    category: "entrepreneurship",
    year: 2007,
    description: "Escape 9-5, live anywhere, join the new rich.",
    traits:    [  2,  3,  1,  0,  1,  0,  1,  0,  1,  6,  1,  1,  1,  0,  10, 7,  3,  9,  1,  7],
  },
  {
    externalId: "tJjBDwAAQBAJ",
    title: "Set for Life",
    author: "Scott Trench",
    category: "mindset",
    year: 2017,
    description: "Dominate life, money, and the American dream.",
    traits:    [  7,  8,  5,  3,  3,  2,  4,  1,  6,  6,  5,  1,  9,  0,  5,  6,  7,  7,  2,  9],
  },
  {
    externalId: "0SRjDwAAQBAJ",
    title: "Quit Like a Millionaire",
    author: "Kristy Shen",
    category: "investing",
    year: 2019,
    description: "No gimmicks, luck, or trust fund required.",
    traits:    [  6,  9,  3,  2,  6,  2,  7,  2,  5,  6,  10, 2,  2,  0,  1,  7,  9,  3,  4,  10],
  },
  {
    externalId: "dkl_qjE_u68C",
    title: "Early Retirement Extreme",
    author: "Jacob Lund Fisker",
    category: "frugality",
    year: 2010,
    description: "A philosophical and practical guide to financial independence.",
    traits:    [  8,  10, 4,  2,  4,  2,  5,  2,  7,  4,  7,  1,  2,  0,  2,  8,  10, 4,  4,  10],
  },
  {
    externalId: "OBnZzQEACAAJ",
    title: "The Millionaire Fastlane",
    author: "MJ DeMarco",
    category: "entrepreneurship",
    year: 2011,
    description: "Crack the code to wealth and live rich for a lifetime.",
    traits:    [  2,  3,  3,  1,  2,  1,  2,  1,  2,  7,  1,  1,  5,  0,  10, 8,  2,  8,  3,  7],
  },
];

// Sanity check every vector at startup.
for (const b of CURATED_BOOKS) {
  if (b.traits.length !== TRAIT_COUNT) {
    throw new Error(`Seed book "${b.title}" has ${b.traits.length} traits, expected ${TRAIT_COUNT}`);
  }
  for (const n of b.traits) {
    if (n < 0 || n > 10) {
      throw new Error(`Seed book "${b.title}" has out-of-range trait: ${n}`);
    }
  }
}

async function main() {
  // The admin account. Login: type "admin" (mapped to this email) / password below.
  const adminPasswordHash = await bcrypt.hash("adminwallai", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@wallai.app" },
    update: {
      // Keep the admin promoted and its password in sync with the seed.
      role: "admin",
      passwordHash: adminPasswordHash,
    },
    create: {
      name: "Admin",
      email: "admin@wallai.app",
      passwordHash: adminPasswordHash,
      primaryCurrency: "EUR",
      role: "admin",
    },
  });

  console.log("Seeded admin user:", admin.email, `(role=${admin.role})`);

  // Seed default category taxonomy for every existing user (idempotent).
  const allUsers = await prisma.user.findMany({ select: { id: true } });
  for (const u of allUsers) {
    const existing = await prisma.category.findMany({
      where: { userId: u.id },
      select: { name: true },
    });
    const have = new Set(existing.map((c) => c.name));
    const missing = DEFAULT_TAXONOMY.filter((t) => !have.has(t.name));
    let order = have.size;
    for (const t of missing) {
      await prisma.category.create({
        data: {
          userId: u.id,
          name: t.name,
          kind: t.kind,
          group: t.group,
          color: t.color ?? GROUP_COLORS[t.group] ?? null,
          icon: t.icon ?? null,
          isDefault: true,
          sortOrder: order++,
        },
      });
    }
    // Link parents by name.
    const rows = await prisma.category.findMany({
      where: { userId: u.id },
      select: { id: true, name: true },
    });
    const idByName = new Map(rows.map((r) => [r.name, r.id]));
    for (const t of DEFAULT_TAXONOMY) {
      if (!t.parent) continue;
      const parentId = idByName.get(t.parent);
      const childId = idByName.get(t.name);
      if (parentId && childId) {
        await prisma.category.update({ where: { id: childId }, data: { parentId } });
      }
    }
  }
  console.log(`Seeded categories for ${allUsers.length} user(s).`);

  // Seed financial tips
  const tips = [
    { content: "The best time to start investing was yesterday. The second best time is now.", type: "quote", author: "Chinese Proverb", category: "investing" },
    { content: "Do not save what is left after spending, but spend what is left after saving.", type: "quote", author: "Warren Buffett", category: "saving" },
    { content: "A budget is telling your money where to go instead of wondering where it went.", type: "quote", author: "Dave Ramsey", category: "budgeting" },
    { content: "Compound interest is the eighth wonder of the world. He who understands it, earns it; he who doesn't, pays it.", type: "quote", author: "Albert Einstein", category: "investing" },
    { content: "It's not how much money you make, but how much money you keep.", type: "quote", author: "Robert Kiyosaki", category: "saving" },
    { content: "Rule No. 1: Never lose money. Rule No. 2: Never forget Rule No. 1.", type: "quote", author: "Warren Buffett", category: "investing" },
    { content: "Set up automatic transfers to your savings account on payday. You can't spend what you don't see.", type: "advice", author: null, category: "saving" },
    { content: "Keep 3-6 months of expenses in a separate emergency fund. Don't touch it for anything else.", type: "advice", author: null, category: "saving" },
    { content: "Review all your subscriptions monthly. Cancel anything you haven't used in 30 days.", type: "advice", author: null, category: "budgeting" },
    { content: "Pay off your highest-interest debt first (avalanche method) to minimize total interest paid.", type: "advice", author: null, category: "debt" },
    { content: "Never invest money you can't afford to lose. Build your emergency fund first.", type: "advice", author: null, category: "investing" },
    { content: "Track every expense for one month. You'll be surprised where your money goes.", type: "advice", author: null, category: "budgeting" },
    { content: "The 50/30/20 rule: 50% needs, 30% wants, 20% savings. Adjust as needed, but start there.", type: "advice", author: null, category: "budgeting" },
    { content: "Financial freedom is not about being rich. It's about having enough.", type: "quote", author: "Vicki Robin", category: "mindset" },
    { content: "Wealth consists not in having great possessions, but in having few wants.", type: "quote", author: "Epictetus", category: "mindset" },
  ];

  // Use createMany to avoid the upsert id issue
  const existingCount = await prisma.financialTip.count();
  if (existingCount === 0) {
    await prisma.financialTip.createMany({ data: tips });
    console.log(`Seeded ${tips.length} financial tips`);
  } else {
    console.log(`Financial tips already exist (${existingCount}), skipping`);
  }

  // Wipe then re-seed to guarantee the curated catalogue matches the codebase.
  await prisma.book.deleteMany({});
  for (const b of CURATED_BOOKS) {
    await prisma.book.create({
      data: {
        externalId: b.externalId,
        title: b.title,
        author: b.author,
        category: b.category,
        year: b.year ?? null,
        coverUrl: b.coverUrl ?? null,
        description: b.description ?? null,
        traits: b.traits,
        traitSource: "curated",
        traitsGeneratedAt: new Date(),
        popularity: POPULARITY[b.title] ?? b.popularity ?? 50,
      },
    });
  }
  console.log(`Seeded ${CURATED_BOOKS.length} curated books.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
