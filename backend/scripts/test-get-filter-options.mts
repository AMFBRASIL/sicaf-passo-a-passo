import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dirname, "../.env") });
import { licitacoesService } from "../src/modules/licitacoes/licitacoes.service.ts";

try {
  const t0 = Date.now();
  const filters = await licitacoesService.getFilterOptions();
  console.log("ok in", Date.now() - t0, "ms");
  console.log(JSON.stringify(filters, null, 2).slice(0, 2000));
} catch (e) {
  console.error("failed:", e);
  process.exit(1);
}
