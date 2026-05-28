import { prisma } from '../config/db';

export interface LocationSignal {
  mac: string;
  rssi: number;
  type: 'WIFI' | 'BLE';
}

/**
 * Intelligent room detection algorithm.
 * Simple implementation: Matches the strongest signal to a known BeaconMapping.
 * Can be expanded later to use triangulation or fingerprinting with `DeviceSignal`.
 */
export const detectRoomFromSignals = async (signals: LocationSignal[]): Promise<string | null> => {
  if (!signals || signals.length === 0) return null;

  // Sort signals by strongest RSSI first
  const sortedSignals = signals.sort((a, b) => b.rssi - a.rssi);

  // Extract all MAC addresses sent by the device
  const macAddresses = sortedSignals.map(s => s.mac);

  // Find known beacons in DB
  const knownBeacons = await prisma.beaconMapping.findMany({
    where: { uuid: { in: macAddresses } },
  });

  const knownWifi = await prisma.wiFiAccessPoint.findMany({
    where: { bssid: { in: macAddresses } }
  });

  if (knownBeacons.length === 0 && knownWifi.length === 0) return null;

  // The strongest signal that matches a known beacon/wifi determines the room
  for (const signal of sortedSignals) {
    if (signal.rssi < -85) continue;

    if (signal.type === 'BLE') {
      const matchedBeacon = knownBeacons.find(b => b.uuid === signal.mac);
      if (matchedBeacon) return matchedBeacon.room_id;
    } else if (signal.type === 'WIFI') {
      const matchedWifi = knownWifi.find(w => w.bssid === signal.mac);
      if (matchedWifi) return matchedWifi.room_id;
    }
  }

  return null;
};
