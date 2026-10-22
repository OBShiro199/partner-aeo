create index competitors_agency_idx on public.competitors (agency_id);
create index prompts_agency_idx on public.prompts (agency_id);
create index scans_agency_idx on public.scans (agency_id);
create index scan_results_scan_idx on public.scan_results (scan_id);
create index scan_results_prompt_idx on public.scan_results (prompt_id);
