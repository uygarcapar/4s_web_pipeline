/**
 * Stage 0 — lead discovery (Ek A). Implemented in Milestone 4:
 * Places API Text Search with field mask → hard filters → aggregator
 * blocklist → website-activity scoring → cheap heuristics → PSI for
 * candidates → leads/*.csv + approvals batch + Telegram summary.
 */
export async function discoverCommand(options: {
  sector: string;
  district: string;
}): Promise<void> {
  console.log(
    `discover: not implemented yet (Milestone 4). Requested: sector="${options.sector}" district="${options.district}"`,
  );
  process.exitCode = 1;
}
