-- Shorter board names (owner, 2026-10-04): the split is "deliver now" vs "ordered for a later date",
-- not the kind of customer. Renames the boards in the Telur Asin template and in existing
-- workspaces that still use the template's names; boards the owner renamed are left alone.

update template
   set payload = jsonb_set(
         payload,
         '{boards}',
         (select jsonb_agg(
                   case b->>'key'
                     when 'pesanan_warung' then jsonb_set(b, '{name}', '"Pesanan"')
                     when 'preorder_catering' then jsonb_set(b, '{name}', '"Pre-order"')
                     else b
                   end order by ord)
            from jsonb_array_elements(payload->'boards') with ordinality as t(b, ord)))
 where key = 'telur-asin';

update board set name = 'Pesanan' where name = 'Pesanan Warung';
update board set name = 'Pre-order' where name = 'Pre-order Catering';
