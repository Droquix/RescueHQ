# The Last-Minute Life Saver 🚨

An AI-powered productivity companion designed to help students, professionals, and entrepreneurs **take action before deadlines slip** — moving beyond passive reminders that are easy to ignore.

---

## Table of Contents
1. [Core Features](#core-features)
2. [Tech Stack](#tech-stack)
3. [Local Setup & Running](#local-setup--running)
4. [Version Control with GitHub (Systematic Workflow)](#version-control-with-github-systematic-workflow)
5. [Google Cloud Platform (GCP) Deployment](#google-cloud-platform-gcp-deployment)
   - [Database Strategy Options (SQLite vs. PostgreSQL)](#database-strategy-options-sqlite-vs-postgresql)
   - [GCP Cloud Run Deployment Steps](#gcp-cloud-run-deployment-steps)
6. [Project Structure & Scripts](#project-structure--scripts)
7. [License](#license)

---

## Core Features

| Feature | Description |
| :--- | :--- |
| **Intelligent Task Prioritization** | Automatically calculates dynamic urgency scores based on deadline proximity, task priority, category, and effort estimate. |
| **AI-Powered Scheduling Assistance** | Automatically plans focus blocks and schedules tasks directly into your day. |
| **Personalized Recommendations** | Triggers "Rescue Mode" when multiple deadlines pile up, suggesting actionable breakdown tips. |
| **Context-Aware Reminders** | Sends morning, commute, and evening prompts customized to your actual daily context and location. |
| **Calendar Integration** | Includes a full schedule view with AI-planned time blocks. |
| **Goal & Habit Tracking** | Keeps track of habits with streaks, progress bars, and historical logging. |
| **Voice-Enabled Assistance** | Features Web Speech API integration combined with an AI productivity coach chat. |
| **Autonomous Task Planning** | Breaks down larger goals or tasks into actionable subtasks automatically. |

---

## Tech Stack

* **Frontend/Backend:** Next.js 16 (App Router, Server Actions)
* **Language:** TypeScript
* **Styling:** Tailwind CSS v4
* **Database:** Prisma 7 + SQLite (Default local) or PostgreSQL (Production)
* **AI Engine:** OpenAI (Optional - robust fallback templates if API key is not provided)

---

## Local Setup & Running

Follow these steps to run the application locally on your machine:

### 1. Clone & Install Dependencies
```bash
git clone <your-github-repo-url>
cd last-minute-life-saver
npm install
```

### 2. Configure Environment Variables
Create a `.env` file from the example template:
```bash
cp .env.example .env
```
Open `.env` and configure the following variables:
```env
DATABASE_URL="file:./dev.db"
# Optional: Add OpenAI Key for intelligent task breakdown and voice features
OPENAI_API_KEY="your-openai-api-key-here"
```

### 3. Initialize the Database
Push the Prisma schema to create the local SQLite database file:
```bash
npm run db:push
```

### 4. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. Click the **Load demo data** button at the top to pre-populate the dashboard with example tasks, habits, and goals.

---

## Version Control with GitHub (Systematic Workflow)

To deploy and maintain the project systematically, follow these version control practices:

### 1. Repository Initial Setup
```bash
git init
git add .
git commit -m "chore: initial commit of Last-Minute Life Saver"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 2. Systematic Branching Strategy
We recommend using short-lived feature branches and Pull Requests (PRs):
* `main` / `master`: Production-ready code. No direct commits allowed.
* `feature/abc-feature`: For implementing new features.
* `bugfix/fix-xyz`: For resolving issues.

### 3. Automated Continuous Integration (CI)
The project comes with a preconfigured GitHub Actions workflow located in `.github/workflows/ci.yml`. On every push and Pull Request to `main`, this workflow automatically:
1. Validates the Prisma schema syntax (`npx prisma validate`).
2. Runs the linter (`npm run lint`).
3. Compiles the Next.js application (`npm run build`) to ensure there are no build errors.

---

## Google Cloud Platform (GCP) Deployment

Next.js projects run optimally inside Docker containers on Google Cloud.

> [!WARNING]
> Because Google Cloud Run instances are **stateless and ephemeral**, the default SQLite database file (`dev.db`) will be deleted whenever Cloud Run restarts or scales to zero. Review the options below to ensure persistence.

---

### Database Strategy Options (SQLite vs. PostgreSQL)

#### Option A: PostgreSQL + Cloud SQL (Recommended for Production)
For true production reliability, swap the database engine from SQLite to PostgreSQL:

1. **Convert the project config:**
   Run the utility script to automatically rewrite the database provider in `prisma/schema.prisma` and the db initialization client in `src/lib/db.ts`:
   ```bash
   node scripts/switch-db.js postgresql
   ```
2. **Configure production environment:**
   Provide a PostgreSQL connection string inside your env configuration:
   ```env
   DATABASE_URL="postgresql://<user>:<password>@<host>:<port>/<dbname>?schema=public"
   ```
3. **Regenerate Client & Deploy DB:**
   ```bash
   npx prisma db push
   ```

#### Option B: SQLite + Google Cloud Storage Volume Mounts (Easiest / Free Tier)
If you want to keep using SQLite without paying for a Cloud SQL database, you can mount a persistent Google Cloud Storage bucket to your Cloud Run service via FUSE:

1. Create a Google Cloud Storage bucket (e.g. `last-minute-db-bucket`).
2. Set up the directory structure such that `/data` is mounted to the bucket.
3. Update your `DATABASE_URL` environment variable inside Cloud Run to `"file:/data/dev.db"`.
4. Run the Cloud Run deployment with the `--add-volume` flag pointing to your bucket path (described in the steps below).

---

### GCP Cloud Run Deployment Steps

#### Prerequisites
* Install the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install).
* Enable the Artifact Registry and Cloud Run APIs in your Google Cloud Console.

#### 1. Configure GCP Locally
Initialize and log into your gcloud account:
```bash
gcloud init
gcloud auth configure-docker <region>-docker.pkg.dev
```

#### 2. Create an Artifact Registry Repository
Create a repository for your Docker images:
```bash
gcloud artifacts repositories create last-minute-repo \
    --repository-format=docker \
    --location=<region> \
    --description="Docker repository for Last-Minute Life Saver"
```

#### 3. Build & Push Docker Image
Build the image using Google Cloud Build (which handles the build process on GCP servers):
```bash
gcloud builds submit --tag <region>-docker.pkg.dev/<project-id>/last-minute-repo/app:latest
```

#### 4. Deploy to Google Cloud Run

##### Path A: Deploying with PostgreSQL (Cloud SQL)
```bash
gcloud run deploy last-minute-life-saver \
    --image <region>-docker.pkg.dev/<project-id>/last-minute-repo/app:latest \
    --platform managed \
    --region <region> \
    --allow-unauthenticated \
    --set-env-vars="DATABASE_URL=postgresql://user:pass@host/db,OPENAI_API_KEY=sk-..."
```

##### Path B: Deploying with SQLite + Cloud Storage Volume Mount
```bash
# Deploy with a volume mount pointing to a GCS bucket named 'my-sqlite-bucket'
gcloud run deploy last-minute-life-saver \
    --image <region>-docker.pkg.dev/<project-id>/last-minute-repo/app:latest \
    --platform managed \
    --region <region> \
    --allow-unauthenticated \
    --add-volume=name=db-volume,type=cloud-storage,bucket=my-sqlite-bucket \
    --add-volume-mount=volume=db-volume,mount-path=/data \
    --set-env-vars="DATABASE_URL=file:/data/dev.db,OPENAI_API_KEY=sk-..."
```

---

## Project Structure & Scripts

```
.
├── .github/workflows/   # CI/CD Workflows
├── prisma/              # Prisma database schema and migrations
├── public/              # Static assets (icons, images)
├── scripts/             # Utility and helper scripts
└── src/
    ├── actions/         # Next.js Server Actions (Tasks, Goals, AI)
    ├── app/             # Main Next.js Page components (App Router)
    ├── components/      # UI and functional layout elements
    └── lib/             # Utilities (AI logic, db initialization, etc)
```

### Essential Commands

* `npm run dev`: Runs the local development server.
* `npm run build`: Builds the production-ready build of the Next.js app.
* `npm run db:push`: Synchronizes the local database with the Prisma schema.
* `npm run db:studio`: Opens Prisma Studio in your browser to inspect database tables.
* `node scripts/switch-db.js postgresql`: Switches database target engine to PostgreSQL.
* `node scripts/switch-db.js sqlite`: Reverts database target engine to SQLite.

---

## License

This project is licensed under the MIT License.
