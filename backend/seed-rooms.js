const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedRooms() {
  try {
    const hostelName = 'hostel 3';
    
    const roomsToCreate = [
      { room_number: '101', floor: 1, name: 'Common Room' },
      { room_number: '102', floor: 1, name: 'TV Room' },
      { room_number: '201', floor: 2, name: 'Library' },
      { room_number: '205', floor: 2, name: 'Anurag Room' },
      { room_number: '301', floor: 3, name: 'Gym' },
      { room_number: '3511', floor: 3, name: 'Anurag Room' },
    ];

    console.log('Seeding rooms...');
    for (const r of roomsToCreate) {
      await prisma.room.upsert({
        where: { hostel_name_room_number: { hostel_name: hostelName, room_number: r.room_number } },
        update: {},
        create: {
          hostel_name: hostelName,
          floor: r.floor,
          room_number: r.room_number,
          name: r.name
        }
      });
    }
    console.log('Rooms seeded successfully!');
  } catch (error) {
    console.error('Error seeding rooms:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedRooms();
