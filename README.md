# Tiger Data Database Forking Demo

This Node.js CLI script demonstrates how to create and manage zero-copy forks of Tiger Data Postgres databases.

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
   git clone https://github.com/your-org/tiger-data-take-home.git
   cd tiger-data-take-home
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Create a `.env` file**

   ```bash
   cp .env.example .env    # if provided
   # otherwise create src/.env manually and set MAIN_DB or TIGER_SERVICE_ID
   ```

   ```
   MAIN_DB= Add Service Id here
    TIGER_PROJECT_ID= Add Project ID here
   ```

````

4. **Set required environment variables**
   - `MAIN_DB`: Tiger service ID to fork. If omitted, the script falls back to the default `service_id` configured in the Tiger CLI (`tiger config show`).
   - Optional overrides:
     - `TIGER_FORK_NAME`: Custom fork name (defaults to `<serviceId>-fork-<timestamp>`)
     - `TIGER_CLI`: Tiger CLI command name (defaults to `tiger`)
     - `MAIN_DB_URL`, `TD_DB_HOST`, `TD_DB_PORT`, `TD_DB_USER`, `TD_DB_PASSWORD`: Fallback connection details when the CLI cannot return connection strings.

## Usage

### Development (ts-node)

```bash
MAIN_DB=<service-id> npm run dev
````

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
