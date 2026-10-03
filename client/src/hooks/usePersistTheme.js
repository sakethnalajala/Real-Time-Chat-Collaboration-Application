import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { userService } from '../services/index.js';

/** Saves a theme change to the signed-in account so it follows the user across devices. */
export function usePersistTheme() {
  const { updateUser } = useAuth();
  return useCallback(
    (theme) =>
      userService
        .updateMe({ settings: { theme } })
        .then(({ user }) => updateUser({ settings: user.settings }))
        .catch(() => {}),
    [updateUser]
  );
}
