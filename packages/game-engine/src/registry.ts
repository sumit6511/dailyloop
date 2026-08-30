import type { AnyDailyGameModule } from "./types.js";

const registry = new Map<string, AnyDailyGameModule>();

export function registerGame(module: AnyDailyGameModule): void {
  const existing = registry.get(module.id);
  if (existing === module) return; // idempotent re-registration of the same module
  if (existing) throw new Error(`Game module "${module.id}" is already registered`);
  registry.set(module.id, module);
}

export function getGameModule(slug: string): AnyDailyGameModule | undefined {
  return registry.get(slug);
}

export function listGameModules(): AnyDailyGameModule[] {
  return [...registry.values()];
}
