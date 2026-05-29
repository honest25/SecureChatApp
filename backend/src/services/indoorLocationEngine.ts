import { prisma } from '../config/db';

export interface Point {
  lat: number;
  lon: number;
}

export interface Polygon {
  vertices: Point[];
}

/**
 * Ray-Casting Algorithm to check if a point is inside a polygon
 * Essential for detecting exactly which room a GPS coordinate falls into.
 */
export function isPointInPolygon(point: Point, polygon: Polygon): boolean {
  let isInside = false;
  let i = 0;
  let j = polygon.vertices.length - 1;

  for (; i < polygon.vertices.length; j = i++) {
    const xi = polygon.vertices[i].lat;
    const yi = polygon.vertices[i].lon;
    const xj = polygon.vertices[j].lat;
    const yj = polygon.vertices[j].lon;

    const intersect = ((yi > point.lon) !== (yj > point.lon)) &&
      (point.lat < (xj - xi) * (point.lon - yi) / (yj - yi) + xi);
    if (intersect) isInside = !isInside;
  }
  return isInside;
}

/**
 * Advanced matching: Given a lat/lon and a building, find the exact room by checking polygons.
 */
export async function detectExactRoom(lat: number, lon: number, buildingId: string): Promise<string | null> {
  // Fetch all rooms for this building
  const rooms = await prisma.room.findMany({
    where: { building_id: buildingId },
    select: { id: true, polygon_coordinates: true }
  });

  for (const room of rooms) {
    if (room.polygon_coordinates) {
      // Assuming polygon_coordinates is stored as [{lat: x, lon: y}, ...]
      const polygon = { vertices: room.polygon_coordinates as unknown as Point[] };
      if (isPointInPolygon({ lat, lon }, polygon)) {
        return room.id;
      }
    }
  }

  // If no exact polygon match, implement a "Nearest Room" Euclidean distance check.
  let nearestRoomId: string | null = null;
  let minDistance = Infinity;

  // Function to calculate polygon centroid
  const getPolygonCentroid = (polygon: Polygon): Point => {
    let sumLat = 0;
    let sumLon = 0;
    for (const v of polygon.vertices) {
      sumLat += v.lat;
      sumLon += v.lon;
    }
    return {
      lat: sumLat / polygon.vertices.length,
      lon: sumLon / polygon.vertices.length
    };
  };

  // Simple Euclidean distance (sufficient for small indoor coordinate differences)
  const getEuclideanDistance = (p1: Point, p2: Point): number => {
    const dx = p1.lat - p2.lat;
    const dy = p1.lon - p2.lon;
    return Math.sqrt(dx * dx + dy * dy);
  };

  for (const room of rooms) {
    if (room.polygon_coordinates) {
      const polygon = { vertices: room.polygon_coordinates as unknown as Point[] };
      const centroid = getPolygonCentroid(polygon);
      const distance = getEuclideanDistance({ lat, lon }, centroid);
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestRoomId = room.id;
      }
    }
  }

  // Threshold check to ensure the user is reasonably close to the nearest room
  // 0.001 degrees is roughly ~111 meters.
  if (minDistance < 0.001) {
    return nearestRoomId;
  }

  return null;
}

/**
 * Trilateration / RSSI Distance approximation
 * Not heavily used for Web (due to missing Web WiFi API), but architecture is in place for Native Apps.
 */
export function calculateDistanceFromRSSI(rssi: number, txPower: number = -59, n: number = 2.0): number {
  return Math.pow(10, (txPower - rssi) / (10 * n));
}
