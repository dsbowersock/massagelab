# Anatomime Shared Room And Game Run Design

## Purpose

Anatomime needs one shared classroom flow that supports three answering modes without splitting into separate games. The host should be able to run team turns from the host/performer screen, players should be able to join by code from their own devices when the mode uses device answers, and signed-in players should receive personal progress only when their answer is strong evidence of term recognition.

This design replaces the current single shared-session mental model with a Room + Game Run model. The immediate scope is Anatomime only. A future branch can generalize live rooms across flashcards, quizzes, and other study tools.

## Goals

- Keep Anatomime as a team game with 4-term team turns and a 30-second timer per term.
- Support Host Judged, Device Typed, and Device Multiple Choice modes in one shared-room flow.
- Preserve the same join code across multiple game runs while the room remains active.
- Save individual progress only for signed-in players whose answer is first-correct in a qualifying lane.
- Keep anonymous players eligible for team points while avoiding persisted personal progress.
- Allow host transfer and ranked-choice host takeover so a room can continue if the host leaves.
- Keep route errors sanitized and avoid storing raw typed answers beyond what is needed to evaluate the guess.

## Non-Goals

- Do not build a generalized classroom platform in this branch.
- Do not save personal progress from Host Judged mode.
- Do not reveal term names, metadata, or multiple-choice options on player devices before their allowed state.
- Do not add voice answers, 3D runtime behavior, or cross-tool classroom rooms.
- Do not store raw typed answers as long-term progress data.

## Core Model

### Room

A room owns the reusable join code and the people in that live classroom context.

Room state includes:

- Public code.
- Room status: lobby, playing, game complete, review, ended, expired.
- Current host player id.
- Joined players and their teams.
- Teams and team names.
- Last meaningful activity time.
- Ended-at and review-expires-at timestamps.
- Current game run id.
- Host-transfer and host-election state.

The room code expires when the host ends the session or when there has been no meaningful activity for 30 minutes. If the host ends the session, existing players can still view final scores and recap for a 30-minute review window. New players cannot join during that review window.

Meaningful activity includes actions such as joining, changing teams, editing setup, starting a game, submitting guesses, advancing/resolving terms, transferring host, starting/voting in host election, ending a game, starting the next game, or ending the session. Passive polling and realtime refreshes do not count.

### Game Run

A game run is one playable Anatomime game under a room.

Game run state includes:

- Setup configuration: anatomy categories, body systems, regions, selected term pool, clue level, answer mode, term count, timers, and team names snapshot.
- Current team turn.
- Current term index inside the active 4-term turn.
- Current term deadline.
- Scores for the run.
- Guess and progress-credit state for each term.
- Turn review and final recap state.

When a game run ends, the host can start a new game under the same room code. Players and teams carry over, scores reset to 0, setup options can change, and players can change teams in the new lobby before the next game starts.

### Database Shape

Add new room-run models instead of overloading the existing `AnatomimeGameSession` table further:

- `AnatomimeRoom`
- `AnatomimeRoomTeam`
- `AnatomimeRoomPlayer`
- `AnatomimeGameRun`
- `AnatomimeGameRunTeamScore`
- `AnatomimeGameRunGuess`
- `AnatomimeHostElection`
- `AnatomimeHostElectionBallot`

Existing `AnatomimeGameSession` tables remain migration history and can be retired in a later cleanup. New shared-room routes should use the new room-run models.

## Shared Gameplay Baseline

All answer modes share these mechanics:

- A team turn has exactly 4 terms.
- One performer from the active team mimes those 4 terms.
- Each term has a 30-second timer.
- If a term is solved before time expires, the game advances immediately to the next term in that same team turn.
- If time expires, the game advances immediately to the next term in that same team turn.
- After all 4 terms resolve, the host sees the turn review and chooses Next Team.
- After all teams/rounds complete, players see final scores and recap.

Stolen terms are shown as Missed in the active team turn review. The scoreboard still credits the opposing team that earned the steal.

## Answer Modes

### Host Judged

Host Judged is the team-score-only classroom mode.

- The host/performer screen shows the term and clue details according to clue level.
- The host taps Got It when the active team gets the answer.
- Got It immediately awards the active team point and advances to the next term.
- Timer expiry marks the term missed and advances to the next term.
- Host Judged does not save individual progress.
- Player devices are not required for gameplay in this mode.

### Device Typed

Device Typed keeps the team game but moves answer entry to joined player devices.

- Player devices show timer, active team, and the player's own team status.
- Player devices do not show term name, anatomy metadata, answer aliases, or clue details.
- Players can type guesses immediately.
- Each player gets 5 typed guesses per term.
- Incorrect guesses show private incorrect feedback and clear the input.
- After 5 incorrect guesses, the input disappears and the player sees that they are out of guesses for the term.
- First correct active-team answer immediately awards the active team point and advances to the next term.
- First correct opposing-team answer creates a possible steal and can earn personal progress, but no team point is awarded yet.
- If the active team misses by timeout, the first opposing correct answer earns the steal point.
- There is no separate post-time steal window.

### Device Multiple Choice

Device Multiple Choice uses the same answer rules as Device Typed, plus a late recognition assist.

- Player devices show typed input immediately.
- Each player gets 5 typed guesses per term.
- Four multiple-choice options unlock near the end of the term.
- Each player gets 1 multiple-choice selection per term.
- A player who uses all 5 typed guesses still receives 1 multiple-choice attempt when choices unlock.
- If a player answers correctly by typing before options unlock, options do not appear for that player on that term.
- Multiple-choice options never appear on the host/performer screen.

Multiple-choice unlock timing is variable:

- Minimum unlock window: final 5 seconds.
- Maximum unlock window: final 10 seconds.
- Initial formula: total the trimmed character count of all 4 choice labels, then use `clamp(5 + ceil(max(0, totalChoiceChars - 80) / 30), 5, 10)`.
- The formula can be adjusted later from product evidence, but it should stay bounded between 5 and 10 seconds.

## Team Scoring Rules

For each term in Device Typed and Device Multiple Choice:

- Active-team players and opposing-team players can answer during the same timer.
- The first correct active-team answer immediately awards 1 point to the active team and resolves the term.
- The first correct opposing-team answer is held as a pending steal.
- If active team later answers correctly before timeout, the active team gets the point and the pending steal does not affect team score.
- If active team does not answer correctly before timeout, the first pending opposing correct answer awards 1 point to that opposing team.
- If no active or opposing team answers correctly before timeout, no point is awarded.
- If multiple opposing teams answer correctly, the first opposing correct answer overall owns the possible steal.

The host screen can show a generic encouraging pressure message when a pending steal exists, such as: "A steal is ready. Your team can still claim it." It must not reveal which opposing team or player has the pending steal.

## Personal Progress Rules

Personal progress writes only happen in Device Typed and Device Multiple Choice.

Progress is saved for signed-in players only:

- First correct active-team player for the term.
- First correct opposing-team player for the term.

Later correct answers receive feedback but do not update saved progress. Anonymous players can earn team points and receive in-game feedback, but they do not receive persisted mastery updates.

Progress writes should continue using the existing flashcard-linked Anatomime name recall path:

- Prompt type: `anatomime_name_recall`
- Prompt id pattern: `anatomime_name_recall:<cardId>`
- Tool path: existing flashcard progress helper

This keeps Anatomime term recognition aligned with flashcard mastery instead of creating a separate mastery model.

## Player Feedback Rules

Private feedback on player devices:

- Incorrect typed guess: show an incorrect message and clear the input.
- Out of typed guesses: hide typed input and show "Out of guesses for this term."
- First correct active-team answer: show success briefly; the term advances immediately.
- First correct opposing-team answer: "Correct. Your team can score if the active team misses."
- Opposing teammate after a pending steal exists: "Someone on your team found it. You can still guess for practice."
- Later correct answer after credit is already claimed: show positive practice feedback, but do not save progress or affect score.

Anonymous sign-in prompts should not interrupt live gameplay. After the full game ends, anonymous players can see a prompt such as: "Sign in next time to save your Anatomime progress."

## Host Control

There is exactly one host at a time.

The host can:

- Configure room/game setup.
- Start a game run.
- Advance after 4-term turn reviews.
- Start a new game under the same room code.
- Transfer host control.
- End the session.

Host transfer:

- Allowed only before the host explicitly ends the session.
- The host can transfer to any joined player, signed-in or anonymous.
- The previous host becomes a regular player on their same team.
- The new host is the only host.

## Ranked-Choice Host Election

If the host disappears without transferring control:

- After 60 seconds with no meaningful host activity, active players can start a Request Host Vote flow.
- Active players are joined players with meaningful activity in the last 30 minutes.
- Candidates include all active players, including the inactive current host.
- Players rank candidates.
- Voting closes when all active players vote or after 60 seconds, whichever comes first.
- The result uses instant-runoff ranked-choice voting.
- The winner becomes the only host.
- The previous host becomes a regular player if still present.

The first implementation should keep election UI simple and explicit. It should not infer host absence from passive network status alone.

## API Surface

Expected route/helper capabilities:

- Create room.
- Join room by code.
- Rejoin room from stored player credential or signed-in identity.
- Change team in lobby.
- Start game run under room code.
- Submit typed guess.
- Submit multiple-choice guess.
- Resolve term on active-team success.
- Resolve term on timeout.
- Complete team turn and show turn review.
- Start next team turn.
- Complete game run.
- Start next game under same code.
- End session and start review window.
- Transfer host.
- Request host election.
- Submit ranked ballot.
- Resolve host election.

Routes should use shared sanitized error mapping and should not expose player tokens in URLs.

## UI Requirements

Host setup:

- Answer mode options: Host Judged, Device Typed, Device Multiple Choice.
- The join code remains visible while the room is active.
- The host sees the term and clue details according to clue level.
- Device-answer modes show the generic pending-steal pressure message when applicable.

Player lobby:

- Players join from `/anatomime/join` or `/anatomime/play/[code]`.
- Team changes are allowed in lobby.
- Team changes lock once a game run starts.
- Rejoining during the same room restores the player's team automatically.

Player game screen:

- Show timer, active team, and player's own team status.
- Device Typed shows typed input immediately.
- Device Multiple Choice shows typed input immediately and unlocks 4 choices in the calculated final window.
- Hide inputs after success or after guess limits are exhausted.

End states:

- Full game end shows scores and recap.
- Host can start a new game under the same code.
- Host can end session.
- Ended sessions show the review-window countdown to existing players only.

## Testing Requirements

Unit/helper tests:

- 4-term turn advancement.
- Host Judged Got It and timer-expiry behavior.
- Device Typed first active correct immediate scoring.
- Device Typed pending opposing steal and timeout scoring.
- Multiple opposing correct answers award steal to first opposing correct answer.
- Personal progress eligibility for first active and first opposing signed-in players.
- Later correct answers do not save progress.
- Anonymous correct answers can score but do not save progress.
- Typed 5-guess limit.
- Multiple-choice 1-selection limit.
- Multiple-choice unlock timing clamp.
- Same-code new game resets scores and carries players/teams.
- Room expiry after 30 minutes meaningful inactivity.
- End-session 30-minute review window and no new joins.
- Host transfer.
- Ranked-choice instant-runoff host election.

Browser/API tests:

- Host creates room and sees join code.
- Player joins by code and selects team.
- Device Typed answer flow.
- Device Multiple Choice typed-before-options and options-unlock flow.
- Pending steal host pressure message.
- Host Judged team-score-only flow.
- Full game recap and anonymous sign-in-after-game prompt.
- Start next game under same code with carried players and reset scores.
- Host transfer and host election happy paths.

## Deferred Future Branch

The Big Platform Version is deferred. That future branch can extract the room concept into a cross-tool live classroom platform for Anatomime, flashcards, quizzes, and other education activities. This design should keep room boundaries clear enough to make that extraction possible later, but it should not build the generalized platform now.
