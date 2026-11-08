-- rename_repi_to_max_nudges (applied 2026-11-08): the coach is now "Max" (מקס / ماكس). The push texts in
-- trial_events() and gift_events() were rewritten in place: every Repi / ראפי / ريبي / رابي became Max / מקס / ماكس.
do $$
declare f text; d text;
begin
  foreach f in array array['public.trial_events(boolean)','public.gift_events(boolean)'] loop
    d := pg_get_functiondef(f::regprocedure);
    d := replace(replace(replace(replace(d,'ראפי','מקס'),'Repi','Max'),'ريبي','ماكس'),'رابي','ماكس');
    execute d;
  end loop;
end $$;
