import { useState, useCallback } from 'react';
import { invoke, InvokeArgs } from '@tauri-apps/api/core';

// Options for the hook, allowing for side-effects on success or error
interface UseTauriCommandOptions<T, P> {
    onSuccess?: (data: T, payload?: P) => void;
    onError?: (error: string) => void;
}

/**
 * A custom hook to simplify making calls to Tauri commands.
 *
 * @param command The name of the Tauri command to invoke.
 * @param options Optional callbacks for success and error handling.
 * @returns An object with an `execute` function and states for `isLoading`, `error`, and `data`.
 */
export function useTauriCommand<T, P extends InvokeArgs = Record<string, unknown>>(
    command: string,
    options?: UseTauriCommandOptions<T, P>
) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<T | null>(null);

    const execute = useCallback(async (payload?: P) => {
        setIsLoading(true);
        setError(null);
        // Optionally reset data on new execution
        // setData(null);

        try {
            // No more error here!
            const result: T = await invoke(command, payload);
            setData(result);
            options?.onSuccess?.(result, payload);
            return result;
        } catch (err: any) {
            // Coerce the error into a user-friendly string
            const errorMessage = typeof err === 'string' ? err : err.message || 'An unknown error occurred.';
            console.error(`Tauri command '${command}' failed:`, err);
            setError(errorMessage);
            options?.onError?.(errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, [command, options]);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return { execute, isLoading, error, data, clearError };
}