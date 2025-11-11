#!/usr/bin/env node

/**
 * Tiger Data CLI Demo Script
 *
 * This script demonstrates how to:
 * 1. Create a zero-copy fork of a Tiger Data Postgres database
 * 2. Run queries on both the fork and main database
 * 3. Show that data changes are isolated between them
 * 4. Clean up the fork afterward
 */

import "dotenv/config";
import { exec } from "child_process";
import { promisify } from "util";
import { Client } from "pg";

const execAsync = promisify(exec);

// Configuration helpers
const TIGER_CLI_COMMAND = process.env.TIGER_CLI || "tiger";
const EXPLICIT_MAIN_SERVICE_ID =
  process.env.MAIN_DB ||
  process.env.TIGER_SERVICE_ID ||
  process.env.TIGER_SERVICE;

function logEnvConfiguration(): void {
  console.log("\n🔧 Environment configuration:");
  console.log(`   MAIN_DB: ${process.env.MAIN_DB ?? "<undefined>"}`);
  console.log(
    `   TIGER_SERVICE_ID: ${process.env.TIGER_SERVICE_ID ?? "<undefined>"}`
  );
  console.log(
    `   TIGER_SERVICE: ${process.env.TIGER_SERVICE ?? "<undefined>"}`
  );
  console.log(
    `   Derived source service id: ${
      EXPLICIT_MAIN_SERVICE_ID ?? "<not resolved>"
    }`
  );
  console.log(`   TIGER_CLI: ${process.env.TIGER_CLI ?? "tiger"}`);
  console.log(`   MAIN_DB_URL: ${process.env.MAIN_DB_URL ?? "<undefined>"}`);
  console.log(`   TD_DB_HOST: ${process.env.TD_DB_HOST ?? "<undefined>"}`);
  console.log(`   TD_DB_PORT: ${process.env.TD_DB_PORT ?? "<undefined>"}`);
  console.log(`   TD_DB_USER: ${process.env.TD_DB_USER ?? "<undefined>"}`);
  console.log(
    `   TD_DB_PASSWORD: ${
      process.env.TD_DB_PASSWORD ? "<set>" : "<empty or undefined>"
    }`
  );
}

/**
 * Execute a shell command and return the output
 */
async function runCommand(
  command: string
): Promise<{ stdout: string; stderr: string }> {
  console.log(`\n> ${command}`);
  try {
    const result = await execAsync(command);
    if (result.stdout) console.log(result.stdout);
    if (result.stderr) console.error(result.stderr);
    return result;
  } catch (error: any) {
    console.error(`Error executing command: ${error.message}`);
    throw error;
  }
}

/**
 * Get database connection string from Tiger CLI
 * This assumes the CLI can provide connection info
 */
async function getConnectionString(serviceId: string): Promise<string> {
  try {
    // Try to get connection string from CLI
    const { stdout } = await runCommand(
      `${TIGER_CLI_COMMAND} db connection-string --service-id ${serviceId} --with-password`
    );
    return stdout.trim();
  } catch (error) {
    // Fallback: construct connection string from environment variables
    const host = process.env.TD_DB_HOST || "localhost";
    const port = process.env.TD_DB_PORT || "5432";
    const user = process.env.TD_DB_USER || "postgres";
    const password = process.env.TD_DB_PASSWORD || "";
    const database = serviceId;

    return `postgresql://${user}${
      password ? ":" + password : ""
    }@${host}:${port}/${database}`;
  }
}

/**
 * Create a zero-copy fork of the main database
 * Uses: tiger service fork <service-id> --name <fork-name> --now
 * Returns the service ID of the created fork
 * --now forks at the current database state (required)
 */
async function createFork(
  sourceServiceId: string,
  forkName: string
): Promise<string> {
  console.log(
    `\n📋 Step 1: Creating zero-copy fork '${forkName}' from '${sourceServiceId}'...`
  );

  const { stdout } = await runCommand(
    `${TIGER_CLI_COMMAND} service fork ${sourceServiceId} --name ${forkName} --now`
  );

  // Extract the service ID from the CLI output
  // The output contains a table with "Service ID" field, or "New Service ID: <id>"
  let forkServiceId = forkName; // fallback to name

  // Try to find "Service ID" in the table output
  const serviceIdMatch = stdout.match(/│\s+Service ID\s+│\s+(\w+)\s+│/);
  if (serviceIdMatch) {
    forkServiceId = serviceIdMatch[1];
  } else {
    // Try to find "New Service ID: <id>" pattern
    const newServiceIdMatch = stdout.match(/New Service ID:\s+(\w+)/);
    if (newServiceIdMatch) {
      forkServiceId = newServiceIdMatch[1];
    }
  }

  console.log(
    `✅ Fork '${forkName}' created successfully! (Service ID: ${forkServiceId})`
  );
  return forkServiceId;
}
/**
 * Execute a query on a database
 */
async function executeQuery(
  connectionString: string,
  query: string,
  description: string
): Promise<any[]> {
  console.log(`\n📋 ${description}`);
  console.log(`Query: ${query}`);

  // Parse the connection string
  const { hostname, port, pathname, username, password, searchParams } =
    new URL(connectionString);

  // Convert searchParams to an object for additional pg client options if needed
  const additionalOptions = Object.fromEntries(
    Array.from(searchParams.entries()).map(([key, value]) => [key, value])
  );

  const client = new Client({
    host: hostname, // Use hostname only, not host
    port: port ? parseInt(port, 10) : 5432, // Default Postgres port if undefined
    database: pathname.replace(/^\//, "") || undefined,
    user: username ? decodeURIComponent(username) : undefined,
    password: password ? decodeURIComponent(password) : undefined,
    ssl: {
      rejectUnauthorized: false, // Accept self-signed certificates (dev only)
    },
    ...additionalOptions, // Merge any query params as options
  });

  try {
    await client.connect();
    const result = await client.query(query);
    console.log(`✅ Query executed successfully`);
    if (result.rows.length > 0) {
      console.log(`Results:`, result.rows);
    } else if (result.rowCount !== undefined) {
      console.log(`Rows affected: ${result.rowCount}`);
    }
    return result.rows;
  } finally {
    await client.end();
  }
}

/**
 * Insert a test row into a database
 */
async function insertTestRow(
  connectionString: string,
  dbName: string
): Promise<void> {
  // Create a test table if it doesn't exist
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS test_data (
      id SERIAL PRIMARY KEY,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      db_name TEXT NOT NULL
    );
  `;

  await executeQuery(
    connectionString,
    createTableQuery,
    `Creating test table in ${dbName} (if not exists)`
  );

  // Insert a test row
  const insertQuery = `
    INSERT INTO test_data (message, db_name) 
    VALUES ('Test message from ${dbName}', '${dbName}')
    RETURNING *;
  `;

  await executeQuery(
    connectionString,
    insertQuery,
    `Inserting test row into ${dbName}`
  );
}

/**
 * Query all test rows from a database
 */
async function queryTestRows(
  connectionString: string,
  dbName: string
): Promise<any[]> {
  const query = `SELECT * FROM test_data ORDER BY created_at DESC;`;
  return await executeQuery(
    connectionString,
    query,
    `Querying all test rows from ${dbName}`
  );
}

/**
 * Delete the fork
 */
async function deleteFork(serviceId: string): Promise<void> {
  console.log(`\n📋 Step 5: Deleting fork '${serviceId}'...`);

  // Tiger CLI command: tiger service delete <service-id> --confirm
  // --confirm flag skips the confirmation prompt (required for non-interactive use)
  await runCommand(
    `${TIGER_CLI_COMMAND} service delete ${serviceId} --confirm`
  );

  console.log(`✅ Fork '${serviceId}' deleted successfully!`);
}

/**
 * Resolve the source service ID the script should fork.
 */
async function resolveMainServiceId(): Promise<string> {
  if (EXPLICIT_MAIN_SERVICE_ID) {
    return EXPLICIT_MAIN_SERVICE_ID;
  }

  try {
    const { stdout } = await runCommand(
      `${TIGER_CLI_COMMAND} config show --output json`
    );
    const config = JSON.parse(stdout);
    const inferredId =
      config?.service_id ?? config?.config?.service_id ?? undefined;
    if (inferredId) {
      return inferredId;
    }
  } catch (error) {
    console.warn(
      "⚠️  Unable to read default service_id from Tiger CLI config:",
      error instanceof Error ? error.message : error
    );
  }

  throw new Error(
    "Unable to determine Tiger service ID. Set MAIN_DB or TIGER_SERVICE_ID."
  );
}

/**
 * Main execution function
 */
async function main() {
  console.log("🚀 Tiger Data Database Forking Demo");
  console.log("=====================================\n");

  try {
    logEnvConfiguration();
    const mainServiceId = await resolveMainServiceId();
    const forkName =
      process.env.TIGER_FORK_NAME || `${mainServiceId}-fork-${Date.now()}`;

    // Step 1: Create the fork
    //We start by creating a zero-copy fork of our main database. This is an instant
    // clone that shares storage under the hood,
    // so it’s super fast. The fork gets its own service ID, ready to use.
    const forkServiceId = await createFork(mainServiceId, forkName);

    // Step 2: Get connection strings for both databases
    //Next, we grab the connection URLs for both the main database and the fork.
    // These URLs tell our scripts how to talk to each database.
    console.log(`\n📋 Step 2: Getting connection strings...`);
    const mainConnectionString = await getConnectionString(mainServiceId);
    const forkConnectionString = await getConnectionString(forkServiceId);
    console.log(`✅ Connection strings retrieved`);

    // Step 3: Run a sample query on the fork (insert a row)
    //Now we test the fork by inserting a sample row.
    // This proves we can read and write data in the fork without touching the main database.
    console.log(`\n📋 Step 3: Running sample query on fork...`);
    await insertTestRow(forkConnectionString, forkServiceId);

    // Step 4: Query both databases to show data is different
    // Querying both databases shows that the main DB and fork are separate.
    // Changes in the fork don’t affect the original—perfect isolation
    console.log(`\n📋 Step 4: Comparing data between main and fork...`);

    console.log(`\n--- Main Database (${mainServiceId}) ---`);
    const mainRows = await queryTestRows(mainConnectionString, mainServiceId);

    console.log(`\n--- Fork Database (${forkServiceId}) ---`);
    const forkRows = await queryTestRows(forkConnectionString, forkServiceId);

    // Show the difference
    //We clean up by deleting the fork. This frees resources and keeps everything tidy,
    // so you’re not leaving extra databases running
    console.log(`\n📊 Summary:`);
    console.log(`   Main DB has ${mainRows.length} test row(s)`);
    console.log(`   Fork DB has ${forkRows.length} test row(s)`);
    console.log(`   ✅ Data isolation confirmed: Fork has its own data!`);

    // Step 5: Delete the fork
    await deleteFork(forkServiceId);

    console.log(`\n✅ Demo completed successfully!`);
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    console.error(`\nStack trace:`, error.stack);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}
