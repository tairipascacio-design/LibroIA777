// Dirty Dozen Security Assertions Reference for Voz a Libro Firestore Rules
export const DIRTY_DOZEN_PAYLOADS = [
  { name: 'unauthenticated_access', path: '/users/u1/books/b1', expected: 'PERMISSION_DENIED' },
  { name: 'cross_user_profile_read', path: '/users/victim', actor: 'attacker', expected: 'PERMISSION_DENIED' },
  { name: 'users_collection_list_scrape', path: '/users', actor: 'u1', expected: 'PERMISSION_DENIED' },
  { name: 'unverified_email_create', path: '/users/u1', emailVerified: false, expected: 'PERMISSION_DENIED' },
  { name: 'self_upgrade_plan_on_create', path: '/users/u1', data: { plan: 'pro' }, expected: 'PERMISSION_DENIED' },
  { name: 'self_upgrade_plan_on_update', path: '/users/u1', data: { plan: 'pro' }, expected: 'PERMISSION_DENIED' },
  { name: 'shadow_field_injection', path: '/users/u1/books/b1', data: { extraFlag: true }, expected: 'PERMISSION_DENIED' },
  { name: 'owner_id_spoof', path: '/users/u1/books/b1', data: { ownerId: 'victim' }, expected: 'PERMISSION_DENIED' },
  { name: 'immutable_owner_mutation', path: '/users/u1/books/b1', data: { ownerId: 'u2' }, expected: 'PERMISSION_DENIED' },
  { name: 'id_poisoning_length', path: `/users/u1/books/${'a'.repeat(200)}`, expected: 'PERMISSION_DENIED' },
  { name: 'timestamp_spoofing', path: '/users/u1/books/b1', data: { updatedAt: '2020-01-01T00:00:00Z' }, expected: 'PERMISSION_DENIED' },
  { name: 'array_element_type_poisoning', path: '/users/u1/books/b1', data: { chapters: ['not-a-map'] }, expected: 'PERMISSION_DENIED' },
] as const;
