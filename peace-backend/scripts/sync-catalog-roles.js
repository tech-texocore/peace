// Adds newly-introduced catalog permissions to the seeded system roles.
const fs = require('fs');
const path = require('path');
if (!process.env.DATABASE_URL) {
  try {
    const m = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').match(/^DATABASE_URL=(.+)$/m);
    if (m) process.env.DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, '');
  } catch {}
}
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const url = process.env.DATABASE_URL;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const ADMIN_ADD = [
  'sellers.create', 'sellers.read', 'sellers.update', 'sellers.delete',
  'collections.create', 'collections.read', 'collections.update', 'collections.delete',
  'categories.create', 'categories.read', 'categories.update', 'categories.delete',
  'brands.create', 'brands.read', 'brands.update', 'brands.delete',
  'masters.create', 'masters.read', 'masters.update', 'masters.delete',
  'discounts.create', 'discounts.read', 'discounts.update', 'discounts.delete',
  'customergroups.create', 'customergroups.read', 'customergroups.update', 'customergroups.delete',
  'subscriptions.read',
  'campaigns.create', 'campaigns.read', 'campaigns.update', 'campaigns.delete',
];
const STAFF_ADD = ['sellers.read', 'categories.read', 'brands.read', 'collections.read', 'masters.read', 'discounts.read', 'customergroups.read'];

async function main() {
  const roles = await prisma.accessRole.findMany({ where: { isSystem: true } });
  for (const r of roles) {
    const add = r.key === 'admin' ? ADMIN_ADD : r.key === 'staff' ? STAFF_ADD : [];
    if (!add.length) continue;
    const merged = Array.from(new Set([...r.permissions, ...add])).sort();
    await prisma.accessRole.update({ where: { id: r.id }, data: { permissions: merged } });
    console.log(`${r.key}: ${merged.length} perms`);
  }
}

main().finally(() => prisma.$disconnect());
