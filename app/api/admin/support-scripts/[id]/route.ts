import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/admin-auth";
import { recordAdminAction } from "@/lib/audit";

type Context = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/support-scripts/[id]
 * Edit a script. Requires support_scripts:manage. Every edit appends a
 * SupportScriptVersion row so wording changes are reconstructible.
 */
export async function PATCH(request: NextRequest, context: Context) {
  try {
    const auth = await requirePermission(request, "support_scripts:manage");
    if (auth.error) return auth.error;

    const { id } = await context.params;
    const script = await prisma.supportScript.findUnique({ where: { id } });
    if (!script) {
      return NextResponse.json({ error: "Script not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({} as any));
    const { title, category, body: newBody, usageNotes, isInternal } = body ?? {};

    const updated = await prisma.supportScript.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(newBody !== undefined ? { body: newBody } : {}),
        ...(usageNotes !== undefined ? { usageNotes } : {}),
        ...(isInternal !== undefined ? { isInternal: Boolean(isInternal) } : {}),
        updatedById: auth.admin.id,
      },
    });

    // Append a version snapshot after each edit (only when body/title changed).
    await prisma.supportScriptVersion.create({
      data: {
        scriptId: updated.id,
        body: updated.body,
        title: updated.title,
        editedById: auth.admin.id,
      },
    });

    await recordAdminAction(request, {
      adminId: auth.admin.id,
      action: "SUPPORT_SCRIPT_UPDATED",
      targetId: updated.id,
      message: `Updated support script "${updated.title}"`,
      changes: {
        title: { from: script.title, to: updated.title },
        bodyChanged: script.body !== updated.body,
      },
    });

    return NextResponse.json({
      success: true,
      script: {
        id: updated.id,
        slug: updated.slug,
        title: updated.title,
        category: updated.category,
        body: updated.body,
        usageNotes: updated.usageNotes,
        isInternal: updated.isInternal,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Support script update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/admin/support-scripts/[id]
 * Script detail + version history. Requires support_scripts:read.
 */
export async function GET(request: NextRequest, context: Context) {
  try {
    const auth = await requirePermission(request, "support_scripts:read");
    if (auth.error) return auth.error;

    const { id } = await context.params;
    const script = await prisma.supportScript.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
    if (!script) {
      return NextResponse.json({ error: "Script not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      script: {
        id: script.id,
        slug: script.slug,
        title: script.title,
        category: script.category,
        body: script.body,
        usageNotes: script.usageNotes,
        isInternal: script.isInternal,
        updatedAt: script.updatedAt.toISOString(),
      },
      versions: script.versions.map((v) => ({
        id: v.id,
        title: v.title,
        body: v.body,
        editedById: v.editedById,
        createdAt: v.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Support script detail error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
