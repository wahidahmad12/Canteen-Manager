import { z } from "zod";

export const clientBranchSchema = z.object({
  id: z.string().min(1).max(100).refine(id => id !== "head", "Reserved branch identifier"),
  name: z.string().trim().min(1).max(255),
  address: z.string().trim().min(1).max(500),
  gstNo: z.string().trim().max(500),
});

export type ClientBranch = z.infer<typeof clientBranchSchema>;
export const clientBranchesSchema = z.array(clientBranchSchema).refine(
  branches => new Set(branches.map(branch => branch.id)).size === branches.length,
  "Branch identifiers must be unique",
);

export function branchGstNo(branch: ClientBranch, headOfficeGst: string | null | undefined): string {
  return branch.gstNo.trim() || headOfficeGst?.trim() || "";
}

export function djOfficeAddress(stateName: string | null | undefined): string | null {
  const state = stateName?.trim().replace(/\s+/g, " ").toLowerCase();
  if (state === "west bengal") return "7 Crimatorium Street, Kolkata- 700014";
  if (state === "goa") return "730, Tinmade, Sodiem Siolim, Mapusa Bardez, North Goa - 403502";
  if (state === "sikkim") return "1 Rangpo Rohatang Road, Kumrek Sikkim - 737132";
  return null;
}
