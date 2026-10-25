import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const envPath = resolve(backendRoot, ".env");

dotenv.config({ path: envPath });

const requiredSecrets = ["JWT_SECRET", "JWT_REFRESH_SECRET"];
const invalidSecrets = requiredSecrets.filter((name) => {
  const value = process.env[name]?.trim();
  return !value || value.length < 32 || /^(replace|your-|change-me|placeholder)/i.test(value);
});

if (invalidSecrets.length > 0) {
  console.error(
    `Configuration error: ${invalidSecrets.join(", ")} must be set to unique random values of at least 32 characters in backend/.env. Copy backend/.env.example and replace its placeholders.`
  );
  process.exit(1);
}

if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
  console.error("Configuration error: JWT_SECRET and JWT_REFRESH_SECRET must have different values.");
  process.exit(1);
}
