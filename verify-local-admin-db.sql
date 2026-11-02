
SELECT staff_id,
       CASE
         WHEN password_hash = 'pbkdf2-sha256$100000$JwX71FUtjJKr2EGYlxONQg==$dDJXsF+Igx240XNBZQzOSr4XC6RwAp+Lr3xVNkZSeMc=' THEN 'MATCH'
         ELSE 'MISMATCH'
       END AS hash_comparison
FROM staff_users
WHERE staff_id = 'DEMO-ADMIN';
