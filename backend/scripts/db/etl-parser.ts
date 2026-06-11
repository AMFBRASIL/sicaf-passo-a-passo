export type EtlStep = {
  targetTable: string;
  columns: string[];
  selectSql: string;
  sourceTable: string;
};

function stripComments(sql: string): string {
  return sql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

function parseColumnList(raw: string): string[] {
  return raw
    .split(",")
    .map((c) => c.trim().replace(/^`|`$/g, ""))
    .filter(Boolean);
}

/**
 * Extrai passos INSERT...SELECT do 02_migration_etl.sql
 */
export function parseEtlSteps(sql: string): EtlStep[] {
  const cleaned = stripComments(sql);
  const steps: EtlStep[] = [];
  const insertMarker = /INSERT\s+IGNORE\s+INTO\s+`([^`]+)`/gi;
  const markers = [...cleaned.matchAll(insertMarker)];

  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].index!;
    const end = i + 1 < markers.length ? markers[i + 1].index! : cleaned.length;
    const block = cleaned.slice(start, end);

    const targetTable = markers[i][1];
    const colStart = block.indexOf("(", block.indexOf(targetTable));
    if (colStart < 0) continue;

    let depth = 0;
    let colEnd = -1;
    for (let j = colStart; j < block.length; j++) {
      if (block[j] === "(") depth++;
      if (block[j] === ")") {
        depth--;
        if (depth === 0) {
          colEnd = j;
          break;
        }
      }
    }
    if (colEnd < 0) continue;

    const columns = parseColumnList(block.slice(colStart + 1, colEnd));
    const selectIdx = block.toUpperCase().indexOf("SELECT", colEnd);
    const fromIdx = block.toUpperCase().indexOf("FROM `CADBRASILSYS`.`", selectIdx);
    if (selectIdx < 0 || fromIdx < 0) continue;

    const selectSql = block.slice(selectIdx + 6, fromIdx).trim();
    const fromMatch = block.slice(fromIdx).match(/FROM\s+`cadbrasilsys`\.`([^`]+)`/i);
    if (!fromMatch) continue;

    steps.push({
      targetTable,
      columns,
      selectSql,
      sourceTable: fromMatch[1],
    });
  }

  return steps;
}
