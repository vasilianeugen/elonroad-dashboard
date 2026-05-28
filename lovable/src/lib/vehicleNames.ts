const KNOWN_VEHICLE_NAMES: Record<string, string> = {
  "2ccf67fae91c": "ITS-2 (107)",
  d83add09fddd: "BRING 1",
  "2ccf678f5478": "TEST RIG 2",
};

const isTechnicalName = (name: string, id: string) => {
  const value = name.trim().toLowerCase();
  return (
    value === id.toLowerCase() ||
    value === "vehicle name" ||
    /^[0-9a-f]{10,}$/i.test(value)
  );
};

export const buildVehicleNameLookup = (vehicleIds: string[]) => {
  const lookup = new Map<string, string>();
  let nextNumber = 1;

  Array.from(new Set(vehicleIds.filter(Boolean)))
    .sort()
    .forEach((vehicleId) => {
      const knownName = KNOWN_VEHICLE_NAMES[vehicleId.toLowerCase()];
      if (knownName) {
        lookup.set(vehicleId, knownName);
        return;
      }

      lookup.set(vehicleId, `Vehicle ${nextNumber}`);
      nextNumber += 1;
    });

  return lookup;
};

export const getVehicleDisplayName = (
  vehicleId: string,
  lookup: Map<string, string>,
  rawName?: string | null
) => {
  if (rawName && !isTechnicalName(rawName, vehicleId)) {
    return rawName;
  }

  return lookup.get(vehicleId) ?? KNOWN_VEHICLE_NAMES[vehicleId.toLowerCase()] ?? "Vehicle";
};
