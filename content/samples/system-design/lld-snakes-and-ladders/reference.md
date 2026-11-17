## 1. Understand the ask

The engine must play a deterministic game from given rolls, and the club wants to add house rules later. That second sentence is the real design brief: **keep each rule in one place** so a new rule is a small change.

## 2. Entities

[[visual:snl-classes]] shows two classes.

- **Board** is data: the size and a map from a square to where you end up. A snake and a ladder are the same idea, "from here, go there"; only the direction differs. Landing is one lookup: `jumps.get(square, square)`.
- **Game** is rules: players in order, each position, whose turn it is, and the winner.

The driver validates configuration (a snake must go down, a ladder up, both inside the board) so an impossible board is refused before play starts.

## 3. One move

`move(roll)` for the current player:

1. `target = position + roll`.
2. If `target` is past the last square, the player **stays** (exact finish).
3. Otherwise land with one lookup; note whether it was a ladder or a snake.
4. If the landing square is the last square, record the winner; the game is over.
5. Otherwise pass the turn with `nextTurn(roll)`.

Each rule appears exactly once. The exact-finish rule is one `if`; the jump is one lookup; game over is one check in the driver before calling `move`.

## 4. The change request

"A six gives another turn" is a **turn policy**, and it is switched on per game (`RULE SIX-AGAIN`), so games without it must play exactly as before: the old tests still pass after the change. Because who plays next is decided only in `nextTurn(roll)`, the change is a flag on the game and one line there: if the rule is on and the roll is 6, do not advance the turn. A win still ends the game first, because `move` returns before calling `nextTurn` when someone wins.

If turn logic had been written inline in `move` (or worse, in the driver), the same rule would have needed edits in several places, each a chance for a bug.

**Takeaway: separate the board's data from the game's rules, and give each rule one home. House rules, like real product requirements, keep arriving.**
