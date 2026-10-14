// The four check-in outcomes. Defined once; used by the API, scanner and dashboard.
export type CheckinResult = "VALID" | "DUPLICATE" | "INVALID_SIGNATURE" | "NOT_ON_LIST";

export type CheckinResponse = {
  result: CheckinResult;
  attendee?: { name: string; ticketType: string | null };
  checkedInAt?: string; // ISO; for VALID the new check-in, for DUPLICATE the original
};

export type Attendee = {
  id: string;
  event_id: string;
  name: string;
  email: string | null;
  ticket_type: string | null;
  created_at: string;
};
