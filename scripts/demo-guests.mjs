// Named guests the P7 demo messages refer to. Shared by seed.mjs and reset-demo.mjs so
// reset can restore the seed notes exactly. All fictional.
export const DEMO_GUESTS = [
  { name: "Richard Hale", ticket_type: "VIP", note: "CEO, Hale Capital" },
  { name: "Daniel Chen", ticket_type: "VIP", note: null },
  { name: "Mei Chen", ticket_type: "VIP", note: "Spouse of Daniel Chen" },
  { name: "Sarah Okafor", ticket_type: "General", note: null },
  { name: "Tom Okafor", ticket_type: "General", note: "Spouse of Sarah Okafor" },
  { name: "James Whitfield", ticket_type: "General", note: "Whitfield Partners" },
  { name: "Chris Morgan", ticket_type: "General", note: null },
  { name: "Chris Delaney", ticket_type: "General", note: null },
  { name: "Priya Nair", ticket_type: "General", note: null },
];

// Checked in by `npm run reset:demo` so the ALREADY_CHECKED_IN flag shows on camera.
export const PRECHECKED_GUEST = "James Whitfield";
