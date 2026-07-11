import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function upsertTodo(
  userId: string,
  t: { type: string; dedupeKey: string; title: string; body?: string; payload: Prisma.InputJsonValue },
): Promise<void> {
  await prisma.todo.upsert({
    where: { userId_dedupeKey: { userId, dedupeKey: t.dedupeKey } },
    create: {
      userId, type: t.type, dedupeKey: t.dedupeKey,
      title: t.title, body: t.body ?? null, payload: t.payload, status: "pending",
    },
    update: {
      // refresh content but keep it pending; do not resurrect resolved items
      title: t.title, body: t.body ?? null, payload: t.payload,
    },
  });
}

export function listPendingTodos(userId: string) {
  return prisma.todo.findMany({
    where: { userId, status: "pending" },
    orderBy: { createdAt: "desc" },
  });
}

export async function resolveTodo(userId: string, id: string, status: "done" | "dismissed") {
  await prisma.todo.updateMany({
    where: { id, userId },
    data: { status, resolvedAt: new Date() },
  });
}
