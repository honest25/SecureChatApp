const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  console.log('Clearing old location data...');
  await prisma.livePresence.deleteMany({});
  await prisma.movementLog.deleteMany({});
  await prisma.deviceSignal.deleteMany({});
  await prisma.beaconMapping.deleteMany({});
  await prisma.room.deleteMany({});
  console.log('Done!');
}
main().catch(console.error).finally(() => prisma.$disconnect());
