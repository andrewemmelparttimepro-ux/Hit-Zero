-- Point MCA public directory records at the real public website.

update public.programs
set website_url = 'https://mcaminot.com'
where id = '11111111-1111-1111-1111-111111111111'::uuid
   or slug = 'mca'
   or lower(coalesce(name, '')) = 'magic city athletics';

