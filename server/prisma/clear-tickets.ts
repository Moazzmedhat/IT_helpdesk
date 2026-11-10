import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing tickets and dependent data...');
  const delAttachments = await prisma.attachment.deleteMany();
  console.log(`Deleted ${delAttachments.count} attachments.`);

  const delComments = await prisma.comment.deleteMany();
  console.log(`Deleted ${delComments.count} comments.`);

  const delHistory = await prisma.ticketHistory.deleteMany();
  console.log(`Deleted ${delHistory.count} history records.`);

  const delNotifications = await prisma.notification.deleteMany();
  console.log(`Deleted ${delNotifications.count} notifications.`);

  const delTickets = await prisma.ticket.deleteMany();
  console.log(`Deleted ${delTickets.count} tickets.`);

  const delSeq = await prisma.yearSequence.deleteMany();
  console.log(`Reset year sequences.`);

  console.log('Cleanup complete: System is completely clear of tickets.');
}

main()
  .catch((err) => {
    console.error('Error clearing tickets:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
