// The seeded guest list. Shared by seed.mjs and reset-demo.mjs so reset can restore
// seed notes and ticket types exactly. All fictional. Ticket types: General | VIP only.

// Named guests the P7 demo messages refer to.
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

// Obviously fictional filler guests. 31 of these + 9 named demo guests = 40.
// Every 4th is VIP, the rest General. reset-demo.mjs restores these ticket types.
const FILLER_NAMES = [
  "Ada Placeholder", "Zed Placeholder", "Mona Mockingbird", "Rex Sandbox",
  "Pixel McDemo", "Juniper Fakename", "Otto Fixture", "Luna Lorem",
  "Ivy Ipsum", "Barnaby Stub", "Clara Configure", "Dexter Dummy",
  "Echo Example", "Felix Foobar", "Greta Gadget", "Hugo Hypothetical",
  "Iris Instance", "Jasper Json", "Kiki Keystroke", "Leo Localhost",
  "Maple Mockup", "Nico Nullable", "Olive Offline", "Percy Prototype",
  "Quinn Queryson", "Rosa Runtime", "Sly Sample", "Tess Testcase",
  "Umberto Undefined", "Vera Variable", "Wally Widget",
];
export const FILLER_GUESTS = FILLER_NAMES.map((name, i) => ({
  name,
  ticket_type: i % 4 === 3 ? "VIP" : "General",
  note: null,
}));

// Checked in by `npm run reset:demo` so the ALREADY_CHECKED_IN flag shows on camera.
export const PRECHECKED_GUEST = "James Whitfield";
