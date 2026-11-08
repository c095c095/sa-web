import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../", import.meta.url));
const name = process.env.SA_DEMO_PROFILE ?? "";
if (name && !/^[a-z0-9][a-z0-9-]{0,24}$/.test(name))
  throw new Error("SA_DEMO_PROFILE must be a short lowercase name.");
export const profile = name ? "demo-" + name : "demo";
export const profileDir = ".local/" + profile;
export const state = path.join(root, profileDir);
export const envFile = path.join(state, "runtime.env");
