CREATE UNIQUE INDEX "AnatomimeHostElection_one_open_per_room_key"
ON "AnatomimeHostElection"("roomId")
WHERE "status" = 'OPEN';
