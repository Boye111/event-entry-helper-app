import { z } from "zod";
import { EVENT_TYPE_KEYS } from "./eventTypes";

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const guestSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  phone: optText(30),
  email: optText(200)
    .transform((v) => (v ? v.toLowerCase() : null))
    .refine((v) => !v || z.email().safeParse(v).success, "That email address doesn't look right"),
  seats: z.coerce.number().int().min(1, "Seats must be at least 1").max(20, "Max 20 seats"),
  side: optText(30),
  table_no: optText(30),
});

export const eventSchema = z.object({
  name: z.string().trim().min(1, "Give the event a name").max(120),
  type: z.enum(EVENT_TYPE_KEYS, "Choose the kind of event"),
  hosts: optText(120),
  event_date: optText(40).refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid date"),
  venue: optText(200),
  dress_code: optText(120),
  note: optText(1000),
});

export const checkinSchema = z.object({
  code: z.string().min(1).max(500),
  /** Only used when the admin scans; ushers are always locked to their own event. */
  eventId: z.coerce.number().int().positive().optional(),
});

export function firstError(e: z.ZodError): string {
  return e.issues[0]?.message ?? "Invalid input";
}

export const usherSchema = z.object({
  name: z.string().trim().min(1, "Enter the usher's name").max(60, "Max 60 characters"),
  phone: optText(30),
});

export const usherPatchSchema = z.object({ active: z.boolean() });
