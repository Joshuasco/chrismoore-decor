-- Real store contact details (editable afterwards in Admin → Settings).
insert into store_settings (key, value) values
    ('address', 'Block B34, Shop No. 2, New Extension, Wuse Modern Market, F.C.T, Abuja, Nigeria'),
    ('contact_phone', '0703 963 0895'),
    ('whatsapp_number', '2347039630895'),
    ('opening_hours', 'Always open')
on conflict (key) do update set value = excluded.value, updated_at = now();
