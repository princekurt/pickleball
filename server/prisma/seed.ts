import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const samplePlayers = [
  { name: 'Alex Chen', skillLevel: 4.5, email: 'alex@example.com' },
  { name: 'Jordan Smith', skillLevel: 3.5, phone: '555-0101' },
  { name: 'Sam Williams', skillLevel: 4.0 },
  { name: 'Taylor Johnson', skillLevel: 3.0, email: 'taylor@example.com' },
  { name: 'Casey Brown', skillLevel: 4.5, phone: '555-0102' },
  { name: 'Morgan Davis', skillLevel: 3.5 },
  { name: 'Riley Martinez', skillLevel: 2.5, email: 'riley@example.com' },
  { name: 'Quinn Anderson', skillLevel: 4.0, phone: '555-0103' },
  { name: 'Avery Thompson', skillLevel: 3.0 },
  { name: 'Blake Garcia', skillLevel: 3.5, email: 'blake@example.com' },
  { name: 'Drew Wilson', skillLevel: 2.0 },
  { name: 'Jamie Lee', skillLevel: 5.0, phone: '555-0104' },
];

async function main() {
  console.log('Seeding database...');

  await prisma.standing.deleteMany();
  await prisma.match.deleteMany();
  await prisma.eventPlayer.deleteMany();
  await prisma.court.deleteMany();
  await prisma.event.deleteMany();
  await prisma.team.deleteMany();
  await prisma.player.deleteMany();

  for (const player of samplePlayers) {
    await prisma.player.create({ data: player });
  }

  // Default courts
  for (let i = 1; i <= 4; i++) {
    await prisma.court.create({ data: { name: `Court ${i}`, isActive: true } });
  }

  console.log(`Seeded ${samplePlayers.length} players and 4 courts`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
