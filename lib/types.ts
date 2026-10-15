// The check-in outcomes. Defined once; used by the API, scanner and dashboard.
// REVOKED (P7): signature valid and on the list, but the host withdrew the invitation.
export type CheckinResult = "VALID" | "DUPLICATE" | "INVALID_SIGNATURE" | "NOT_ON_LIST" | "REVOKED";

// Scan results counted as "rejected" on the dashboard. DUPLICATE is not a rejection.
export const REJECTED_RESULTS: CheckinResult[] = ["INVALID_SIGNATURE", "NOT_ON_LIST", "REVOKED"];

export type CheckinResponse = {
  result: CheckinResult;
  attendee?: { name: string; ticketType: string | null };
  checkedInAt?: string; // ISO; for VALID the new check-in, for DUPLICATE the original
};

export type DashboardResponse = {
  event: { name: string; venue: string | null };
  expected: number; // active (non-revoked) guests
  checkedIn: number; // active guests with a check-in
  rejected: number; // scans with a REJECTED_RESULTS result
  revoked: number; // guests whose invitation was withdrawn
  attendees: {
    id: string;
    name: string;
    ticketType: string | null;
    checkedInAt: string | null;
    revokedAt: string | null;
  }[];
};

export type Attendee = {
  id: string;
  event_id: string;
  name: string;
  email: string | null;
  ticket_type: string | null;
  note: string | null;
  revoked_at: string | null;
  added_via: "seed" | "manual" | "llm";
  created_at: string;
};
