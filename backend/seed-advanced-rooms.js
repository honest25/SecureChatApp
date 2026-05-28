const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Advanced Buildings & Rooms...');

  // 1. Create Building
  const building = await prisma.building.upsert({
    where: { name: 'block b' },
    update: {},
    create: { name: 'block b' }
  });

  // 2. Create Floors
  const groundFloor = await prisma.hostelFloor.upsert({
    where: { building_id_floor_level: { building_id: building.id, floor_level: 0 } },
    update: {},
    create: { building_id: building.id, floor_level: 0, name: 'Ground Floor' }
  });

  const firstFloor = await prisma.hostelFloor.upsert({
    where: { building_id_floor_level: { building_id: building.id, floor_level: 1 } },
    update: {},
    create: { building_id: building.id, floor_level: 1, name: 'First Floor' }
  });

  // 3. Create Rooms with dummy Polygons (approx lat/lon near user)
  // Let's assume the origin is lat: 28.7041, lon: 77.1025
  const createRect = (lat, lon, width = 0.0001, height = 0.0001) => [
    { lat, lon },
    { lat: lat + height, lon },
    { lat: lat + height, lon: lon + width },
    { lat, lon: lon + width },
    { lat, lon } // close loop
  ];

  const roomsData = [
    {
      room_number: '101', name: 'Common Room', floor_id: groundFloor.id,
      polygon: createRect(28.7041, 77.1025)
    },
    {
      room_number: '102', name: 'TV Room', floor_id: groundFloor.id,
      polygon: createRect(28.7042, 77.1025)
    },
    {
      room_number: '201', name: 'Library', floor_id: firstFloor.id,
      polygon: createRect(28.7041, 77.1026)
    },
    {
      room_number: '301', name: 'Gym', floor_id: firstFloor.id,
      polygon: createRect(28.7042, 77.1026)
    }
  ];

  for (const r of roomsData) {
    await prisma.room.upsert({
      where: { building_id_room_number: { building_id: building.id, room_number: r.room_number } },
      update: { polygon_coordinates: JSON.stringify(r.polygon) },
      create: {
        building_id: building.id,
        floor_id: r.floor_id,
        room_number: r.room_number,
        name: r.name,
        polygon_coordinates: JSON.stringify(r.polygon)
      }
    });
  }

  // Update existing users to remove their hostel_name and room_number (since schema changed? wait, user schema didn't change!)
  // User still has `hostel_name` and `room_number` in `schema.prisma`? Let me check.
  // Actually, I didn't change User schema. It still has hostel_name.
  
  console.log('Seeding complete!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
