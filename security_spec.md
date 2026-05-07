# Security Specification for Talee

## Data Invariants

1. **User Profile**: A user can only create and manage their own profile.
2. **Room**: A room must have an owner. Access to room contents (scenes) is restricted to members and the owner.
3. **Scene**: A scene cannot exist without a valid room. Only room members can add scenes.
4. **Image Cache**: Shared resource, but creation should be restricted to authenticated users.
5. **User Usage**: Strictly managed. Users can only update their own usage via specific logic (incrementing).

## The "Dirty Dozen" Payloads

1. **Identity Spoofing (Users)**: Update `/users/victim-uid` as `attacker-uid`.
2. **Identity Spoofing (Rooms)**: Create `/rooms/my-room` with `ownerId: victim-uid`.
3. **Role Escalation**: Add `role: 'admin'` to user profile.
4. **Member Bypass**: Attacker attempts to list scenes for a room they are not a member of.
5. **Member Hijack**: Attacker attempts to add themselves to a room's `members` array without ownership or invitation logic.
6. **Orphaned Scene**: Create a scene for a non-existent room.
7. **Fen Poisoning (N/A here, but ID Poisoning)**: Creating a scene with a 1MB string as ID.
8. **Resource Exhaustion**: Creating 10,000 rooms in a loop.
9. **PII Leak**: Authenticated user attempts to `get` another user's profile which might contain private data.
10. **State Shortcut**: Updating a room's `lastActiveDate` to a future date.
11. **Shadow Update**: Updating `dailyCount` to 0 in `user_usage`.
12. **System Field Injection**: Attempting to set `updatedAt` to a client-side timestamp instead of `serverTimestamp()`.

## Evaluation

| Collection | Identity Spoofing | State Shortcutting | Resource Poisoning |
|---|---|---|---|
| users | Protected (isOwner) | N/A | Protected (isValidId) |
| rooms | Protected (ownerId == auth.uid) | Protected (Strict Keys) | Protected (isValidId) |
| scenes | Protected (isMember) | Protected (Strict Keys) | Protected (isValidId) |
| user_usage | Protected (isOwner) | Protected (Action-based) | Protected (isValidId) |
| admins | Protected (isOwner/exists) | N/A | Protected (isValidId) |
