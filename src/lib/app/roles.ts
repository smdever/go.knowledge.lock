/** Shared by server and client code (no database imports). */
export type Role = "owner" | "signer" | "viewer";
export const ROLES: Role[] = ["owner", "signer", "viewer"];
export const ROLE_LABEL: Record<Role, string> = { owner: "Owner", signer: "Signer", viewer: "Viewer" };
/** What each role can do, phrased to follow "can": "you can invite people…". */
export const ROLE_HELP: Record<Role, string> = {
  owner: "invite people, manage roles and policies, and do everything a signer can",
  signer: "propose records, sign off when chosen, and lock records",
  viewer: "read records, verify them and build from them",
};
export const withArticle = (role: Role) => (role === "owner" ? "an owner" : `a ${ROLE_LABEL[role].toLowerCase()}`);
