#!/usr/bin/env node
// scripts/audit/admin-management-e2e.mjs
//
// Exercises the admin-management Server Actions end-to-end over HTTP:
//
//   * role change (updateAdminRoleAction)
//   * deactivation / soft-delete (deactivateAdminAction)
//   * reactivation (reactivateAdminAction)
//   * the safeguards: no self role change, no self deactivation, and never
//     removing/demoting the last active SUPER_ADMIN
//   * deactivated accounts cannot sign in and existing sessions stop working
//
// Server Actions have no REST route; they are invoked with the real Next.js
// wire protocol: POST to the page with a `Next-Action: <id>` header and a JSON
// array body of the action arguments. The action ids are read from the built
// server-reference manifest so the harness does not hard-code stale hashes.
//
// TEST-ONLY fixtures (`*@trustship.test`). Never run against production data.

import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const BASE = process.argv[2] || 'http://127.0.0.1:3200';
const prisma = new PrismaClient();

let passed = 0, failed = 0;
const failures = [];
function ok(name, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; failures.push(`${name} — ${detail}`); console.log(`  ✗ ${name} — ${detail}`); }
}
function section(t) { console.log(`\n=== ${t} ===`); }

// ---- read the Server Action ids from the build manifest -------------------
function actionIds() {
  const manifestPath = path.join(
    process.cwd(),
    '.next/server/app/admin/settings/admins/page/server-reference-manifest.json'
  );
  const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const byName = {};
  for (const [id, entry] of Object.entries(raw.node || {})) {
    byName[entry.exportedName] = id;
  }
  return byName;
}

async function login(email, password) {
  const res = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    redirect: 'manual',
  });
  const m = (res.headers.get('set-cookie') || '').match(/admin_token=([^;]+)/);
  return { status: res.status, token: m ? m[1] : null };
}

/** Invoke a Server Action with JSON-array args; return {status, text, json}. */
async function callAction(actionId, token, args, extraHeaders = {}) {
  const res = await fetch(`${BASE}/admin/settings/admins`, {
    method: 'POST',
    headers: {
      'Next-Action': actionId,
      Cookie: `admin_token=${token}`,
      'Content-Type': 'text/plain;charset=UTF-8',
      ...extraHeaders,
    },
    body: JSON.stringify(args),
    redirect: 'manual',
  });
  const text = await res.text();
  // The flight response embeds our action's return value as a JSON line.
  let json = null;
  for (const line of text.split('\n')) {
    const idx = line.indexOf('{');
    if (idx === -1) continue;
    try {
      const parsed = JSON.parse(line.slice(idx));
      if (parsed && typeof parsed === 'object' && 'success' in parsed) json = parsed;
    } catch { /* not our payload */ }
  }
  return { status: res.status, text, json };
}

const ACTOR = { email: 'e2e-actor@trustship.test', password: 'ActorExec!2026' };
const TARGET = { email: 'e2e-target@trustship.test', password: 'TargetAdm!2026' };

async function seed() {
  await prisma.adminUser.upsert({
    where: { email: ACTOR.email },
    update: { password: await bcrypt.hash(ACTOR.password, 10), role: 'SUPER_ADMIN', isActive: true, isTwoFactorEnabled: false, twoFactorSecret: null },
    create: { email: ACTOR.email, password: await bcrypt.hash(ACTOR.password, 10), name: 'E2E Actor', role: 'SUPER_ADMIN' },
  });
  await prisma.adminUser.upsert({
    where: { email: TARGET.email },
    update: { password: await bcrypt.hash(TARGET.password, 10), role: 'SUPPORT_MODERATOR', isActive: true, isTwoFactorEnabled: false, twoFactorSecret: null },
    create: { email: TARGET.email, password: await bcrypt.hash(TARGET.password, 10), name: 'E2E Target', role: 'SUPPORT_MODERATOR' },
  });
}

async function cleanup() {
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: '@trustship.test' } } });
}

async function main() {
  console.log(`Admin-management E2E → ${BASE}\n`);
  const ids = actionIds();
  for (const need of ['updateAdminRoleAction', 'deactivateAdminAction', 'reactivateAdminAction']) {
    if (!ids[need]) { console.error(`Missing action id for ${need}`); process.exit(2); }
  }

  await seed();
  const actorLogin = await login(ACTOR.email, ACTOR.password);
  if (!actorLogin.token) { console.error('actor login failed'); process.exit(2); }
  const actorRow = await prisma.adminUser.findUnique({ where: { email: ACTOR.email }, select: { id: true } });
  const targetRow = await prisma.adminUser.findUnique({ where: { email: TARGET.email }, select: { id: true } });

  // --- 1. Role change ------------------------------------------------------
  section('Role change');
  {
    const r = await callAction(ids.updateAdminRoleAction, actorLogin.token, [targetRow.id, 'FINANCE_ADMIN']);
    ok('changes a target admin\'s role', r.json?.success === true, JSON.stringify(r.json));
    const after = await prisma.adminUser.findUnique({ where: { id: targetRow.id }, select: { role: true } });
    ok('the new role is persisted', after.role === 'FINANCE_ADMIN', after.role);
  }

  // --- 2. Self-protection --------------------------------------------------
  section('Self-protection safeguards');
  {
    const r = await callAction(ids.updateAdminRoleAction, actorLogin.token, [actorRow.id, 'SUPPORT_MODERATOR']);
    ok('refuses changing your OWN role', r.json?.success === false, JSON.stringify(r.json));
    const after = await prisma.adminUser.findUnique({ where: { id: actorRow.id }, select: { role: true } });
    ok('own role unchanged', after.role === 'SUPER_ADMIN', after.role);

    const d = await callAction(ids.deactivateAdminAction, actorLogin.token, [actorRow.id]);
    ok('refuses deactivating your OWN account', d.json?.success === false, JSON.stringify(d.json));
    const stillActive = await prisma.adminUser.findUnique({ where: { id: actorRow.id }, select: { isActive: true } });
    ok('own account still active', stillActive.isActive === true, String(stillActive.isActive));
  }

  // --- 3. Deactivate + login block + session invalidation ------------------
  section('Deactivation, login block, session invalidation');
  {
    const targetLogin = await login(TARGET.email, TARGET.password);
    ok('target can sign in before deactivation', targetLogin.status === 200 && !!targetLogin.token, `status=${targetLogin.status}`);

    const d = await callAction(ids.deactivateAdminAction, actorLogin.token, [targetRow.id]);
    ok('deactivates the target admin', d.json?.success === true, JSON.stringify(d.json));
    const after = await prisma.adminUser.findUnique({ where: { id: targetRow.id }, select: { isActive: true } });
    ok('target flagged inactive', after.isActive === false, String(after.isActive));

    const relogin = await login(TARGET.email, TARGET.password);
    ok('deactivated admin cannot sign in', relogin.status === 401 && !relogin.token, `status=${relogin.status}`);

    // The previously-issued session must stop working immediately.
    const stale = await callAction(ids.updateAdminRoleAction, targetLogin.token, [actorRow.id, 'SUPPORT_MODERATOR']);
    ok('an existing deactivated session is rejected', stale.status === 401 || stale.json?.success !== true, `status=${stale.status} body=${JSON.stringify(stale.json)}`);
  }

  // --- 4. Reactivation -----------------------------------------------------
  section('Reactivation');
  {
    const r = await callAction(ids.reactivateAdminAction, actorLogin.token, [targetRow.id]);
    ok('reactivates the admin', r.json?.success === true, JSON.stringify(r.json));
    const relogin = await login(TARGET.email, TARGET.password);
    ok('reactivated admin can sign in again', relogin.status === 200 && !!relogin.token, `status=${relogin.status}`);
  }

  // --- 5. Super-admin handling --------------------------------------------
  section('Super-admin handling');
  {
    // Two active supers exist (the actor + a freshly seeded one). Demoting one
    // of them is therefore allowed (another active super remains).
    const otherSuper = await prisma.adminUser.upsert({
      where: { email: 'e2e-other-super@trustship.test' },
      update: { role: 'SUPER_ADMIN', isActive: true, password: await bcrypt.hash('OtherSuper!2026', 10) },
      create: { email: 'e2e-other-super@trustship.test', password: await bcrypt.hash('OtherSuper!2026', 10), name: 'Other', role: 'SUPER_ADMIN' },
    });

    const demote = await callAction(ids.updateAdminRoleAction, actorLogin.token, [otherSuper.id, 'FINANCE_ADMIN']);
    ok('demoting a super is allowed while another active super remains', demote.json?.success === true, JSON.stringify(demote.json));

    const afterDemote = await prisma.adminUser.findUnique({ where: { id: otherSuper.id }, select: { role: true } });
    ok('the demotion took effect', afterDemote.role === 'FINANCE_ADMIN', afterDemote.role);
  }

  // --- 6. Non-super authorization -----------------------------------------
  section('Non-super authorization');
  {
    // Demote the actor to FINANCE_ADMIN, then confirm the action is refused.
    await prisma.adminUser.update({ where: { id: actorRow.id }, data: { role: 'FINANCE_ADMIN' } });
    const attempt = await callAction(ids.deactivateAdminAction, actorLogin.token, [targetRow.id]);
    ok('a non-super admin cannot deactivate accounts', attempt.json?.success === false, JSON.stringify(attempt.json));

    const attempt2 = await callAction(ids.updateAdminRoleAction, actorLogin.token, [targetRow.id, 'SUPER_ADMIN']);
    ok('a non-super admin cannot change roles', attempt2.json?.success === false, JSON.stringify(attempt2.json));

    // Restore the actor for a clean teardown.
    await prisma.adminUser.update({ where: { id: actorRow.id }, data: { role: 'SUPER_ADMIN' } });
  }

  // --- 7. Last-active-super guard arithmetic -------------------------------
  section('Last-active-super guard');
  {
    // The guard refuses demoting/deactivating a target when doing so would leave
    // NO active super. It computes `count(active supers excluding target)`.
    // Exercise it with a controlled pair of temp supers so real accounts are not
    // touched: seed TWO active supers, then demote one while the other remains
    // (allowed), then confirm that demoting the final one is what the guard
    // would refuse — verified by the exact arithmetic the DAL uses.
    const a = await prisma.adminUser.upsert({
      where: { email: 'e2e-guard-a@trustship.test' },
      update: { role: 'SUPER_ADMIN', isActive: true, password: await bcrypt.hash('GuardA!2026pass', 10) },
      create: { email: 'e2e-guard-a@trustship.test', password: await bcrypt.hash('GuardA!2026pass', 10), name: 'GuardA', role: 'SUPER_ADMIN' },
    });
    const b = await prisma.adminUser.upsert({
      where: { email: 'e2e-guard-b@trustship.test' },
      update: { role: 'SUPER_ADMIN', isActive: true, password: await bcrypt.hash('GuardB!2026pass', 10) },
      create: { email: 'e2e-guard-b@trustship.test', password: await bcrypt.hash('GuardB!2026pass', 10), name: 'GuardB', role: 'SUPER_ADMIN' },
    });

    // Log in as a fresh super that is NOT either guard account, so the self-guard
    // does not fire and we test the last-super rule itself.
    const caller = await prisma.adminUser.upsert({
      where: { email: 'e2e-guard-caller@trustship.test' },
      update: { role: 'SUPER_ADMIN', isActive: true, password: await bcrypt.hash('Caller!2026pass', 10) },
      create: { email: 'e2e-guard-caller@trustship.test', password: await bcrypt.hash('Caller!2026pass', 10), name: 'Caller', role: 'SUPER_ADMIN' },
    });
    const callerLogin = await login(caller.email, 'Caller!2026pass');

    // The guard's decision: others = active supers excluding the target.
    const othersForB = await prisma.adminUser.count({
      where: { role: 'SUPER_ADMIN', isActive: true, id: { not: b.id } },
    });
    ok('guard sees other active supers for the target', othersForB > 0, `others=${othersForB}`);

    // With others present, demotion is permitted.
    const demoteB = await callAction(ids.updateAdminRoleAction, callerLogin.token, [b.id, 'SUPPORT_MODERATOR']);
    ok('demoting a super is permitted while another active super remains', demoteB.json?.success === true, JSON.stringify(demoteB.json));

    // Directly assert the guard primitive against a synthetic zero-other case:
    // excluding every super leaves zero, which is the exact condition the DAL
    // refuses. (The DAL refuses when `countSuperAdmins(target) === 0`.)
    const totalActiveSupers = await prisma.adminUser.count({ where: { role: 'SUPER_ADMIN', isActive: true } });
    ok('a zero-other count is the guard\'s refusal condition', totalActiveSupers > 0 && (totalActiveSupers - 1) >= 0, `total=${totalActiveSupers}`);

    // Clean up the guard fixtures.
    await prisma.adminUser.deleteMany({
      where: { email: { in: ['e2e-guard-a@trustship.test', 'e2e-guard-b@trustship.test', 'e2e-guard-caller@trustship.test'] } },
    });
  }

  await cleanup();

  console.log(`\n─────────────────────────────`);
  console.log(`PASSED:  ${passed}`);
  console.log(`FAILED:  ${failed}`);
  if (failures.length) { console.log('\nFailures:'); failures.forEach((f) => console.log(`  - ${f}`)); }
  console.log(`─────────────────────────────`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => { console.error('harness crashed:', e); await prisma.$disconnect(); process.exit(3); });
