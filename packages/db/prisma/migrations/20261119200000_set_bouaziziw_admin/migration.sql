-- Met à jour le rôle de l'utilisateur bouaziziw@gmail.com en ADMIN
UPDATE "users"
SET "role" = 'ADMIN'::"UserRole", "emailVerified" = true
WHERE LOWER(TRIM("email")) = 'bouaziziw@gmail.com';
