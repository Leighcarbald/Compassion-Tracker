import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  console.log(`API Request: ${method} ${url}`, data);
  
  try {
    // Make sure data is an object if provided
    const bodyData = data ? JSON.stringify(data) : undefined;
    console.log(`Request body:`, bodyData);
    
    const res = await fetch(url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: bodyData,
      credentials: "include",
    });

    console.log(`API Response: ${res.status} ${res.statusText}`);
    
    // Don't throw on non-2xx responses, let the caller handle them
    // This way we can still access the response body for error details
    return res;
  } catch (error) {
    console.error(`API Error for ${method} ${url}:`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // The first item is the base URL
    const baseUrl = queryKey[0] as string;
    
    // If there are additional parameters, let's handle them
    let url = baseUrl;
    if (queryKey.length > 1) {
      // Build query parameters from remaining items if they're non-null
      const params = new URLSearchParams();
      
      // Handle common parameter patterns
      if (queryKey[1] && typeof queryKey[1] === 'string') {
        // If second parameter is a string, it's likely an ID
        if (baseUrl.includes('medications') || baseUrl.includes('medication-logs')) {
          params.append('careRecipientId', queryKey[1]);
        } else if (baseUrl.includes('care-stats') || 
                  baseUrl.includes('events') || 
                  baseUrl.includes('notes') ||
                  baseUrl.includes('doctors') ||
                  baseUrl.includes('pharmacies') ||
                  baseUrl.includes('appointments')) {
          params.append('careRecipientId', queryKey[1]);
        }
        
        // If there's a third parameter for medications and it's a filter
        if (baseUrl.includes('medications') && queryKey[2]) {
          params.append('filter', queryKey[2] as string);
        }
        
        // If there's a third parameter for appointments and it's a date
        if (baseUrl.includes('appointments') && queryKey[2]) {
          params.append('date', queryKey[2] as string);
        }
      }
      
      // Add the query parameters to the URL if we have any
      const queryString = params.toString();
      if (queryString) {
        url = `${baseUrl}?${queryString}`;
      }
    }
    
    console.log(`Fetching: ${url}`);
    
    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
