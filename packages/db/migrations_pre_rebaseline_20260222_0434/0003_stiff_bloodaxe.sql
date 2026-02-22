ALTER TABLE "calendar_owner_timeline_events" DROP CONSTRAINT "calendar_owner_timeline_events_calendar_binding_id_calendar_bindings_id_fk";
--> statement-breakpoint
ALTER TABLE "calendar_owner_timeline_events" DROP CONSTRAINT "calendar_owner_timeline_events_calendar_timeline_event_id_calendar_timeline_events_id_fk";
--> statement-breakpoint
ALTER TABLE "calendar_revisions" DROP CONSTRAINT "calendar_revisions_calendar_id_calendars_id_fk";
--> statement-breakpoint
ALTER TABLE "capacity_hold_events" DROP CONSTRAINT "capacity_hold_events_capacity_hold_id_capacity_holds_id_fk";
--> statement-breakpoint
ALTER TABLE "capacity_hold_events" DROP CONSTRAINT "capacity_hold_events_biz_actor_user_fk";
--> statement-breakpoint
ALTER TABLE "autocollection_attempts" DROP CONSTRAINT "autocollection_attempts_status_config_value_id_biz_config_values_id_fk";
--> statement-breakpoint
ALTER TABLE "installment_plans" DROP CONSTRAINT "installment_plans_status_config_value_id_biz_config_values_id_fk";
--> statement-breakpoint
ALTER TABLE "installment_schedule_items" DROP CONSTRAINT "installment_schedule_items_status_config_value_id_biz_config_values_id_fk";
--> statement-breakpoint
ALTER TABLE "production_batch_reservations" DROP CONSTRAINT "production_batch_reservations_status_config_value_id_biz_config_values_id_fk";
--> statement-breakpoint
ALTER TABLE "production_batches" DROP CONSTRAINT "production_batches_status_config_value_id_biz_config_values_id_fk";
