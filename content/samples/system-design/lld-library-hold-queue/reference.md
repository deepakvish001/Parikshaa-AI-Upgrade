## 1. Understand the ask

The rule we must implement is **fairness under scarcity**: when there are fewer copies than students, the first student to ask is the first to get one. Before writing classes, let's settle the details that change the code: the queue is **per book** (any copy will do), a returned copy goes **straight** to the next student, and a student cannot both hold and wait for the same book.

## 2. Entities and responsibilities

[[visual:holds-classes]] shows two classes and a driver.

- **Book** is state: how many copies are free, who holds one, and the queue of members waiting, in order.
- **Library** is rules: it finds the book, decides between borrowing and queueing, and hands over copies on return.
- **The driver** turns text into calls and prints replies. Keeping parsing out of the domain classes is what makes them reusable behind a web API later.

## 3. Borrowing

`borrow(book, member)` checks, in order: does the book exist; does this member already hold it or wait for it; is a copy free? If a copy is free, decrement `free` and add the member to `holders`. Otherwise **append** the member to the queue and report their position.

The queue is a **deque** (`collections.deque` in Python, `LinkedList` in Java): adding at the back and taking from the front are both O(1).

## 4. Returning: hand over, do not free

The subtle rule is on return. A naive version increments `free` and lets the next `BORROW` take it. But then a student who walks in at that moment could take the copy ahead of someone who has waited for days. So on return:

- if the queue is not empty, **pop the head and make them a holder**: the copy never becomes free;
- only if nobody is waiting does `free` go up.

The second kata test checks exactly this sequence: aditi returns and the copy goes to bilal, bilal returns and it goes to charu, and only charu's return frees the copy.

## 5. Errors that protect the rules

Returning a book you do not hold is refused, otherwise a typo could free a copy that is still on someone's desk. Joining a queue twice is refused, otherwise one student could occupy two places. These checks happen **before** any state changes, so a refused command leaves everything as it was.

## 6. The change request: faculty first

Faculty must jump ahead of students, but not ahead of other faculty who were already waiting. If the queue logic were spread through `borrow`, this rule would have to be threaded through it. Because joining the queue is **one method** (`enqueue`), the change is a few lines there: walk past the faculty already at the front and insert the new faculty member after them. Borrowing, returning and printing are untouched.

**The pattern to remember: keep the state (Book) separate from the rules (Library), and put each policy, such as who goes where in the queue, in exactly one method. The next requirement will almost always be a new policy.**
