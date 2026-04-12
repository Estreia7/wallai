# Developer Workspace

This folder is your development workspace. Use it to make changes, test locally, then push to GitHub to update the live website.

## Workflow

1. **Clone the repo** on any machine:
   ```bash
   git clone https://github.com/Estreia7/wallai.git
   cd wallai
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. **Run database migrations:**
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

5. **Start dev server:**
   ```bash
   npm run dev
   ```

6. **Make changes** in this `developer/` folder or anywhere in the project.

7. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "your changes"
   git push
   ```

8. **Update live website** - pull changes on the server:
   ```bash
   cd /var/www/wallai
   git pull
   npm run build
   # restart the app
   ```

## Project Structure

```
wallai/
├── src/
│   ├── app/wallai/        # Pages (dashboard, bank, crypto, etc.)
│   ├── app/api/wallai/    # API routes
│   ├── components/wallai/ # React components
│   ├── lib/wallai/        # Business logic & types
│   └── lib/               # Shared utilities (auth, prisma, etc.)
├── prisma/                # Database schema & migrations
├── docs/
│   ├── plans/             # Implementation plans
│   └── specs/             # Design specifications
├── developer/             # Dev workspace (you are here)
└── public/                # Static assets
```

## Plans & Specs

Check `docs/plans/` for implementation plans and `docs/specs/` for design specs.
These are included so you can pick up work from any machine.
