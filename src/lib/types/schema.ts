/** Domain rows as serialized JSON from the SpiralFolio API (dates may be ISO strings). */

export type Client = {
  id: string;
  name: string;
  engagement: string | null;
  pmName: string | null;
  adName: string | null;
  status: string | null;
  successMetric: string | null;
  driveFolderUrl: string | null;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
};

export type Call = {
  id: string;
  clientId: string;
  callDate: string;
  callType: string | null;
  rawTranscript: string | null;
  coachingDoc: string | null;
  callSummary: string | null;
  keyUpdates: string | null;
  attendeesClient: string | null;
  attendeesInternal: string | null;
  brainSnapshot: string | null;
  brainChanges: string | null;
  status: string | null;
  createdAt: string | Date | null;
};

export type EventSeverity = 'info' | 'success' | 'warning' | 'error';

export type EventSource =
  | 'spiralfolio'
  | 'appscript'
  | 'cloudflare'
  | 'manual'
  | 'zoom'
  | 'slack';

export type EventLog = {
  id: string;
  eventType: string;
  source: EventSource;
  severity: EventSeverity;
  message: string | null;
  clientId: string | null;
  clientName: string | null;
  meetingId: string | null;
  meetingTopic: string | null;
  callId: string | null;
  callDate: string | null;
  docUrl: string | null;
  slackRecipient: string | null;
  slackRecipientEmail: string | null;
  slackMessage: string | null;
  slackChannelId: string | null;
  slackTs: string | null;
  payload: string | null;
  createdAt: string | Date | null;
};
