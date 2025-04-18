import { request } from "@octokit/request";
import { createAppAuth } from "@octokit/auth-app";

/**
 * Creates an authenticated Octokit client for the given installation
 * @param {import('../types/index.js').AppConfig} config - Application configuration
 * @param {number} installationId - GitHub App installation ID
 * @returns {Promise<import('@octokit/request').RequestInterface>} Authenticated request function
 */
export async function createOctokitClient(config, installationId) {
  console.log(`Creating authenticated Octokit client for app ID ${config.appId} and installation ${installationId}`);
  
  // Create the Octokit client with authentication
  const authenticatedRequest = request.defaults({
    request: { 
      hook: createAppAuth({ 
        appId: config.appId, 
        privateKey: config.privateKey?.substring(0, 15) + '...' || '<no-key>', // Log truncated key for security
        installationId 
      }) 
    },
  });
  
  // Wrap the original request to add logging
  const requestWithLogging = async (endpoint, options = {}) => {
    const requestPath = typeof endpoint === 'string' ? endpoint : endpoint.url || '<unknown>';
    console.log(`GitHub API Request: ${requestPath}`);
    const requestOptions = typeof endpoint === 'string' ? options : endpoint;
    console.log(`Request params: ${JSON.stringify(requestOptions, (key, value) => {
      // Redact sensitive information from logs
      if (['authorization', 'token', 'key', 'secret', 'password'].includes(key.toLowerCase())) {
        return '<redacted>';
      }
      return value;
    })}`);
    
    try {
      const startTime = Date.now();
      const response = await authenticatedRequest(endpoint, options);
      const duration = Date.now() - startTime;
      
      // Log response metadata, not full response to avoid huge logs
      console.log(`GitHub API Response: ${requestPath} - Status: ${response.status} (${duration}ms)`);
      
      // For binary responses like archive downloads, don't log the data
      if (response.headers && response.headers['content-type'] && 
          (response.headers['content-type'].includes('application/zip') ||
           response.headers['content-type'].includes('application/x-gzip') ||
           response.headers['content-type'].includes('application/octet-stream'))) {
        console.log(`Binary response received (${response.data?.length || 'unknown'} bytes)`);
      } else if (response.data) {
        // For data responses, log a summary
        if (Array.isArray(response.data)) {
          console.log(`Response contains array with ${response.data.length} items`);
        } else if (typeof response.data === 'object') {
          console.log(`Response contains object with keys: ${Object.keys(response.data).join(', ')}`);
        }
      }
      
      return response;
    } catch (error) {
      console.error(`GitHub API Error for ${requestPath}:`, error);
      throw error;
    }
  };
  
  return requestWithLogging;
}