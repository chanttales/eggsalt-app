// Engine operations by name. Each op runs inside one database transaction that already knows the
// caller and has checked they belong to the workspace. Later tasks add create-card, move-card,
// stock, money and undo ops here.

import type { TransactionSql } from "postgres";

export type Role = "owner" | "staff";

export interface OpContext {
  tx: TransactionSql;
  userId: string;
  workspaceId: string;
  role: Role;
}

export type Op = (ctx: OpContext, input: unknown) => Promise<unknown>;

export const ops: Record<string, Op> = {
  /** Checks sign-in and membership end to end; returns who the engine thinks you are. */
  ping: ({ userId, workspaceId, role }) => Promise.resolve({ userId, workspaceId, role }),
};
