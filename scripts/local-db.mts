// Imported first by every script that writes test data, so it runs on the local PGlite
// database and never on the production one that --env-file=.env.local brings in.
// (Prefixing the command with an empty DATABASE_URL= isn't enough: in PowerShell that unsets
// the variable, and --env-file then fills it back in.)
delete process.env.DATABASE_URL;
delete process.env.POSTGRES_URL;
