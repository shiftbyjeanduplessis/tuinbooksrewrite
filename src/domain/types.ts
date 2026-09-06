export type IsoDate = `${number}-${number}-${number}`;

export interface Business { id: string; name: string; }
export interface Membership { businessId: string; role: 'owner' | 'admin' | 'field' | string; displayName: string; }
export interface Team { id: string; businessId: string; name: string; active: boolean; capacityHours: number; bufferHours: number; }
export interface Account { id: string; businessId: string; name: string; status: 'active' | 'paused' | 'archived' | string; contactName: string; phone: string; email: string; }
export interface ServiceLocation { id: string; businessId: string; accountId: string; siteName: string; address: string; suburb: string; accessNotes: string; instructions: string; active: boolean; }

export type VisitStatus = 'scheduled' | 'completed' | 'cancelled' | 'missed' | 'rescheduled' | 'suspended' | 'deferred' | string;
export type VisitType = 'routine' | 'additional' | 'quoted' | 'once-off';
export type BillingDisposition = 'routine' | 'additional' | 'charge' | 'no-charge' | 'quoted' | 'review';
export type VisitMoveScope = 'one' | 'future';
export type RecurrenceFrequency = 'weekly' | 'fortnightly' | 'four-weekly' | 'monthly';

export interface ScheduleSeriesSlot {
  id: string;
  seriesId: string;
  weekday: number; // ISO weekday: Monday=1 ... Sunday=7
  monthlyOrdinal: number | null; // 1..5; 5 means fifth-or-last fallback
  defaultTeamId: string;
  estimatedMinutes: number;
  serviceIds: string[];
  payload: Record<string, unknown>;
}

export interface ScheduleSeries {
  id: string;
  businessId: string;
  accountId: string;
  serviceLocationId: string | null;
  status: 'active' | 'paused' | 'ended' | string;
  frequency: RecurrenceFrequency;
  anchorDate: IsoDate;
  slots: ScheduleSeriesSlot[];
  payload: Record<string, unknown>;
}

export interface Visit {
  id: string;
  businessId: string;
  date: IsoDate;
  accountId: string;
  serviceLocationId: string | null;
  teamId: string;
  status: VisitStatus;
  estimatedMinutes: number;
  sortOrder: number;
  serviceIds: string[];
  visitType: VisitType;
  billingDisposition: BillingDisposition;
  seriesId: string | null;
  seriesSlotId: string | null;
  occurrenceDate: IsoDate | null;
  recurrenceManualOverride: boolean;
  payload: Record<string, unknown>;
  updatedAt: string | null;
}


export interface ClientServiceHold { businessId:string; clientId:string; active:boolean; reason:string; note:string; updatedAt:string|null; }
export interface ScheduleDayAction { id:string; businessId:string; date:IsoDate; teamId:string; kind:'team_note'|'internal_event'; title:string; detail:string; time:string; status:'active'|'resolved'|'cancelled'|string; response:string; resolvedAt:string|null; updatedAt:string|null; }

export interface ScheduleQueueItem {
  id: string;
  businessId: string;
  accountId: string;
  serviceLocationId: string | null;
  sourceVisitId: string | null;
  seriesId: string | null;
  seriesSlotId: string | null;
  occurrenceDate: IsoDate | null;
  originalDate: IsoDate | null;
  originalTeamId: string | null;
  estimatedMinutes: number;
  serviceIds: string[];
  visitType: VisitType;
  billingDisposition: BillingDisposition;
  reason: string;
  payload: Record<string, unknown>;
}

export interface ScheduleWeek {
  weekStart: IsoDate;
  weekEnd: IsoDate;
  teams: Team[];
  accounts: Account[];
  locations: ServiceLocation[];
  visits: Visit[];
  queueItems: ScheduleQueueItem[];
  series: ScheduleSeries[];
  clientHolds: ClientServiceHold[];
  dayActions: ScheduleDayAction[];
}

export interface MoveVisitInput { visitId: string; date: IsoDate; teamId: string; sortOrder: number; scope?: VisitMoveScope; }
export interface ResizeVisitInput { visitId: string; estimatedMinutes: number; }
export interface QueueVisitInput { visitId: string; }
export interface PlaceQueueItemInput { queueItemId: string; date: IsoDate; teamId: string; sortOrder: number; }
export interface AdditionalVisitInput {
  id: string;
  date: IsoDate;
  teamId: string;
  sortOrder: number;
  accountId: string;
  serviceLocationId: string | null;
  task: string;
  notes: string;
}

export type ServiceAgreementStatus='draft'|'active'|'paused'|'ended'|string;
export interface ServiceAgreement {
  id:string;
  businessId:string;
  accountId:string;
  serviceLocationId:string;
  status:ServiceAgreementStatus;
  startDate:IsoDate|null;
  endDate:IsoDate|null;
  frequency:RecurrenceFrequency;
  weekdays:number[];
  monthlyOrdinal:number|null;
  defaultTeamId:string;
  estimatedMinutes:number;
  serviceIds:string[];
  notes:string;
  monthlyFee:number|null;
  scheduleSeriesId:string|null;
  version:number;
  updatedAt:string|null;
}
export interface ClientWorkspace {
  accounts:Account[];
  locations:ServiceLocation[];
  agreements:ServiceAgreement[];
  teams:Team[];
}
export interface AccountInput {id:string;name:string;status:string;contactName:string;phone:string;email:string;}
export interface ServiceLocationInput {id:string;accountId:string;siteName:string;address:string;suburb:string;accessNotes:string;instructions:string;active:boolean;}
export interface ServiceAgreementInput {id:string;accountId:string;serviceLocationId:string;status:ServiceAgreementStatus;startDate:IsoDate;endDate:IsoDate|null;frequency:RecurrenceFrequency;weekdays:number[];monthlyOrdinal:number|null;defaultTeamId:string;estimatedMinutes:number;serviceIds:string[];notes:string;monthlyFee:number|null;}


export type MobileProfile='field_worker'|'owner_mobile';
export type WorkTaskOutcomeValue='Done'|'Not required today'|'Could not complete'|'Client declined';
export interface WorkTaskOutcome {task:string;outcome:WorkTaskOutcomeValue;note:string;}
export interface WorkRecord {id:string;businessId:string;scheduleJobId:string|null;accountId:string;serviceLocationId:string|null;teamId:string;date:IsoDate;tasks:WorkTaskOutcome[];extraDescription:string;photoPaths:string[];outcome:string;createdAt:string|null;payload:Record<string,unknown>;}
export interface FieldOpportunity {id:string;businessId:string;accountId:string;scheduleJobId:string|null;workRecordId:string|null;teamId:string;category:string;note:string;photoPaths:string[];status:string;reviewDecision:string;createdAt:string|null;payload:Record<string,unknown>;}
export interface WorkDay {date:IsoDate;teams:Team[];accounts:Account[];locations:ServiceLocation[];visits:Visit[];workRecords:WorkRecord[];opportunities:FieldOpportunity[];clientHolds:ClientServiceHold[];dayActions:ScheduleDayAction[];}
export interface MobileContext {businessId:string;businessName:string;userId:string;displayName:string;profile:MobileProfile;assignedTeamIds:string[];}
export interface CompleteVisitInput {submissionId:string;workRecordId:string;visitId:string;taskOutcomes:WorkTaskOutcome[];note:string;photoPaths:string[];}
export interface OpportunityInput {id:string;visitId:string;workRecordId:string|null;category:string;note:string;photoPaths:string[];}

export type QuoteStatus='Draft'|'Sent'|'Accepted'|'Declined'|'Expired'|'Cancelled'|string;
export type InvoiceStatus='Draft'|'Ready'|'Sent'|'Paid'|'Partially paid'|'Overdue'|'Credited'|'Void'|string;
export interface MoneyLine {id:string;description:string;quantity:number;unitPrice:number;vatRate:number;discountPercent?:number;sourceVisitId:string|null;sourceQuoteId:string|null;category:'routine'|'additional'|'quoted'|'cancellation'|'manual';}
export interface Quote {id:string;businessId:string;accountId:string;date:IsoDate;validUntil:IsoDate|null;status:QuoteStatus;number:string;lines:MoneyLine[];notes:string;acceptedAt:string|null;createdAt:string|null;updatedAt:string|null;}
export interface Invoice {id:string;businessId:string;accountId:string;month:string;number:string;issueDate:IsoDate|null;dueDate:IsoDate|null;status:InvoiceStatus;lines:MoneyLine[];notes:string;createdAt:string|null;updatedAt:string|null;}
export interface Payment {id:string;businessId:string;accountId:string;invoiceId:string;date:IsoDate;amount:number;method:string;reference:string;note:string;reversedAt:string|null;createdAt:string|null;}
export interface BillingVisitFact {visitId:string;accountId:string;date:IsoDate;visitType:VisitType;status:VisitStatus;billingDisposition:BillingDisposition;description:string;amount:number|null;alreadyInvoiced:boolean;}
export interface MoneyWorkspace {accounts:Account[];quotes:Quote[];invoices:Invoice[];payments:Payment[];billingFacts:BillingVisitFact[];vatRegistered:boolean;defaultVatRate:number;paymentTermsDays:number;invoicePrefix:string;}
export interface QuoteInput {id:string;accountId:string;date:IsoDate;validUntil:IsoDate|null;status:QuoteStatus;number:string;lines:MoneyLine[];notes:string;}
export interface InvoiceInput {id:string;accountId:string;month:string;issueDate:IsoDate;dueDate:IsoDate;status:InvoiceStatus;number:string;lines:MoneyLine[];notes:string;}
export interface PaymentInput {id:string;accountId:string;invoiceId:string;date:IsoDate;amount:number;method:string;reference:string;note:string;}
