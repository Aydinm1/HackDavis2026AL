import "dotenv/config";
import { DEMO_USER_ID } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listAiCorrections } from "@/lib/services/aiCorrections";

async function main() {
  const correctionType = process.argv[2];
  const result = await listAiCorrections(DEMO_USER_ID, {
    correctionType: correctionType || undefined,
    limit: 20,
  });

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
