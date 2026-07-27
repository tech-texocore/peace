const fs = require('fs');
const path = require('path');

try {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  for (const key of ['DATABASE_URL', 'FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY']) {
    if (process.env[key]) continue;
    const m = env.match(new RegExp('^' + key + '=(.+)$', 'm'));
    if (m) process.env[key] = m[1].trim().replace(/^["']|["']$/g, '');
  }
} catch {}

const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const STORE_SLUG = process.env.STORE_SLUG || 'peace';

const ADMINS = [
  { email: 'superadmin@peace.com', password: 'SuperAdminPEACE@2026', name: 'Super Admin', role: 'SUPER_ADMIN', scoped: false },
  { email: 'admin@peace.com', password: 'AdminPEACE@2026', name: 'Store Admin', role: 'ADMIN', scoped: true },
];

async function main() {
  const app = getApps().length ? getApps()[0] : initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
  const auth = getAuth(app);

  const store = await prisma.store.findUnique({ where: { slug: STORE_SLUG }, select: { id: true } });
  if (!store) throw new Error(`Store "${STORE_SLUG}" not found — run bootstrap first`);
  const storeAdminRole = await prisma.accessRole.findFirst({ where: { storeId: store.id, name: 'Store Admin' }, select: { id: true } });

  for (const a of ADMINS) {
    const storeId = a.scoped ? store.id : null;
    const roleId = a.scoped ? storeAdminRole?.id ?? null : null;

    let user;
    try { user = await auth.getUserByEmail(a.email); } catch { user = null; }
    user = user
      ? await auth.updateUser(user.uid, { password: a.password, displayName: a.name })
      : await auth.createUser({ email: a.email, password: a.password, displayName: a.name });

    await auth.setCustomUserClaims(user.uid, { role: a.role, storeId });

    await prisma.adminUser.upsert({
      where: { firebaseUid: user.uid },
      create: { firebaseUid: user.uid, email: a.email, name: a.name, role: a.role, storeId, roleId, isActive: true },
      update: { email: a.email, name: a.name, role: a.role, storeId, roleId, isActive: true },
    });

    console.log(`✓ ${a.role.padEnd(11)} ${a.email}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
