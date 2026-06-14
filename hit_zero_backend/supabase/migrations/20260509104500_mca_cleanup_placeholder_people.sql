-- Remove original prototype celebration rows from the live MCA workspace and
-- correct the Rauser spelling supplied by the client.

update public.athletes
set display_name = 'Averi Rauser',
    initials = 'AR'
where id = 'caeb1db1-ae28-4080-abce-3adfd5cef05e'
  and display_name = 'Averi Rouser';

delete from public.celebrations
where headline in (
  'Madison Lee landed a new skill',
  'Jordan Reyes landed a new skill',
  'Riley Tatum landed a new skill',
  'Bella Moss landed a new skill',
  'Taylor Jinx landed a new skill',
  'Morgan Vale landed a new skill'
);
