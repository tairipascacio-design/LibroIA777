# Security Specification — Voz a Libro Cloud Firestore

## 1. Data Invariants
1. Every `/users/{userId}` document belongs exclusively to `request.auth.uid == userId` with a verified email (`request.auth.token.email_verified == true`). No user may list `/users` or read another user's profile/email.
2. Users cannot self-upgrade `plan` to `"pro"` via client Firestore writes (`plan` must be `"free"` on create and immutable from client SDK updates unless `isAdmin()`).
3. Every `/users/{userId}/books/{bookId}` document requires the parent `/users/{userId}` profile to exist (`Master Gate`), must have `ownerId == request.auth.uid`, and `list` queries strictly enforce `resource.data.ownerId == request.auth.uid`.
4. All IDs match `^[a-zA-Z0-9_-]+$` (`<= 128` chars), all strings enforce explicit `.size()` bounds, all arrays enforce `.size()` bounds and first-element type validation, and all `createdAt` / `updatedAt` timestamps must equal `request.time`.

## 2. Dirty Dozen Attack Payloads (Must All Return PERMISSION_DENIED)
1. **Unauthenticated read/write** to `/users/uid1/books/book1`.
2. **Cross-user read** of `/users/victimUid` or `/users/victimUid/books/book1` by `attackerUid`.
3. **Blanket list scrape** on `/users` collection.
4. **Unverified email write** (`email_verified: false`) creating `/users/uid1`.
5. **Privilege escalation on create**: creating `/users/uid1` with `plan: "pro"`.
6. **Privilege escalation on update**: updating `/users/uid1` to flip `plan` from `"free"` to `"pro"`.
7. **Shadow field injection**: creating `/users/uid1/books/book1` with extra field `isAdminApproved: true`.
8. **Owner spoofing**: creating `/users/uid1/books/book1` with `ownerId: "victimUid"`.
9. **Immutable ID/owner mutation**: updating `/users/uid1/books/book1` to change `ownerId` or `id` or `createdAt`.
10. **Path ID poisoning**: creating `/users/uid1/books/../../other` or 1.5KB ID string.
11. **Timestamp spoofing**: creating/updating a book with a backdated client timestamp instead of `request.time`.
12. **Array/string DoS poisoning**: writing `title` > 200 chars, `synopsis` > 2000 chars, or `chapters` array > 100 items or containing non-map primitives.
