/**
 * API Utility - Handles backend communication with timeout and error handling
 */

import { config } from './config';

// Default timeout in milliseconds
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const LONG_TIMEOUT = 60000; // 60 seconds for AI operations

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public isTimeout: boolean = false,
    public isNetworkError: boolean = false
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(
  url: string, 
  options: RequestInit, 
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new ApiError(
        'Request timed out. The server is taking too long to respond.',
        undefined,
        true,
        false
      );
    }
    
    // Network error (server not running, no internet, etc.)
    throw new ApiError(
      'Cannot connect to the server. Please make sure the backend is running.',
      undefined,
      false,
      true
    );
  }
}

/**
 * Make an API request with proper error handling
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {},
  timeout: number = DEFAULT_TIMEOUT
): Promise<ApiResponse<T>> {
  const url = endpoint.startsWith('http') ? endpoint : `${config.backendUrl}${endpoint}`;
  
  try {
    const response = await fetchWithTimeout(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    }, timeout);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      let errorMessage = `Server error (${response.status})`;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.detail || errorJson.message || errorMessage;
      } catch {
        if (errorText) errorMessage = errorText;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
    
    const data = await response.json();
    return {
      success: true,
      data
    };
  } catch (error: any) {
    if (error instanceof ApiError) {
      return {
        success: false,
        error: error.message
      };
    }
    
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
}

/**
 * Convenience method for POST requests
 */
export async function apiPost<T = any>(
  endpoint: string,
  body: any,
  timeout: number = DEFAULT_TIMEOUT
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(body)
  }, timeout);
}

/**
 * Convenience method for GET requests
 */
export async function apiGet<T = any>(
  endpoint: string,
  timeout: number = DEFAULT_TIMEOUT
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    method: 'GET'
  }, timeout);
}

/**
 * Long-running API request (for AI operations)
 */
export async function apiPostLong<T = any>(
  endpoint: string,
  body: any
): Promise<ApiResponse<T>> {
  return apiPost<T>(endpoint, body, LONG_TIMEOUT);
}

/**
 * Check if backend is available
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(
      `${config.backendUrl}/health`,
      { method: 'GET' },
      5000 // 5 second timeout for health check
    );
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * User-friendly error messages
 */
export function getErrorMessage(error: string): string {
  if (error.includes('timed out') || error.includes('timeout')) {
    return '⏱️ Request timed out. The server is taking too long to respond. Please try again.';
  }
  if (error.includes('Cannot connect') || error.includes('network') || error.includes('fetch')) {
    return '🔌 Cannot connect to the server. Please make sure the backend is running on localhost:8000.';
  }
  if (error.includes('500') || error.includes('Internal Server')) {
    return '⚠️ Server error. Please check the backend logs for details.';
  }
  return `❌ ${error}`;
}





