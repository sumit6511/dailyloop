import path from "node:path";
import { config } from "dotenv";

// override: the test database must win even if something already loaded the repo's .env (the dev
// database) into process.env — importing @prisma/client does exactly that.
config({ path: path.resolve(import.meta.dirname, "../../.env.test"), override: true, quiet: true });
