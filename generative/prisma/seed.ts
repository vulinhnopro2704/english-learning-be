import { PrismaClient } from '../src/generated/prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool, { schema: 'generative' });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding data...');

  // Create a User
  const user = await prisma.user.create({
    data: {
      name: 'Test User',
      englishLevel: 'B1',
    },
  });
  console.log(`Created user with id: ${user.id}`);

  // Create Scenarios
  const scenario1 = await prisma.scenario.create({
    data: {
      title: 'Coffee Shop Order',
      description: 'You are at a busy coffee shop and want to order a drink and a pastry.',
      aiPersona: 'A friendly but busy barista.',
      userPersona: 'A customer who wants a specific coffee.',
      requiredTasks: [
        'Greet the barista',
        'Order a cappuccino with oat milk',
        'Ask for the total price',
      ],
      type: 'SYSTEM',
      level: 'A1',
      topic: 'Daily Life',
      isPublic: true,
    },
  });
  console.log(`Created scenario: ${scenario1.title}`);

  const scenario2 = await prisma.scenario.create({
    data: {
      title: 'Job Interview',
      description: 'You are interviewing for a Software Engineer position.',
      aiPersona: 'A strict and formal hiring manager.',
      userPersona: 'A confident candidate.',
      requiredTasks: [
        'Introduce yourself professionally',
        'Describe your past experience',
        'Ask a question about the company culture',
      ],
      type: 'SYSTEM',
      level: 'B2',
      topic: 'Business',
      isPublic: true,
    },
  });
  console.log(`Created scenario: ${scenario2.title}`);

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
