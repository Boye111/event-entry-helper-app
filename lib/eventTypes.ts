// Client-safe. Controls the wording on invites, cards and forms for each kind of event.
export type EventTypeInfo = {
  label: string;
  /** Small line above the big title on the invite, e.g. "The wedding of" */
  kicker: string;
  /** Form label for the `hosts` field */
  hostsLabel: string;
  hostsPlaceholder: string;
  /** Suggestions for the guest "group" field */
  groups: string[];
};

export const EVENT_TYPES: Record<string, EventTypeInfo> = {
  wedding: {
    label: "Wedding",
    kicker: "The wedding of",
    hostsLabel: "Couple",
    hostsPlaceholder: "Tunde & Bisi",
    groups: ["bride", "groom", "family", "friends"],
  },
  engagement: {
    label: "Engagement / Introduction",
    kicker: "The engagement of",
    hostsLabel: "Couple",
    hostsPlaceholder: "Tunde & Bisi",
    groups: ["bride", "groom", "family", "friends"],
  },
  birthday: {
    label: "Birthday",
    kicker: "Birthday celebration",
    hostsLabel: "Celebrant",
    hostsPlaceholder: "Mama Funke at 60",
    groups: ["family", "friends", "colleagues", "VIP"],
  },
  burial: {
    label: "Burial / Remembrance",
    kicker: "Celebrating the life of",
    hostsLabel: "In memory of",
    hostsPlaceholder: "Chief Adewale Okonkwo",
    groups: ["family", "friends", "church", "VIP"],
  },
  corporate: {
    label: "Corporate / Conference",
    kicker: "You're invited to",
    hostsLabel: "Event title",
    hostsPlaceholder: "Lagos Fintech Summit 2026",
    groups: ["speaker", "sponsor", "press", "attendee", "VIP"],
  },
  party: {
    label: "Party",
    kicker: "You're invited to",
    hostsLabel: "Party title",
    hostsPlaceholder: "Tobi's Owambe",
    groups: ["family", "friends", "VIP"],
  },
  other: {
    label: "Other",
    kicker: "You're invited to",
    hostsLabel: "Title shown on the invite",
    hostsPlaceholder: "Graduation dinner",
    groups: ["VIP", "guest"],
  },
};

export const EVENT_TYPE_KEYS = Object.keys(EVENT_TYPES) as [string, ...string[]];

export function eventType(type: string | null | undefined): EventTypeInfo {
  return EVENT_TYPES[type ?? ""] ?? EVENT_TYPES.other;
}

/** Big title on the invite: the hosts if set, otherwise the event name. */
export function eventTitle(e: { hosts: string | null; name: string }): string {
  return e.hosts?.trim() || e.name;
}
