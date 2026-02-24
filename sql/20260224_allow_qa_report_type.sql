alter table if exists public.schedule_anomaly_reports
  drop constraint if exists schedule_anomaly_reports_report_type_check;

alter table if exists public.schedule_anomaly_reports
  add constraint schedule_anomaly_reports_report_type_check
  check (report_type in ('upv', 'other', 'qa'));
