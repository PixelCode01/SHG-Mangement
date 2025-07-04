/**
 * Modal utilities to replace browser alerts and confirms with proper UI
 */

// Simple promise-based alert replacement
export const showAlert = (message: string): Promise<void> => {
  return new Promise((resolve) => {
    // In a real implementation, you'd show a modal component
    // For now, we'll use console.warn and resolve immediately
    console.warn('Alert:', message);
    // TODO: Replace with proper modal component
    alert(message); // Temporarily keep original behavior
    resolve();
  });
};

// Simple promise-based confirm replacement
export const showConfirm = (message: string): Promise<boolean> => {
  return new Promise((resolve) => {
    // In a real implementation, you'd show a modal component
    // For now, we'll use console.warn and return the confirm result
    console.warn('Confirm:', message);
    // TODO: Replace with proper modal component
    const result = confirm(message); // Temporarily keep original behavior
    resolve(result);
  });
};

// For immediate migration, we can disable the ESLint rule for these specific usages
export const alertCompat = (message: string): void => {
  alert(message);
};

export const confirmCompat = (message: string): boolean => {
  return confirm(message);
};
