/**
 * Webhook Event Types and Field Definitions
 * 
 * This file provides strict TypeScript types for webhook events and payload fields
 * to ensure consistency across the application and prevent naming errors.
 */

// ============= Event Types =============

/** Client lifecycle events */
export type ClientEventType = 
  | "client.created"
  | "client.updated"
  | "client.deleted";

/** Application lifecycle events */
export type ApplicationEventType = 
  | "application.created"
  | "application.updated"
  | "application.deleted";

/** All supported webhook event types */
export type WebhookEventType = ClientEventType | ApplicationEventType;

// ============= Field Types =============

/** Fields available for client payloads */
export type ClientFieldId = 
  | "client_id"
  | "client_type"
  | "first_name"
  | "last_name"
  | "company_name"
  | "company_id"
  | "email"
  | "phone"
  | "client_folder_id"
  | "root_folder_id"
  | "folder_status"
  | "folder_status_updated_at"
  | "created_at";

/** Fields available for visa application payloads */
export type VisaApplicationFieldId = 
  | "application_id"
  | "application_name"
  | "visa_subclass"
  | "company_id"
  | "client_id"
  | "client_folder_id"
  | "status"
  | "application_folder_id"
  | "folder_status"
  | "folder_status_updated_at"
  | "created_at";

/** All available webhook payload field IDs */
export type WebhookFieldId = ClientFieldId | VisaApplicationFieldId;

// ============= Entity Categories =============

/** Entity categories for grouping fields */
export type WebhookEntityCategory = "client" | "visa_application";

// ============= Configuration Types =============

/** Field definition for webhook payloads */
export interface WebhookFieldDefinition {
  id: string;
  label: string;
  description: string;
  default: boolean;
}

/** Topic configuration for grouping events */
export interface WebhookTopic {
  id: string;
  label: string;
  description: string;
  events: WebhookEventType[];
}

/** Webhook configuration object */
export interface WebhookConfig {
  id?: string;
  name: string;
  url: string;
  events: WebhookEventType[];
  included_fields: string[];
  timeout_seconds: number;
  max_retries: number;
  retry_backoff_seconds: number;
  is_active?: boolean;
  secret_key?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
}

/** Field category with label for UI display */
export interface FieldCategory {
  key: WebhookEntityCategory;
  label: string;
}

// ============= Payload Types =============

/** Client webhook payload data */
export interface ClientWebhookPayload {
  client_id: string;
  client_type: "personal" | "corporate";
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  company_id: string;
  email: string | null;
  phone: string | null;
  client_folder_id: string | null;
  root_folder_id?: string | null;
  folder_status: string;
  folder_status_updated_at: string | null;
  created_at: string;
}

/** Visa application webhook payload data */
export interface VisaApplicationWebhookPayload {
  application_id: string;
  application_name: string;
  visa_subclass: string | null;
  company_id: string;
  client_id: string;
  client_folder_id: string | null;
  status: "draft" | "active" | "done";
  application_folder_id: string | null;
  folder_status: string;
  folder_status_updated_at: string | null;
  created_at: string;
}

/** Union of all webhook payload types */
export type WebhookPayload = ClientWebhookPayload | VisaApplicationWebhookPayload;

/** Complete webhook event structure */
export interface WebhookEvent<T extends WebhookPayload = WebhookPayload> {
  event_type: WebhookEventType;
  timestamp: string;
  data: T;
}

// ============= Constants =============

/** All client events */
export const CLIENT_EVENTS: ClientEventType[] = [
  "client.created",
  "client.updated",
  "client.deleted",
];

/** All application events */
export const APPLICATION_EVENTS: ApplicationEventType[] = [
  "application.created",
  "application.updated",
  "application.deleted",
];

/** All webhook events */
export const ALL_WEBHOOK_EVENTS: WebhookEventType[] = [
  ...CLIENT_EVENTS,
  ...APPLICATION_EVENTS,
];

// ============= Type Guards =============

/** Check if an event is a client event */
export function isClientEvent(event: string): event is ClientEventType {
  return CLIENT_EVENTS.includes(event as ClientEventType);
}

/** Check if an event is an application event */
export function isApplicationEvent(event: string): event is ApplicationEventType {
  return APPLICATION_EVENTS.includes(event as ApplicationEventType);
}

/** Check if an event is a valid webhook event */
export function isWebhookEvent(event: string): event is WebhookEventType {
  return ALL_WEBHOOK_EVENTS.includes(event as WebhookEventType);
}
