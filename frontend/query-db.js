const fs = require('fs');
if (fs.existsSync('.env.local')) {
  const env = fs.readFileSync('.env.local', 'utf-8');
  env.split('\n').forEach(line => {
    const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
    }
  });
}

const { PrismaClient } = require('@prisma/client');
const { PrismaLibSQL } = require('@prisma/adapter-libsql');
const { createClient } = require('@libsql/client');

async function main() {
  const url = process.env.TURSO_DATABASE_URL || "libsql://vouching-main-app-arista-ai-apps.aws-ap-south-1.turso.io";
  const token = process.env.TURSO_AUTH_TOKEN;

  if (!token) {
    console.error("TURSO_AUTH_TOKEN is not set in env");
    return;
  }

  console.log("Connecting to:", url);
  const libsql = createClient({ url, authToken: token });
  const adapter = new PrismaLibSQL(libsql);
  const prisma = new PrismaClient({ adapter });

  try {
    const files = await prisma.uploadedFile.findMany({
      include: {
        invoices: {
          include: {
            reconciliationResults: true
          }
        }
      },
      orderBy: { id: 'desc' },
      take: 10
    });

    console.log(`\n--- LATEST 10 FILES ---`);
    for (const f of files) {
      console.log(`File ID: ${f.id}`);
      console.log(`  Filename: ${f.filename}`);
      console.log(`  Status: ${f.status}`);
      console.log(`  FilePath: ${f.filePath}`);
      console.log(`  Invoices Count: ${f.invoices.length}`);
      for (const inv of f.invoices) {
        console.log(`    Invoice ID: ${inv.id}`);
        console.log(`      Invoice Number: ${inv.invoiceNumber}`);
        console.log(`      Vendor Name: ${inv.vendorName}`);
        console.log(`      Total Value: ${inv.totalValue}`);
        console.log(`      Reconciliation Results:`, inv.reconciliationResults.map(r => ({
          status: r.matchStatus,
          score: r.matchScore,
          registerRowId: r.registerRowId
        })));
      }
      console.log('------------------------------------');
    }

    const registers = await prisma.register.findMany({
      include: {
        _count: {
          select: { rows: true }
        }
      }
    });
    console.log(`\n--- REGISTERS ---`);
    for (const r of registers) {
      console.log(`Register ID: ${r.id}, Type: ${r.registerType}, Rows: ${r._count.rows}, Filename: ${r.filename}`);
    }

  } catch (err) {
    console.error("DB Query failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
