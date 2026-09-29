WITH violations AS (
    SELECT contact.store_contact_email_id
    FROM ops.store_contact_email contact
    JOIN ops.store store ON store.store_id = contact.store_id
    WHERE contact.company_id IS DISTINCT FROM store.company_id
       OR contact.normalized_email IS DISTINCT FROM LOWER(BTRIM(contact.email_address))
       OR (contact.is_active = FALSE AND contact.deactivated_at IS NULL)
       OR (contact.is_active = TRUE AND contact.deactivated_at IS NOT NULL)
       OR length(contact.email_address) > 254
       OR EXISTS (
            SELECT 1 FROM ops.store_contact_email active_contact
            WHERE active_contact.store_id = contact.store_id AND active_contact.is_active = TRUE
            GROUP BY active_contact.store_id
            HAVING COUNT(*) FILTER (WHERE active_contact.is_primary = TRUE) <> 1
       )
)
SELECT 'STORE-EMAIL-01' AS check_id,
       'organization' AS category,
       COUNT(*)::bigint AS violation_count,
       COALESCE((array_agg(substr(md5(store_contact_email_id::text),1,12) ORDER BY store_contact_email_id)
         FILTER (WHERE store_contact_email_id IS NOT NULL))[1:5], ARRAY[]::text[]) AS sample_refs
FROM violations;
