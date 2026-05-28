const KNOWN_CHARGER_NAMES: Record<string, string> = {
  "2ccf67fae81a": "Charger-1 Power Rail",
  "2ccf67fae805": "Charger-2 Power Rail",
  "2ccf67fae84d": "Charger-3 Power Rail",
  "2ccf67fae910": "Charger-4 Power Rail",
  "2ccf67fae87d": "Charger-5 Power Rail",
};

const USED_KNOWN_NUMBERS = new Set(
  Object.values(KNOWN_CHARGER_NAMES)
    .map((name) => name.match(/Charger-(\d+)/i)?.[1])
    .filter(Boolean)
    .map(Number)
);

const isTechnicalName = (name: string, id: string) => {
  const value = name.trim().toLowerCase();
  return (
    value === id.toLowerCase() ||
    value.startsWith("rpi-") ||
    /^[0-9a-f]{10,}$/i.test(value)
  );
};

export const buildChargerNameLookup = (chargerIds: string[]) => {
  const lookup = new Map<string, string>();
  const usedNumbers = new Set(USED_KNOWN_NUMBERS);
  let nextNumber = 1;

  Array.from(new Set(chargerIds.filter(Boolean)))
    .sort()
    .forEach((chargerId) => {
      const knownName = KNOWN_CHARGER_NAMES[chargerId.toLowerCase()];
      if (knownName) {
        lookup.set(chargerId, knownName);
        return;
      }

      while (usedNumbers.has(nextNumber)) {
        nextNumber += 1;
      }

      lookup.set(chargerId, `Charger-${nextNumber} Power Rail`);
      usedNumbers.add(nextNumber);
      nextNumber += 1;
    });

  return lookup;
};

export const getChargerDisplayName = (
  chargerId: string,
  lookup: Map<string, string>,
  rawName?: string | null
) => {
  if (rawName && !isTechnicalName(rawName, chargerId)) {
    return rawName;
  }

  return lookup.get(chargerId) ?? KNOWN_CHARGER_NAMES[chargerId.toLowerCase()] ?? "Charging Station";
};
