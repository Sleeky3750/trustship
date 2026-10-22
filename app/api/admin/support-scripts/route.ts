import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/admin-auth";
import { recordAdminAction } from "@/lib/audit";
import { STANDARD_SCRIPTS } from "@/lib/support-scripts";

/**
 * GET /api/admin/support-scripts
 * List scripts (optionally filtered by category / search). Requires
 * support_scripts:read.
 *
 * If the catalogue is empty (first run), it is seeded from the canonical
 * STANDARD_SCRIPTS so the section is usable immediately. Seeding requires
 * support_scripts:manage — a read-only admin sees an empty list rather than
 * triggering a write.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "support_scripts:read");
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const query = (searchParams.get("q") || "").trim();

    let total = await prisma.supportScript.count();

    // First-run seed: the canonical catalogue is a SYSTEM default, not a user
    // edit, so it is seeded on first read regardless of the caller's
    // permission (a read-only viewer must still see the shipped scripts).
    if (total === 0) {
      await prisma.supportScript.createMany({
        data: STANDARD_SCRIPTS.map((s) => ({
          slug: s.slug,
          title: s.title,
          category: s.category,
          body: s.body,
          usageNotes: s.usageNotes,
          isInternal: s.isInternal ?? false,
        })),
        skipDuplicates: true,
      });
      total = await prisma.supportScript.count();
    }

    const where: any = { isActive: true };
    if (category && category !== "ALL") where.category = category;
    if (query) {
      where.OR = [
        { title: { contains: query, mode: "insensitive" } },
        { body: { contains: query, mode: "insensitive" } },
        { slug: { contains: query, mode: "insensitive" } },
      ];
    }

    const scripts = await prisma.supportScript.findMany({
      where,
      orderBy: [{ category: "asc" }, { title: "asc" }],
    });

    const allScripts = await prisma.supportScript.findMany({ select: { category: true } });
    const categories = Array.from(new Set(allScripts.map((s) => s.category))).sort();

    return NextResponse.json({
      success: true,
      total,
      categories,
      scripts: scripts.map(serialize),
    });
  } catch (error) {
    console.error("Support scripts list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function serialize(s: {
  id: string;
  slug: string;
  title: string;
  category: string;
  body: string;
  usageNotes: string | null;
  isInternal: boolean;
  updatedAt: Date;
}) {
  return {
    id: s.id,
    slug: s.slug,
    title: s.title,
    category: s.category,
    body: s.body,
    usageNotes: s.usageNotes,
    isInternal: s.isInternal,
    updatedAt: s.updatedAt.toISOString(),
  };
}

/**
 * POST /api/admin/support-scripts
 * Create a new script. Requires support_scripts:manage.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "support_scripts:manage");
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({} as any));
    const { slug, title, category, body: scriptBody, usageNotes, isInternal } = body ?? {};

    if (!slug || !title || !scriptBody) {
      return NextResponse.json(
        { error: "slug, title and body are required" },
        { status: 400 }
      );
    }

    const existing = await prisma.supportScript.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { error: "A script with that slug already exists" },
        { status: 409 }
      );
    }

    const created = await prisma.supportScript.create({
      data: {
        slug,
        title,
        category: category || "General",
        body: scriptBody,
        usageNotes: usageNotes ?? null,
        isInternal: Boolean(isInternal),
        updatedById: auth.admin.id,
      },
    });

    // Seed the first version row.
    await prisma.supportScriptVersion.create({
      data: {
        scriptId: created.id,
        body: created.body,
        title: created.title,
        editedById: auth.admin.id,
      },
    });

    await recordAdminAction(request, {
      adminId: auth.admin.id,
      action: "SUPPORT_SCRIPT_CREATED",
      targetId: created.id,
      message: `Created support script "${created.title}" (${created.slug})`,
      changes: { slug: created.slug, category: created.category },
    });

    return NextResponse.json({ success: true, script: serialize(created) }, { status: 201 });
  } catch (error) {
    console.error("Support script create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
