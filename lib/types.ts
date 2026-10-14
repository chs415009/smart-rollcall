// The four check-in outcomes. Defined once; used by the API, scanner and dashboard.
export type CheckinResult = "VALID" | "DUPLICATE" | "INVALID_SIGNATURE" | "NOT_ON_LIST";

export type Attendee = {
  id: string;
  event_id: string;
  name: string;
  email: string | null;
  ticket_type: string | null;
  created_at: string;
};
