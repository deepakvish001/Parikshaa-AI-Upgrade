## 1. Understand the ask

A vending machine is the classic **state machine** question, and interviewers use it to see whether you define every command in every state. The trap is a happy-path design that sells snacks correctly when used politely and loses money when someone presses buttons in the wrong order.

## 2. States and transitions

[[visual:vending-states]] shows two states that are enough for this kata:

- **IDLE**: no money inside.
- **PAID**: some credit inserted.

INSERT moves IDLE → PAID (or stays PAID, adding credit). A successful SELECT moves PAID → IDLE, dispensing and returning change. CANCEL moves PAID → IDLE with a refund. A **refused** SELECT (unavailable item, too little credit) leaves the state and the credit exactly as they were.

Writing this table first is the most valuable step: each row becomes a test, and every combination of state and command is decided before coding.

## 3. One class, guard clauses

`Machine` holds the state, the credit and the stock. Each command starts by checking what is not allowed and returns early with a clear message:

```text
select(item):
    if IDLE: "insert money first"
    if item missing or out of stock: "<item> unavailable"
    if credit < price: "need <n> more"
    sell: qty - 1, change = credit - price, credit = 0, state = IDLE
```

The success path is last and short, and it runs only after every guard passed, which is what makes "no item without full payment" easy to trust.

We use an enum (Java) or a string (Python) for the state. The full **state pattern**, with one class per state, pays off when states have many commands and transitions; with two states, an explicit field is clearer, and the follow-ups ask you to compare the two.

## 4. Money rules

Credit is never lost: a refused selection keeps it, a sale turns all of it into the price plus change, and CANCEL refunds it. Integer rupees avoid rounding errors.

## 5. The change request: repricing

Changing a price affects only the item record, so the change adds one method that updates the price, and one command in the driver. No state logic changes, and the old tests still pass because none of them use the new command.

**The habit to keep: draw the state table before the classes. Every bug in a state machine is a cell in that table that nobody filled in.**
