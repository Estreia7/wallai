import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("1234", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@wallai.app" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@wallai.app",
      passwordHash,
      primaryCurrency: "EUR",
    },
  });

  console.log("Seeded admin user:", admin.email);

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

  // Seed books
  const books = [
    {
      title: "Rich Dad Poor Dad",
      author: "Robert Kiyosaki",
      description: "What the rich teach their kids about money that the poor and middle class do not.",
      year: 1997,
      category: "mindset",
      coverUrl: "https://m.media-amazon.com/images/I/81bsw6fnUiL._AC_UF1000,1000_QL80_.jpg",
      link: "https://www.amazon.com/Rich-Dad-Poor-Teach-Middle/dp/1612680194",
    },
    {
      title: "The Psychology of Money",
      author: "Morgan Housel",
      description: "Timeless lessons on wealth, greed, and happiness. How behavior matters more than knowledge in finance.",
      year: 2020,
      category: "mindset",
      coverUrl: "https://m.media-amazon.com/images/I/81Dky+tD+pL._AC_UF1000,1000_QL80_.jpg",
      link: "https://www.amazon.com/Psychology-Money-Timeless-lessons-happiness/dp/0857197681",
    },
    {
      title: "The Intelligent Investor",
      author: "Benjamin Graham",
      description: "The definitive book on value investing. A practical guide that has inspired investors for decades.",
      year: 1949,
      category: "investing",
      coverUrl: "https://m.media-amazon.com/images/I/91yj3mbz4JL._AC_UF1000,1000_QL80_.jpg",
      link: "https://www.amazon.com/Intelligent-Investor-Definitive-Investing-Essentials/dp/0060555661",
    },
    {
      title: "I Will Teach You to Be Rich",
      author: "Ramit Sethi",
      description: "A practical, no-guilt system for automating your finances. Covers banking, saving, budgeting, and investing.",
      year: 2009,
      category: "budgeting",
      coverUrl: "https://m.media-amazon.com/images/I/71aG0m9XRcL._AC_UF1000,1000_QL80_.jpg",
      link: "https://www.amazon.com/Will-Teach-You-Rich-Second/dp/1523505745",
    },
    {
      title: "The Total Money Makeover",
      author: "Dave Ramsey",
      description: "A proven plan for financial fitness. Baby steps to get out of debt and build wealth.",
      year: 2003,
      category: "budgeting",
      coverUrl: "https://m.media-amazon.com/images/I/71JtMIagpPL._AC_UF1000,1000_QL80_.jpg",
      link: "https://www.amazon.com/Total-Money-Makeover-Classic-Financial/dp/1595555277",
    },
  ];

  const existingBooks = await prisma.book.count();
  if (existingBooks === 0) {
    await prisma.book.createMany({ data: books });
    console.log(`Seeded ${books.length} books`);
  } else {
    console.log(`Books already exist (${existingBooks}), skipping`);
  }
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
