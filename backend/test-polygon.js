function isPointInPolygon(point, polygon) {
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

const createRect = (lat, lon, width = 0.0001, height = 0.0001) => [
  { lat, lon },
  { lat: lat + height, lon },
  { lat: lat + height, lon: lon + width },
  { lat, lon: lon + width },
  { lat, lon } // close loop
];

const poly101 = { vertices: createRect(28.7041, 77.1025) };

console.log("Boundary 1 (28.7041, 77.1025):", isPointInPolygon({lat: 28.7041, lon: 77.1025}, poly101));
console.log("Inside (28.70415, 77.10255):", isPointInPolygon({lat: 28.70415, lon: 77.10255}, poly101));
console.log("Outside (28.7045, 77.1025):", isPointInPolygon({lat: 28.7045, lon: 77.1025}, poly101));
