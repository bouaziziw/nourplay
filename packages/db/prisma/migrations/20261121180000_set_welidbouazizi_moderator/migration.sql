-- Met à jour le rôle de l'utilisateur welidbouazizi@gmail.com en MODERATOR
UPDATE "users"
SET "role" = 'MODERATOR'::"UserRole", "emailVerified" = true
WHERE LOWER(TRIM("email")) = 'welidbouazizi@gmail.com';
