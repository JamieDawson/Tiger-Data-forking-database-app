# Tiger Data Database Forking Demo

This TypeScript app that uses the Tiger CLI walks through creating and managing zero-copy Tiger Data Postgres forks. So you can spin up production-like sandboxes in minutes, rehearse risky changes without touching prod, and keep multiple feature or demo environments running safely in parallel.

[Click here to watch the full video of me building the app.](https://youtu.be/0yq2LSEiOfk)

## Features

- Creates a zero-copy fork of a Tiger Data Postgres database
- Runs sample queries on both the fork and main database
- Demonstrates data isolation between databases
- Cleans up the fork afterward

## Prerequisites

- Node.js 18 or newer
- Tiger Data CLI (`tiger`) [Link to the Tiger CLI GitHub](https://github.com/timescale/tiger-cli)
- Access to a Tiger Data Postgres service that can be forked

## Local Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/JamieDawson/Tiger-Data-forking-database-app.git
   cd Tiger-Data-forking-database-app
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Create a `.env` file**
   Create a .env file and set MAIN_DB or TIGER_SERVICE_ID

   ```
   MAIN_DB= Add Service Id here
    TIGER_PROJECT_ID= Add Project ID here
   ```

4. **Run the code to see it in action**

```
npm run dev
```

Make sure to have your Tiger Data console open to see the database being forked and deleted.

## Usage

### Development (ts-node)

```bash
MAIN_DB=<service-id> npm run dev
```

### Production (build and run)

```bash
npm run build
MAIN_DB=<service-id> npm start
```

### Windows PowerShell

```powershell
$env:MAIN_DB="<service-id>"
npm run dev
```

## How It Works

1. **Create Fork** – `tiger service fork ${sourceServiceId} --name ${forkName} --now`
2. **Get Connections** – `tiger db connection-string --service-id ${serviceId} --with-password`
3. **Insert on Fork** – creates/updates a `test_data` table with a sample row
4. **Compare Data** – queries both databases to demonstrate isolation
5. **Cleanup** – `tiger service delete ${serviceId} --confirm`

## Customization

Adjust the CLI calls in `src/index.ts` if your Tiger CLI workflow differs (e.g., custom project IDs, output formats, or fork flags).
